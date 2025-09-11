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
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  console.log("[REALTIME-CHAT] WebSocket upgrade request received");

  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    console.error("[REALTIME-CHAT] OPENAI_API_KEY not found");
    return new Response("Server configuration error", { status: 500 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  // Connect to OpenAI Realtime API
  const openAISocket = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17", {
    headers: {
      "Authorization": `Bearer ${openaiApiKey}`,
      "OpenAI-Beta": "realtime=v1"
    }
  });

  // Handle OpenAI connection
  openAISocket.onopen = () => {
    console.log("[REALTIME-CHAT] Connected to OpenAI Realtime API");
    
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

    openAISocket.send(JSON.stringify(sessionUpdate));
    console.log("[REALTIME-CHAT] Session configuration sent");
  };

  // Forward messages from client to OpenAI
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("[REALTIME-CHAT] Client -> OpenAI:", message.type);
      
      if (openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.send(event.data);
      } else {
        console.error("[REALTIME-CHAT] OpenAI socket not ready, state:", openAISocket.readyState);
      }
    } catch (error) {
      console.error("[REALTIME-CHAT] Error forwarding client message:", error);
    }
  };

  // Forward messages from OpenAI to client
  openAISocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("[REALTIME-CHAT] OpenAI -> Client:", message.type);
      
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(event.data);
      } else {
        console.error("[REALTIME-CHAT] Client socket not ready, state:", socket.readyState);
      }
    } catch (error) {
      console.error("[REALTIME-CHAT] Error forwarding OpenAI message:", error);
    }
  };

  // Handle errors
  openAISocket.onerror = (error) => {
    console.error("[REALTIME-CHAT] OpenAI WebSocket error:", error);
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "error",
        error: "OpenAI connection error"
      }));
    }
  };

  socket.onerror = (error) => {
    console.error("[REALTIME-CHAT] Client WebSocket error:", error);
  };

  // Handle closures
  openAISocket.onclose = (event) => {
    console.log("[REALTIME-CHAT] OpenAI WebSocket closed:", event.code, event.reason);
    if (socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
  };

  socket.onclose = (event) => {
    console.log("[REALTIME-CHAT] Client WebSocket closed:", event.code, event.reason);
    if (openAISocket.readyState === WebSocket.OPEN) {
      openAISocket.close();
    }
  };

  return response;
});