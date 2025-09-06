import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Advanced therapeutic AI system prompt with contextual awareness
const SYSTEM_PROMPT = `Eres un psicólogo clínico experto en terapia cognitivo-conductual y humanista. Tu misión es proporcionar apoyo terapéutico inteligente y contextual durante sesiones de 10-15 minutos.

METODOLOGÍA TERAPÉUTICA:
1. ESTABLECER RAPPORT (minutos 0-3):
   - Crea conexión auténtica y seguridad emocional
   - Valida experiencias sin juzgar
   - Usa el nombre del usuario si lo proporciona

2. EXPLORAR ACTIVAMENTE (minutos 3-8):
   - Haz preguntas abiertas que profundicen
   - Identifica patrones de pensamiento automáticos
   - Conecta emociones con situaciones específicas
   - Usa técnicas de reflejo y reformulación

3. GENERAR INSIGHTS (minutos 8-12):
   - Ayuda a identificar conexiones entre eventos y emociones
   - Señala fortalezas y recursos internos
   - Introduce perspectivas alternativas sutilmente
   - Fomenta el autoconocimiento

4. CONSOLIDAR APRENDIZAJES (minutos 12-15):
   - Resume insights clave de la sesión
   - Ofrece herramientas prácticas simples
   - Prepara para la aplicación en vida real

ANÁLISIS CONTINUO:
- Evalúa constantemente señales OCEAN (Apertura, Responsabilidad, Extraversión, Amabilidad, Neuroticismo)
- Monitorea intensidad emocional y estabilidad
- Identifica temas centrales y necesidades terapéuticas
- Adapta tu enfoque según el progreso de la sesión

COMUNICACIÓN TERAPÉUTICA:
- Usa lenguaje cálido, profesional y accesible
- Emplea técnicas de validación emocional
- Reformula para generar claridad
- Haz preguntas que inviten a la reflexión profunda
- Mantén balance entre apoyo y desafío constructivo

GESTIÓN DE CRISIS:
- Si detectas ideación suicida o crisis severa, ofrece contención inmediata
- Proporciona recursos de emergencia cuando sea necesario
- Mantén límites profesionales claros
- No diagnostiques, pero sí identifica patrones preocupantes

Tu objetivo es maximizar el valor terapéutico en cada intercambio, adaptándote dinámicamente al estado emocional y necesidades del usuario.`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationId, userId } = await req.json();

    if (!message || !conversationId || !userId) {
      throw new Error('Missing required fields');
    }

    console.log('AI Chat request:', { conversationId, userId, messageLength: message.length });

    // Get conversation history
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw new Error('Failed to fetch conversation history');
    }

    // Save user message
    const { error: saveUserError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: message,
        metadata: { timestamp: new Date().toISOString() }
      });

    if (saveUserError) {
      console.error('Error saving user message:', saveUserError);
      throw new Error('Failed to save user message');
    }

    // Prepare messages for OpenAI
    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    console.log('Sending to OpenAI:', { messageCount: chatMessages.length });

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: chatMessages,
        max_completion_tokens: 1000,
        presence_penalty: 0.3,
        frequency_penalty: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;
    const tokensUsed = data.usage?.total_tokens || 0;

    console.log('OpenAI response received:', { tokensUsed, messageLength: assistantMessage.length });

    // Analyze message for OCEAN signals and insights
    const insights = analyzeMessageForInsights(message, assistantMessage);

    // Save assistant message
    const { error: saveAssistantError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantMessage,
        metadata: { 
          timestamp: new Date().toISOString(),
          insights,
          ocean_analysis: insights.ocean_signals
        },
        tokens_used: tokensUsed
      });

    if (saveAssistantError) {
      console.error('Error saving assistant message:', saveAssistantError);
      throw new Error('Failed to save assistant message');
    }

    // Update conversation with latest insights
    const { error: updateConversationError } = await supabase
      .from('conversations')
      .update({
        insights: insights,
        ocean_signals: insights.ocean_signals,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    if (updateConversationError) {
      console.error('Error updating conversation:', updateConversationError);
    }

    return new Response(JSON.stringify({ 
      message: assistantMessage,
      tokensUsed,
      insights 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-chat function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to analyze messages for psychological insights
function analyzeMessageForInsights(userMessage: string, assistantMessage: string) {
  const insights = {
    emotional_tone: detectEmotionalTone(userMessage),
    ocean_signals: detectOceanSignals(userMessage),
    conversation_themes: extractThemes(userMessage),
    engagement_level: calculateEngagement(userMessage),
    timestamp: new Date().toISOString()
  };

  return insights;
}

function detectEmotionalTone(message: string): string {
  const lowercaseMessage = message.toLowerCase();
  
  if (lowercaseMessage.includes('triste') || lowercaseMessage.includes('deprim')) return 'sad';
  if (lowercaseMessage.includes('feliz') || lowercaseMessage.includes('alegr')) return 'happy';
  if (lowercaseMessage.includes('enojado') || lowercaseMessage.includes('molesto')) return 'angry';
  if (lowercaseMessage.includes('ansioso') || lowercaseMessage.includes('nervioso')) return 'anxious';
  if (lowercaseMessage.includes('confundido') || lowercaseMessage.includes('perdido')) return 'confused';
  
  return 'neutral';
}

function detectOceanSignals(message: string): Record<string, number> {
  const lowercaseMessage = message.toLowerCase();
  
  return {
    openness: calculateOpenness(lowercaseMessage),
    conscientiousness: calculateConscientiousness(lowercaseMessage),
    extraversion: calculateExtraversion(lowercaseMessage),
    agreeableness: calculateAgreeableness(lowercaseMessage),
    neuroticism: calculateNeuroticism(lowercaseMessage)
  };
}

function calculateOpenness(message: string): number {
  let score = 0.3; // Lower baseline for more accurate scoring
  const content = message.toLowerCase();
  
  // Creativity and imagination indicators
  if (content.match(/nuevo|novedad|creativ|imagin|innovad|original/)) score += 0.25;
  if (content.match(/arte|música|libro|literatura|cultura|filosof/)) score += 0.2;
  if (content.match(/experiencia|aventura|viaj|explorar|descubrir/)) score += 0.2;
  if (content.match(/idea|concept|perspectiva|diferente|único/)) score += 0.15;
  if (content.match(/cambio|transform|evolución|crecimiento/)) score += 0.1;
  
  // Closed-mindedness indicators (reduce score)
  if (content.match(/tradicional|rutina|siempre igual|no me gusta cambiar/)) score -= 0.15;
  
  return Math.max(0, Math.min(1.0, score));
}

function calculateConscientiousness(message: string): number {
  let score = 0.3;
  const content = message.toLowerCase();
  
  // Organization and planning indicators
  if (content.match(/organiz|plan|horario|agenda|estructur/)) score += 0.25;
  if (content.match(/responsabilidad|deber|compromiso|obligación/)) score += 0.2;
  if (content.match(/disciplina|orden|método|sistemático/)) score += 0.2;
  if (content.match(/meta|objetivo|propósito|logro|éxito/)) score += 0.15;
  if (content.match(/puntual|tiempo|eficient|productiv/)) score += 0.1;
  
  // Disorganization indicators (reduce score)
  if (content.match(/desorden|caos|impulsiv|procrastin|dejo para después/)) score -= 0.15;
  
  return Math.max(0, Math.min(1.0, score));
}

function calculateExtraversion(message: string): number {
  let score = 0.3;
  const content = message.toLowerCase();
  
  // Social and energetic indicators
  if (content.match(/gente|social|fiesta|reunión|grupo/)) score += 0.25;
  if (content.match(/energ|activ|emocionado|entusiasm|dinamic/)) score += 0.2;
  if (content.match(/háblame|cuéntame|conversar|charlar|comunicar/)) score += 0.15;
  if (content.match(/lider|liderar|protagonismo|atención/)) score += 0.15;
  if (content.match(/amigos|conocer|socializ|salir/)) score += 0.1;
  
  // Introversion indicators (reduce score)
  if (content.match(/solo|soledad|tímid|callad|reservad|introspect/)) score -= 0.2;
  if (content.match(/casa|tranquilidad|silencio|paz/)) score -= 0.1;
  
  return Math.max(0, Math.min(1.0, score));
}

function calculateAgreeableness(message: string): number {
  let score = 0.4; // Higher baseline as most therapeutic conversations show some agreeableness
  const content = message.toLowerCase();
  
  // Cooperation and empathy indicators
  if (content.match(/ayud|cooper|colabor|equipo|junto/)) score += 0.25;
  if (content.match(/comprend|empat|cariñ|amor|afecto/)) score += 0.2;
  if (content.match(/gracias|por favor|disculp|perdón/)) score += 0.15;
  if (content.match(/confianz|honest|sinceridad|verdad/)) score += 0.15;
  if (content.match(/generoso|compartir|dar|solidario/)) score += 0.1;
  
  // Antagonistic indicators (reduce score)
  if (content.match(/egoísta|desconfi|competitiv|conflict|pelea/)) score -= 0.2;
  if (content.match(/crítica|juzgar|culpar|reprochar/)) score -= 0.15;
  
  return Math.max(0, Math.min(1.0, score));
}

function calculateNeuroticism(message: string): number {
  let score = 0.2; // Lower baseline to avoid over-pathologizing
  const content = message.toLowerCase();
  
  // Anxiety and emotional instability indicators
  if (content.match(/ansi|ansiedad|preocup|nervios|estrés/)) score += 0.3;
  if (content.match(/miedo|terror|pánico|fobia|insegur/)) score += 0.25;
  if (content.match(/triste|deprim|melanc|desanim/)) score += 0.2;
  if (content.match(/problema|dificultad|crisis|conflicto/)) score += 0.15;
  if (content.match(/llorar|llanto|dolor|sufr|mal/)) score += 0.15;
  if (content.match(/irritab|molest|frustr|enojad/)) score += 0.1;
  
  // Emotional stability indicators (reduce score)
  if (content.match(/calm|tranquil|paz|sereno|equilib|estable/)) score -= 0.2;
  if (content.match(/control|manejar|gestionar emociones/)) score -= 0.15;
  
  return Math.max(0, Math.min(1.0, score));
}

function extractThemes(message: string): string[] {
  const themes = [];
  const lowercaseMessage = message.toLowerCase();
  
  if (lowercaseMessage.includes('trabajo') || lowercaseMessage.includes('carrera')) themes.push('work');
  if (lowercaseMessage.includes('familia') || lowercaseMessage.includes('pareja')) themes.push('relationships');
  if (lowercaseMessage.includes('salud') || lowercaseMessage.includes('ejercicio')) themes.push('health');
  if (lowercaseMessage.includes('estudio') || lowercaseMessage.includes('aprender')) themes.push('education');
  if (lowercaseMessage.includes('futuro') || lowercaseMessage.includes('meta')) themes.push('goals');
  
  return themes;
}

function calculateEngagement(message: string): number {
  const wordCount = message.split(' ').length;
  const questionMarks = (message.match(/\?/g) || []).length;
  const exclamationMarks = (message.match(/!/g) || []).length;
  
  let engagement = Math.min(wordCount / 50, 1.0); // More words = more engagement
  engagement += questionMarks * 0.1; // Questions show engagement
  engagement += exclamationMarks * 0.05; // Exclamations show emotion
  
  return Math.min(1.0, engagement);
}