import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  // Check for WebSocket upgrade
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  // If not a WebSocket request, handle as HTTP API test
  if (upgradeHeader.toLowerCase() !== "websocket") {
    try {
      console.log('HTTP request received, handling as health check...');
      
      // Simple health check for HTTP requests
      if (req.method === 'GET') {
        return new Response(JSON.stringify({
          success: true,
          message: "Edge function is running. Use WebSocket for voice connection.",
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      // Handle POST requests for testing and API key retrieval
      if (req.method === 'POST') {
        const { messages = [], action } = await req.json();
        
        // Handle API key retrieval for direct OpenAI connection
        if (action === 'get_api_key') {
          const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
          if (!openAIApiKey) {
            throw new Error('OPENAI_API_KEY not configured in edge function environment');
          }
          
          return new Response(JSON.stringify({
            success: true,
            apiKey: openAIApiKey
          }), {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          });
        }
        
        // Test OpenAI connection (health check)
        const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openAIApiKey) {
          throw new Error('OpenAI API key not configured');
        }

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: messages.length > 0 ? messages : [
              { role: 'user', content: 'Health check - respond with OK' }
            ],
            max_tokens: 10,
          }),
        });

        if (!openaiResponse.ok) {
          throw new Error(`OpenAI API error: ${openaiResponse.status}`);
        }

        const data = await openaiResponse.json();
        
        return new Response(JSON.stringify({
          success: true,
          message: "OpenAI connection successful",
          data: data
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });

    } catch (error) {
      console.error('HTTP request error:', error);
      
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        message: error.message 
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
  }

  // WebSocket handling starts here
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log('WebSocket upgrade request received');
  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let openAISocket: WebSocket | null = null;
  let isConnecting = false;
  
  const connectToOpenAI = async () => {
    if (isConnecting || (openAISocket && openAISocket.readyState === WebSocket.OPEN)) {
      return;
    }
    
    isConnecting = true;
    
    try {
      openAISocket = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17", {
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "OpenAI-Beta": "realtime=v1"
        }
      });

      openAISocket.onopen = () => {
        isConnecting = false;
        
        // Send session configuration after connection
        const sessionUpdate = {
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: `You are a professional therapeutic assistant in English. Your role is:

1. THERAPEUTIC PERSONALITY:
- Maintain a warm, empathetic and professional tone
- Use active listening and emotional validation techniques
- Ask open questions to explore thoughts and feelings
- Offer helpful perspectives without being prescriptive

2. CONVERSATION STYLE:
- Speak naturally and conversationally for audio
- Use clear and accessible language
- Keep responses concise but thoughtful
- Allow natural silences for reflection

3. THERAPEUTIC APPROACH:
- Help identify thought patterns
- Foster self-exploration and insight
- Validate emotions without minimizing them
- Suggest coping strategies when appropriate

4. PROFESSIONAL BOUNDARIES:
- Do not diagnose mental health conditions
- Refer to professionals if you detect risk
- Keep conversation focused on wellbeing
- Respect user autonomy

Always respond in English with a professional yet warm tone.`,
            voice: "alloy",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: {
              model: "whisper-1"
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000
            },
            temperature: 0.8,
            max_response_output_tokens: "inf"
          }
        };

        if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
          openAISocket.send(JSON.stringify(sessionUpdate));
        }
        
        // Setup message forwarding
        setupOpenAIForwarding();
        
        // Notify client of successful connection
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "session.created",
            session_id: crypto.randomUUID()
          }));
        }
      };

      openAISocket.onerror = () => {
        isConnecting = false;
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "error",
            error: "Connection failed - retrying..."
          }));
        }
        
        // Retry connection after 2 seconds
        setTimeout(() => {
          if (socket.readyState === WebSocket.OPEN) {
            connectToOpenAI();
          }
        }, 2000);
      };

      openAISocket.onclose = () => {
        isConnecting = false;
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };

    } catch (error) {
      isConnecting = false;
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "error",
          error: "Failed to establish connection"
        }));
      }
    }
  };

  const setupOpenAIForwarding = () => {
    if (openAISocket) {
      openAISocket.onmessage = (event) => {
        try {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(event.data);
          }
        } catch (error) {
          // Silently handle forwarding errors
        }
      };
    }
  };

  // Initialize client handlers
  socket.onopen = () => {
    connectToOpenAI();
  };

  socket.onmessage = (event) => {
    try {
      if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.send(event.data);
      } else if (!isConnecting) {
        // Try to reconnect if not already connecting
        connectToOpenAI();
      }
    } catch (error) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "error",
          error: "Message processing failed"
        }));
      }
    }
  };

  socket.onerror = () => {
    if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
      openAISocket.close();
    }
  };

  socket.onclose = () => {
    if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
      openAISocket.close();
    }
  };

  return response;
});