import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders 
    });
  }

  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

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
            instructions: `Eres un asistente terapéutico profesional en español. Tu rol es:

1. PERSONALIDAD TERAPÉUTICA:
- Mantén un tono cálido, empático y profesional
- Usa técnicas de escucha activa y validación emocional
- Haz preguntas abiertas para explorar pensamientos y sentimientos
- Ofrece perspectivas útiles sin ser prescriptivo

2. ESTILO DE CONVERSACIÓN:
- Habla de forma natural y conversacional para audio
- Usa un lenguaje claro y accesible
- Mantén respuestas concisas pero reflexivas
- Permite silencios naturales para reflexión

3. ENFOQUE TERAPÉUTICO:
- Ayuda a identificar patrones de pensamiento
- Fomenta la autoexploración y el insight
- Valida emociones sin minimizarlas
- Sugiere estrategias de afrontamiento cuando sea apropiado

4. LÍMITES PROFESIONALES:
- No diagnostiques condiciones mentales
- Deriva a profesionales si detectas riesgo
- Mantén la conversación enfocada en el bienestar
- Respeta la autonomía del usuario

Responde siempre en español con un tono profesional pero cercano.`,
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