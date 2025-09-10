import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    return new Response("OPENAI_API_KEY is not set", { status: 500 });
  }

  console.log("WebSocket connection incoming...");

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let openAISocket: WebSocket | null = null;
  let isConnected = false;
  let sessionStarted = false;

  const connectToOpenAI = () => {
    console.log("Connecting to OpenAI Realtime API...");
    
    openAISocket = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
      [],
      {
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1"
        }
      }
    );

    openAISocket.onopen = () => {
      console.log("Connected to OpenAI Realtime API");
      isConnected = true;
      
      // Send session update after connection is established
      setTimeout(() => {
        if (openAISocket && !sessionStarted) {
          console.log("Sending session update...");
          sessionStarted = true;
          
          const sessionUpdate = {
            type: "session.update",
            session: {
              modalities: ["text", "audio"],
              instructions: "You are a helpful AI assistant in a therapeutic conversation. Be empathetic, supportive, and professional. Provide thoughtful responses that help the user reflect and process their thoughts and feelings.",
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
          
          openAISocket.send(JSON.stringify(sessionUpdate));
        }
      }, 100);
    };

    openAISocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("OpenAI message:", data.type);
        
        // Forward all messages to client
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(event.data);
        }
      } catch (error) {
        console.error("Error parsing OpenAI message:", error);
      }
    };

    openAISocket.onerror = (error) => {
      console.error("OpenAI WebSocket error:", error);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "error",
          error: "Connection to OpenAI failed"
        }));
      }
    };

    openAISocket.onclose = (event) => {
      console.log("OpenAI WebSocket closed:", event.code, event.reason);
      isConnected = false;
      sessionStarted = false;
      
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "connection_closed",
          code: event.code,
          reason: event.reason
        }));
      }
    };
  };

  socket.onopen = () => {
    console.log("Client WebSocket connected");
    connectToOpenAI();
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("Client message:", message.type);

      if (!isConnected) {
        console.log("Not connected to OpenAI, queuing message");
        return;
      }

      // Forward client messages to OpenAI
      if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.send(event.data);
      } else {
        console.log("OpenAI WebSocket not ready");
      }
    } catch (error) {
      console.error("Error handling client message:", error);
    }
  };

  socket.onerror = (error) => {
    console.error("Client WebSocket error:", error);
  };

  socket.onclose = () => {
    console.log("Client WebSocket closed");
    if (openAISocket) {
      openAISocket.close();
    }
  };

  return response;
});