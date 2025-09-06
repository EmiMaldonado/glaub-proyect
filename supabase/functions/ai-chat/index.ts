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

// Psychology-focused system prompt for empathy training
const SYSTEM_PROMPT = `Eres un psicólogo empático y profesional especializado en detectar y entender las emociones humanas. Tu objetivo es:

1. ESCUCHAR ACTIVAMENTE: Presta atención a las emociones subyacentes, no solo a las palabras.

2. DETECTAR SEÑALES OCEAN:
   - Apertura (curiosidad, creatividad, apertura a experiencias)
   - Responsabilidad (organización, disciplina, control de impulsos)
   - Extraversión (sociabilidad, asertividad, energía)
   - Amabilidad (cooperación, confianza, empatía)
   - Neuroticismo (ansiedad, estrés, inestabilidad emocional)

3. RESPONDER CON EMPATÍA:
   - Valida las emociones del usuario
   - Haz preguntas abiertas para profundizar
   - Ofrece perspectivas sin juzgar
   - Usa técnicas de reflejo y reformulación

4. MANEJAR TEMAS SENSIBLES:
   - Si detectas crisis, ofrece apoyo pero sugiere ayuda profesional
   - Mantén límites profesionales
   - No diagnostiques, solo escucha y orienta

5. EXTRAER INSIGHTS:
   - Identifica patrones de pensamiento
   - Nota fortalezas y áreas de crecimiento
   - Conecta experiencias pasadas con situaciones actuales

Habla de manera natural, cálida y profesional. Cada respuesta debe demostrar que realmente entiendes lo que la persona está sintiendo.`;

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
  let score = 0.5; // neutral baseline
  
  if (message.includes('nuevo') || message.includes('creativ') || message.includes('imagin')) score += 0.2;
  if (message.includes('arte') || message.includes('música') || message.includes('libro')) score += 0.15;
  if (message.includes('experiencia') || message.includes('aventura')) score += 0.15;
  
  return Math.min(1.0, score);
}

function calculateConscientiousness(message: string): number {
  let score = 0.5;
  
  if (message.includes('organiz') || message.includes('plan') || message.includes('meta')) score += 0.2;
  if (message.includes('responsabilidad') || message.includes('deber')) score += 0.15;
  if (message.includes('disciplina') || message.includes('orden')) score += 0.15;
  
  return Math.min(1.0, score);
}

function calculateExtraversion(message: string): number {
  let score = 0.5;
  
  if (message.includes('gente') || message.includes('social') || message.includes('fiesta')) score += 0.2;
  if (message.includes('energ') || message.includes('activ') || message.includes('emocionado')) score += 0.15;
  if (message.includes('háblame') || message.includes('cuéntame')) score += 0.1;
  
  return Math.min(1.0, score);
}

function calculateAgreeableness(message: string): number {
  let score = 0.5;
  
  if (message.includes('ayud') || message.includes('cooper') || message.includes('amable')) score += 0.2;
  if (message.includes('comprend') || message.includes('empat') || message.includes('cariñ')) score += 0.15;
  if (message.includes('gracias') || message.includes('por favor')) score += 0.1;
  
  return Math.min(1.0, score);
}

function calculateNeuroticism(message: string): number {
  let score = 0.5;
  
  if (message.includes('ansi') || message.includes('preocup') || message.includes('estrés')) score += 0.2;
  if (message.includes('miedo') || message.includes('insegur') || message.includes('nervi')) score += 0.15;
  if (message.includes('problema') || message.includes('dificultad')) score += 0.1;
  
  return Math.min(1.0, score);
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