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

// Enhanced therapeutic AI system with personalized approach
const getSystemPrompt = (isFirstConversation: boolean, previousInsights: any = null) => {
  const basePrompt = `You are an expert clinical psychologist specializing in cognitive-behavioral and humanistic therapy. Your mission is to provide intelligent and contextual therapeutic support during 10-15 minute sessions.

CRITICAL: YOU MUST ALWAYS RESPOND IN ENGLISH, regardless of the user's language. All responses must be in English only.`;

  if (isFirstConversation) {
    return `${basePrompt}

FIRST SESSION OBJECTIVES - OCEAN PERSONALITY PROFILING:
Your primary goal is to understand the user's personality using the OCEAN model through natural conversation.

KEY ASSESSMENT AREAS:
1. OPENNESS: Ask about interests, creativity, intellectual curiosity
   - "What kind of activities energize you most?"
   - "How do you typically approach new situations or challenges?"

2. CONSCIENTIOUSNESS: Explore organization, goal-setting, discipline
   - "Tell me about how you handle difficult situations at work"
   - "What was something that made you really proud recently in a professional or academic environment?"

3. EXTRAVERSION: Understand social preferences and energy sources
   - "How do you prefer to recharge after a busy day?"
   - "What role do you typically take in group situations?"

4. AGREEABLENESS: Assess empathy, cooperation, trust
   - "How would you describe your approach to conflict resolution?"
   - "What matters most to you in relationships with colleagues or friends?"

5. NEUROTICISM: Gauge emotional stability and stress responses
   - "How do you typically handle stress or pressure?"
   - "What helps you feel most centered and balanced?"

CONVERSATION FLOW:
- Start with warm greeting and check-in about their current state
- Naturally weave in personality assessment questions
- Listen for OCEAN signals in their responses
- Build rapport while gathering psychological insights
- Make the conversation feel therapeutic, not like an assessment

LANGUAGE REQUIREMENT: ALL RESPONSES MUST BE IN ENGLISH. Even if the user speaks in Spanish or another language, you must respond in English. This is a strict requirement.

Remember: Make this feel like a supportive therapy session while gathering valuable personality insights for future sessions.`;
  } else {
    const insightsContext = previousInsights ? `
PREVIOUS INSIGHTS ABOUT THIS USER:
- Key Insights: ${previousInsights.key_insights?.join(', ') || 'None available'}
- Personality Summary: ${previousInsights.personality_notes?.summary || 'No previous personality analysis'}
- OCEAN Scores: O:${previousInsights.personality_notes?.openness || 'Unknown'}, C:${previousInsights.personality_notes?.conscientiousness || 'Unknown'}, E:${previousInsights.personality_notes?.extraversion || 'Unknown'}, A:${previousInsights.personality_notes?.agreeableness || 'Unknown'}, N:${previousInsights.personality_notes?.neuroticism || 'Unknown'}
- Previous Recommendations: ${previousInsights.next_steps?.join(', ') || 'None available'}

BUILD ON THESE INSIGHTS: Reference previous conversations naturally, acknowledge growth or concerns mentioned before, and deepen your therapeutic approach based on their established personality profile.
` : '';

    return `${basePrompt}

FOLLOW-UP SESSION OBJECTIVES:
${insightsContext}

THERAPEUTIC METHODOLOGY:
1. ESTABLISH RAPPORT (minutes 0-3):
   - Acknowledge previous session insights naturally
   - Check on progress from previous recommendations
   - Validate experiences without judgment

2. ACTIVELY EXPLORE (minutes 3-8):
   - Build on established personality understanding
   - Ask deeper questions based on their OCEAN profile
   - Connect current challenges to previous themes
   - Use reflection and reformulation techniques

3. GENERATE INSIGHTS (minutes 8-12):
   - Help identify patterns across sessions
   - Point out growth and internal strengths
   - Offer personalized perspectives based on their personality
   - Foster deeper self-awareness

4. CONSOLIDATE LEARNINGS (minutes 12-15):
   - Summarize insights building on previous sessions
   - Offer personalized tools matching their personality
   - Prepare for real-life application with specific next steps

CONTINUOUS ANALYSIS:
- Update OCEAN signals based on new information
- Monitor emotional patterns across sessions
- Identify therapeutic themes and progress
- Adapt approach based on their established personality profile

LANGUAGE REQUIREMENT: ALL RESPONSES MUST BE IN ENGLISH. Even if the user speaks in Spanish or another language, you must respond in English. This is a strict requirement.`;
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  if (req.method === 'GET' && new URL(req.url).pathname.endsWith('/health')) {
    console.log('🔍 Health check requested');
    
    try {
      // Test Supabase connection
      const { data: supabaseTest, error: supabaseError } = await supabase
        .from('conversations')
        .select('id')
        .limit(1);

      if (supabaseError) {
        throw new Error(`Supabase connection failed: ${supabaseError.message}`);
      }

      // Test OpenAI connection
      const openAITest = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${openAIApiKey}` }
      });

      if (!openAITest.ok) {
        throw new Error(`OpenAI connection failed: ${openAITest.status}`);
      }

      console.log('✅ Health check passed - All systems operational');
      
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          supabase: 'connected',
          openai: 'connected'
        },
        debug: {
          message: 'All services are operational',
          supabase_test_result: !!supabaseTest,
          openai_test_status: openAITest.status
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('❌ Health check failed:', error);
      
      return new Response(JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        debug: {
          message: 'Service health check failed',
          error_type: error.constructor.name
        }
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  const startTime = Date.now();
  let debugInfo = {
    request_received_at: new Date().toISOString(),
    processing_steps: [],
    timing: {},
    metadata: {}
  };

  let requestBody: any = {};
  
  try {
    requestBody = await req.json();
    console.log('📥 Request body received:', JSON.stringify(requestBody, null, 2));
  } catch (error) {
    console.error('❌ Failed to parse request body:', error);
    return new Response(JSON.stringify({
      error: 'Invalid request body',
      debug: {
        success: false,
        error_category: 'request_parsing',
        error_message: 'Failed to parse JSON request body',
        error_type: error.constructor.name,
        processing_time_ms: Date.now() - startTime,
        steps_completed: [],
        timing_breakdown: {},
        metadata: {},
        timestamp: new Date().toISOString(),
        conversation_id: null,
        user_id: null
      }
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Handle session analysis requests
    if (requestBody.analysis_type === 'session_summary') {
      const messages = requestBody.messages || [];
      
      const analysisPrompt = `You are an expert therapeutic session analyst. Analyze the following conversation between a user and an AI therapeutic assistant to generate a comprehensive session summary.

CONVERSATION MESSAGES:
${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}

Please provide your analysis in the following JSON format:
{
  "key_insights": ["insight1", "insight2", "insight3"],
  "personality_notes": {
    "openness": number (0-100),
    "conscientiousness": number (0-100), 
    "extraversion": number (0-100),
    "agreeableness": number (0-100),
    "neuroticism": number (0-100),
    "summary": "Brief personality summary"
  },
  "next_steps": ["recommendation1", "recommendation2", "recommendation3"]
}

Base your analysis ONLY on what was actually discussed in this conversation. Do not invent or assume information not present in the messages.`;

      const analysisMessages = [{ role: 'user', content: analysisPrompt }];
      debugInfo.processing_steps.push('Processing session analysis request');
      
      // Call OpenAI for analysis
      const openAIStartTime = Date.now();
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages: analysisMessages,
          max_completion_tokens: 1000,
        }),
      });

      debugInfo.timing.openai_call_ms = Date.now() - openAIStartTime;

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      const analysisResult = data.choices[0].message.content;
      
      debugInfo.processing_steps.push('Session analysis completed');
      
      return new Response(JSON.stringify({ 
        message: analysisResult,
        tokensUsed: data.usage?.total_tokens || 0,
        debug: {
          success: true,
          analysis_type: 'session_summary',
          processing_time_ms: Date.now() - startTime,
          steps_completed: debugInfo.processing_steps,
          timestamp: new Date().toISOString()
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Regular chat flow continues here...
    const { message, conversationId, userId, isFirstMessage } = requestBody;

    // Validate required fields
    if (!message || !conversationId) {
      const missingFields = [];
      if (!message) missingFields.push('message');
      if (!conversationId) missingFields.push('conversationId');
      
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Use provided userId or 'system' for insights generation
    const effectiveUserId = userId || 'system';

    debugInfo.processing_steps.push('Request parsed successfully');
    debugInfo.metadata = {
      conversation_id: conversationId,
      user_id: userId,
      message_length: message?.length || 0,
      request_size_bytes: JSON.stringify(requestBody).length,
      is_first_message: isFirstMessage
    };


    // Get conversation history
    debugInfo.processing_steps.push('Fetching conversation history');
    const historyStartTime = Date.now();
    
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    debugInfo.timing.history_fetch_ms = Date.now() - historyStartTime;

    if (messagesError) {
      console.error('❌ Error fetching messages:', {
        error: messagesError,
        conversationId,
        details: messagesError.message
      });
      debugInfo.processing_steps.push(`Database error: ${messagesError.message}`);
      throw new Error(`Failed to fetch conversation history: ${messagesError.message}`);
    }

    debugInfo.processing_steps.push(`Retrieved ${messages?.length || 0} historical messages`);

    // Save user message
    debugInfo.processing_steps.push('Saving user message to database');
    const saveUserStartTime = Date.now();
    
    const { error: saveUserError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: message,
        metadata: { 
          timestamp: new Date().toISOString(),
          debug_info: {
            request_id: crypto.randomUUID(),
            message_length: message.length
          }
        }
      });

    debugInfo.timing.user_message_save_ms = Date.now() - saveUserStartTime;

    if (saveUserError) {
      console.error('❌ Error saving user message:', {
        error: saveUserError,
        conversationId,
        details: saveUserError.message
      });
      debugInfo.processing_steps.push(`User message save error: ${saveUserError.message}`);
      throw new Error(`Failed to save user message: ${saveUserError.message}`);
    }

    debugInfo.processing_steps.push('User message saved successfully');

    // Check if this is first conversation and get previous insights
    let previousInsights = null;
    let isFirstConversation = isFirstMessage || (messages?.length || 0) === 0;
    
    if (!isFirstConversation && effectiveUserId !== 'system') {
      debugInfo.processing_steps.push('Fetching previous insights for personalization');
      const { data: insights } = await supabase
        .from('key_insights')
        .select('insights, personality_notes, next_steps')
        .in('conversation_id', await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', effectiveUserId)
          .neq('id', conversationId)
          .then(res => res.data?.map(c => c.id) || [])
        )
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (insights) {
        previousInsights = {
          key_insights: insights.insights,
          personality_notes: insights.personality_notes,
          next_steps: insights.next_steps
        };
        debugInfo.processing_steps.push('Previous insights loaded for personalization');
      }
    }

    // Prepare messages for OpenAI with personalized system prompt
    const systemPrompt = getSystemPrompt(isFirstConversation, previousInsights);
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    debugInfo.processing_steps.push(`Prepared ${chatMessages.length} messages for OpenAI (first: ${isFirstConversation})`);
    debugInfo.metadata.openai_messages_count = chatMessages.length;
    debugInfo.metadata.has_previous_insights = !!previousInsights;

    // Call OpenAI API
    const openAIStartTime = Date.now();
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

    debugInfo.timing.openai_call_ms = Date.now() - openAIStartTime;

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        conversationId,
        messageCount: chatMessages.length
      });
      debugInfo.processing_steps.push(`OpenAI API error: ${response.status} - ${response.statusText}`);
      throw new Error(`OpenAI API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;
    const tokensUsed = data.usage?.total_tokens || 0;

    debugInfo.processing_steps.push('OpenAI response received successfully');
    debugInfo.metadata.tokens_used = tokensUsed;
    debugInfo.metadata.assistant_message_length = assistantMessage.length;
    debugInfo.metadata.finish_reason = data.choices[0].finish_reason;

    // Analyze message for OCEAN signals and insights
    debugInfo.processing_steps.push('Analyzing message for insights');
    const insightsStartTime = Date.now();
    const insights = analyzeMessageForInsights(message, assistantMessage);
    debugInfo.timing.insights_analysis_ms = Date.now() - insightsStartTime;

    debugInfo.processing_steps.push('Starting database save operations');

    // Save assistant message
    const saveAssistantStartTime = Date.now();
    const { error: saveAssistantError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantMessage,
        metadata: { 
          timestamp: new Date().toISOString(),
          insights,
          ocean_analysis: insights.ocean_signals,
          debug_info: {
            processing_time_ms: Date.now() - startTime,
            tokens_used: tokensUsed
          }
        },
        tokens_used: tokensUsed
      });

    debugInfo.timing.assistant_message_save_ms = Date.now() - saveAssistantStartTime;

    if (saveAssistantError) {
      console.error('❌ Error saving assistant message:', {
        error: saveAssistantError,
        conversationId,
        details: saveAssistantError.message
      });
      debugInfo.processing_steps.push(`Assistant message save error: ${saveAssistantError.message}`);
      throw new Error(`Failed to save assistant message: ${saveAssistantError.message}`);
    }

    debugInfo.processing_steps.push('Assistant message saved successfully');

    // Update conversation with latest insights
    const updateConversationStartTime = Date.now();
    const { error: updateConversationError } = await supabase
      .from('conversations')
      .update({
        insights: insights,
        ocean_signals: insights.ocean_signals,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    debugInfo.timing.conversation_update_ms = Date.now() - updateConversationStartTime;

    if (updateConversationError) {
      console.error('⚠️ Error updating conversation:', {
        error: updateConversationError,
        conversationId,
        details: updateConversationError.message
      });
      debugInfo.processing_steps.push(`Conversation update warning: ${updateConversationError.message}`);
      // Don't throw error for conversation update failure
    } else {
      debugInfo.processing_steps.push('Conversation updated successfully');
    }

    // Calculate total processing time
    debugInfo.timing.total_processing_ms = Date.now() - startTime;
    debugInfo.processing_steps.push('Processing completed successfully');


    // 6. Return debugging information in response
    return new Response(JSON.stringify({ 
      message: assistantMessage,
      tokensUsed,
      insights,
      debug: {
        success: true,
        processing_time_ms: debugInfo.timing.total_processing_ms,
        steps_completed: debugInfo.processing_steps,
        timing_breakdown: debugInfo.timing,
        metadata: debugInfo.metadata,
        timestamp: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    // 5. Enhanced error handling with clear messages
    console.error('❌ Error in ai-chat function:', {
      error: error.message,
      errorType: error.constructor.name,
      conversationId: debugInfo.metadata?.conversation_id || 'unknown',
      userId: debugInfo.metadata?.user_id || 'unknown',
      processingTimeMs: totalTime,
      stepsCompleted: debugInfo.processing_steps?.length || 0,
      lastStep: debugInfo.processing_steps?.[debugInfo.processing_steps.length - 1] || 'none',
      timestamp: new Date().toISOString(),
      stack: error.stack?.split('\n').slice(0, 5).join('\n') // First 5 lines of stack trace
    });

    // Determine error category for better debugging
    let errorCategory = 'unknown';
    let userFriendlyMessage = 'An unexpected error occurred';
    
    if (error.message.includes('Missing required fields')) {
      errorCategory = 'validation';
      userFriendlyMessage = 'Request is missing required information';
    } else if (error.message.includes('OpenAI')) {
      errorCategory = 'openai_api';
      userFriendlyMessage = 'AI service is temporarily unavailable';
    } else if (error.message.includes('Failed to fetch') || error.message.includes('Database')) {
      errorCategory = 'database';
      userFriendlyMessage = 'Database connection issue';
    } else if (error.message.includes('Failed to save')) {
      errorCategory = 'storage';
      userFriendlyMessage = 'Unable to save conversation data';
    }

    return new Response(JSON.stringify({ 
      error: userFriendlyMessage,
      debug: {
        success: false,
        error_category: errorCategory,
        error_message: error.message,
        error_type: error.constructor.name,
        processing_time_ms: totalTime,
        steps_completed: debugInfo.processing_steps || [],
        timing_breakdown: debugInfo.timing || {},
        metadata: debugInfo.metadata || {},
        timestamp: new Date().toISOString(),
        conversation_id: debugInfo.metadata?.conversation_id || null,
        user_id: debugInfo.metadata?.user_id || null
      }
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