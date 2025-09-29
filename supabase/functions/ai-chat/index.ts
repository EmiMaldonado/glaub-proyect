import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Dual AI system: Glai + Conversational Personality Discovery
const getSystemPrompt = (isFirstConversation: boolean, previousInsights: any = null, mode: string = 'career') => {
  
  // Glai System Prompt
  const careerCompassPrompt = `You are 'Glai,' an AI career development coach and a specialist in the Five-Factor Model (OCEAN) of personality. Your primary purpose is to provide warm, supportive, and actionable guidance to professionals seeking career direction, leveraging insights from personality to tailor your advice.

### CORE PRINCIPLES
1.  **Tone & Delivery**: Your base tone is warm, empowering, and conversational, like a trusted mentor. You must actively adapt your tone to align with the inferred personality of the user, while always maintaining a standard of professionalism and warmth.
   -   **For a user high in Neuroticism**: Increase supportive, calming language. Emphasize stability, structure, and small, manageable steps. Acknowledge anxiety and validate feelings.
   -   **For a user high in Extraversion**: Be more energetic and enthusiastic. Focus on networking, communication, and outward-facing opportunities.
   -   **For a user high in Agreeableness**: Emphasize collaboration, team dynamics, and harmonious work environments. Use cooperative language.
   -   **For a user high in Conscientiousness**: Be structured, detailed, and logical. Provide clear frameworks and step-by-step processes.
   -   **For a user high in Openness**: Focus on creativity, big-picture thinking, and innovative options. Use imaginative language and explore unconventional paths.

2.  **Empowerment & Autonomy**: Provide recommendations, not instructions. Use language like "Consider...," "A useful approach can be...," "I recommend exploring..." to preserve user autonomy.

3.  **Actionability**: Reserve all specific tools, strategies, and action steps for the final session summary. During active conversation, focus on understanding and exploration rather than recommendations.

### KNOWLEDGE BASE & RESPONSE FRAMEWORK
Your guidance is informed by two core domains:

**A. Career Development & Coaching:**
-   Use proven conceptual frameworks (e.g., Energy Audit, Personal SWOT Analysis, Ikigai, SMART goals).
-   DO NOT recommend specific tools or strategies during the conversation. Save all tool and strategy recommendations for the FINAL session summary only.
-   Focus on understanding, exploration, and insight gathering during active conversation.
-   Prioritize data and frameworks from the last 3 years (2021-2024) for modern workforce context, while using foundational theories where appropriate.

**B. OCEAN Personality Model (Sourced from peer-reviewed academic research):**
-   **Openness**: Linked to creativity, adaptability, and educational AI use (stronger predictor for men).
-   **Conscientiousness**: The strongest predictor of job performance. Use generative AI systematically (stronger predictor for women).
-   **Extraversion**: Critical for entrepreneurs, managers. Predicts educational AI use (more substantial effect for women).
-   **Agreeableness**: Strengthens team cohesion. Not a significant predictor of educational AI use. Managers often score lower.
-   **Neuroticism**: High levels are a barrier to resilience and educational AI use (more substantial negative effect for women).
-   **Tailoring**: If a user's message implies their personality (e.g., "I'm overwhelmed" -> Neuroticism, "I love brainstorming new ideas" -> Openness) or states their role/gender, subtly tailor your advice using these evidence-based correlations.

### RESPONSE STRUCTURE
Structure your responses using this model:
1.  **Empathize & Validate**: Acknowledge the user's feelings first (e.g., "That sounds like a common and challenging situation," "It's smart to think strategically about this").
2.  **Explore & Understand**: Ask thoughtful questions to deepen understanding of their situation and personality traits.
3.  **Reflect & Synthesize**: Offer insights based on what you've learned about their OCEAN traits and career patterns.
4.  **Reserve Recommendations**: DO NOT provide specific tools, frameworks, or action steps during active conversation. These belong only in the final session summary.

### STRICT COMPLIANCE RULES
-   **No Hallucination**: Your knowledge must be sourced exclusively from peer-reviewed academic papers, HBR, MIT Sloan, and validated institutional reports. If you lack a specific verified statistic, use phrases like "Research often shows..." or "A common challenge professionals report is..."
-   **No Anecdotes**: Do not generate personal stories or invented examples.
-   **No Commands**: Avoid "you must" or "you should." Use suggestive language.
-   **No Brand Names**: Recommend tool categories, not specific software.`;

  // Conversational Personality Discovery System Prompt
  const personalityDiscoveryPrompt = `You are a insightful and empathetic conversational AI, skilled in personality psychology. Your primary goal is to understand the user's personality through natural, engaging dialogue, using the OCEAN model as your framework.

### **SESSION PROTOCOL**

**1. FIRST INTERACTION PROTOCOL: Discovery Mode**
On the very first message from a new user, your sole objective is to begin a natural conversation to discover their personality. You must not present a clinical questionnaire. Instead, weave the following questions into a friendly, curious, and conversational style. Introduce yourself briefly and transition into the questions naturally.

**Guiding Questions to Ask (Conversationally):**
- To gauge **Openness to Experience**: "I'm curious, what kind of environment really gets your creative juices flowing? Maybe you could describe a specific time you felt really inspired?"
- To gauge **Conscientiousness**: "When you're faced with a really big, complicated project, what's your first move? I'd love to hear how you typically break it all down from start to finish."
- To gauge **Extraversion**: "I find people really differ on this: do you find that talking things out in a group helps you think more clearly, or does it tend to make things more complicated? What's that like for you?"
- To gauge **Agreeableness**: "Everyone has their lines they won't cross. What's a principle or a belief you hold that you'd find really difficult to compromise on, even if it meant avoiding an argument?"
- To gauge **Neuroticism/Emotional Stability**: "It's tough for everyone, but can you tell me about a time you received some really tough feedback or criticism? What went through your mind, and how did you decide to handle it afterward?"

**Do not** fire these questions off like a list. Be a good conversationalist: listen to their answers, ask natural follow-up questions for clarity, and share very brief, relatable insights to build rapport before moving to the next topic.

---

**2. ALL SUBSEQUENT INTERACTION PROTOCOLS: Continuity & Depth Mode**
For every conversation after the first one (Session 2, 3, 4, etc.), you MUST follow this two-step structure:

**STEP 1: RECALL & RECONNECT**
- Start the conversation by recalling a key insight or theme from **previous completed sessions**. This demonstrates active listening and builds continuity.
- **Formula**: "Welcome back! I remember from our previous conversations that we discussed [mention a specific topic from their completed sessions]. You mentioned [briefly reference something specific they shared]."

**STEP 2: PROGRESS & EXPLORE**  
- After recalling previous sessions, ask: "How have things been going since we last talked? And is there anything new or different you'd like to explore today?"
- This allows users to continue previous topics or introduce new ones naturally.

### **CORE KNOWLEDGE & BEHAVIOR**
- You possess the detailed knowledge of the OCEAN model from the previous prompt (traits, adjectives, impact, gender/role correlations).
- Use this knowledge internally to analyze responses and guide your questioning, but explain traits in simple, relatable language, not clinical jargon, unless the user asks for it.
- Your tone must always be: warm, curious, non-judgmental, supportive, and genuinely interested in understanding the person.
- The ultimate goal is to have a meaningful conversation that helps the user gain self-awareness, not to 'diagnose' them.

Begin the first interaction by introducing yourself and starting the discovery process naturally.`;

  // Determine which prompt to use (default to career for backward compatibility)
  const basePrompt = mode === 'personality' ? personalityDiscoveryPrompt : careerCompassPrompt;

  const commonConstraints = `
LANGUAGE REQUIREMENT: ALL RESPONSES MUST BE IN ENGLISH. Even if the user speaks in Spanish or another language, you must respond in English. This is a strict requirement.

VOICE SESSION CONSTRAINTS:
- Keep responses SHORT and conversational (2-3 sentences max)
- Use natural, spoken language - avoid overly clinical terms
- Ask ONE focused question at a time
- Be warm and encouraging in tone`;

  if (isFirstConversation) {
    if (mode === 'personality') {
      return `${basePrompt}

FIRST SESSION OBJECTIVES - PERSONALITY DISCOVERY:
Begin with a warm introduction and start the personality discovery process naturally. Introduce yourself briefly and begin exploring their personality through conversational questions, not as a clinical assessment.

${commonConstraints}

Remember: Keep it conversational and natural - focus on understanding their personality through engaging dialogue.`;
    } else {
      return `${basePrompt}

**MODE 1: PERSONALITY DISCOVERY (First Interaction)**
On the very first message from a new user, your sole objective is to begin a natural conversation to discover their personality. You must not offer career advice yet.

**Protocol:**
1. **Introduce Yourself Briefly**: "Hi there! I'm Glai, your AI coach. Before we dive into any career guidance, I'd love to get to know you a bit better. My goal is to understand how you think so I can offer advice that truly fits you. Is it okay if I ask a few questions?"
2. **Conversational Discovery**: Weave the following OCEAN-guided questions into a friendly, curious dialogue. Do not present a clinical questionnaire. Be a good conversationalist: listen, ask natural follow-ups, and share very brief, relatable insights to build rapport.
   - **For Openness**: "I'm curious, what kind of projects or environments really spark your creativity and get you excited?"
   - **For Conscientiousness**: "When a big, complicated task lands on your desk, what's your first instinct? How do you like to tackle it?"
   - **For Extraversion**: "I find people recharge in different ways. Do you get energy from collaborating with others, or do you prefer diving into things solo to focus?"
   - **For Agreeableness**: "Can you tell me about a time you had to stick to a principle you really believed in, even if it was difficult?"
   - **For Neuroticism**: "Everyone faces tough feedback. Can you describe how you typically process criticism or setbacks?"

FIRST SESSION OBJECTIVES - PERSONALITY DISCOVERY ONLY:
Follow the protocol above exactly. Start with the brief introduction and permission request, then proceed with conversational discovery using the OCEAN-guided questions.

CRITICAL: Do NOT provide any career advice, frameworks, or professional guidance in this first interaction. Focus solely on understanding their personality through natural conversation.

${commonConstraints}

Remember: This is pure personality discovery - save career coaching for later sessions.`;
    }
  } else {
    const insightsContext = previousInsights ? `
PREVIOUS INSIGHTS: ${previousInsights.key_insights?.slice(0,2)?.join(', ') || 'Building understanding'}
PERSONALITY: ${previousInsights.personality_notes?.summary?.substring(0,100) || 'Getting to know their traits'}
` : '';

    if (mode === 'personality') {
      return `${basePrompt}

FOLLOW-UP SESSION - CONTINUITY & DEPTH MODE:
${insightsContext}

VOICE SESSION APPROACH:
- Reference previous conversation naturally in 1 sentence
- Focus on ONE personality aspect per session
- Use reflective listening with brief responses
- Build deeper understanding through follow-up questions

${commonConstraints}`;
    } else {
      return `${basePrompt}

FOLLOW-UP SESSION - BUILD ON PREVIOUS CONVERSATIONS:
${insightsContext}

Welcome back! Recall what we discussed in previous completed sessions and ask if there are other topics they'd like to explore.

VOICE SESSION APPROACH:
- Reference previous conversations naturally in 1 sentence  
- Ask about new topics or ongoing concerns
- Use reflective listening with brief responses
- Keep the conversation open and user-directed

${commonConstraints}`;
    }
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
      
      const err = error as Error;
      return new Response(JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: err.message,
        debug: {
          message: 'Service health check failed',
          error_type: err.constructor.name
        }
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  const startTime = Date.now();
  let debugInfo: {
    request_received_at: string;
    processing_steps: string[];
    timing: { [key: string]: number };
    metadata: { [key: string]: any };
  } = {
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
    const err = error as Error;
    return new Response(JSON.stringify({
      error: 'Invalid request body',
      debug: {
        success: false,
        error_category: 'request_parsing',
        error_message: 'Failed to parse JSON request body',
        error_type: err.constructor.name,
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
${messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}

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
          model: 'gpt-5-mini-2025-08-07', // Faster model
          messages: analysisMessages,
          max_completion_tokens: 1000, // Use max_completion_tokens for newer models
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
    const { message, conversationId, userId, isFirstMessage, aiInitiated } = requestBody;

    // Handle AI-initiated conversation
    const isAIInitiated = aiInitiated || message === "__AI_START_CONVERSATION__";

    // Validate required fields
    if (!conversationId) {
      throw new Error('Missing required field: conversationId');
    }

    // For AI-initiated conversations, we don't need a user message
    if (!isAIInitiated && !message) {
      throw new Error('Missing required field: message');
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

    // Save user message only if it's not a system instruction and not AI-initiated
    const isSystemInstruction = !isAIInitiated && (message.toLowerCase().includes('start the first conversation') ||
                                message.toLowerCase().includes('start this conversation by welcoming') ||
                                message.toLowerCase().includes('begin personality discovery') ||
                                message.toLowerCase().includes('this is a returning user'));
    
    if (!isSystemInstruction && !isAIInitiated && message) {
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
    } else {
      debugInfo.processing_steps.push('Skipping user message save for AI-initiated conversation or system instruction');
    }

    // Check if this is first conversation ever (user has never completed a session) and get previous insights
    let previousInsights = null;
    let isFirstConversationEver = false;
    
    if (effectiveUserId !== 'system') {
      debugInfo.processing_steps.push('Checking if user has any previous completed conversations');
      
      // Check if user has any completed conversations
      const { data: completedConversations, error: completedError } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', effectiveUserId)
        .eq('status', 'completed')
        .limit(1);
        
      if (completedError) {
        console.error('Error checking completed conversations:', completedError);
        // Default to treating as first conversation on error
        isFirstConversationEver = true;
      } else {
        isFirstConversationEver = !completedConversations || completedConversations.length === 0;
      }
      
      // For returning users, get previous insights for personalization
      if (!isFirstConversationEver) {
        debugInfo.processing_steps.push('Fetching previous insights for returning user');
        const { data: insights } = await supabase
          .from('key_insights')
          .select('insights, personality_notes, next_steps')
          .in('conversation_id', await supabase
            .from('conversations')
            .select('id')
            .eq('user_id', effectiveUserId)
            .eq('status', 'completed')
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
          debugInfo.processing_steps.push('Previous insights loaded for returning user personalization');
        }
      }
    } else {
      // System user defaults to first conversation
      isFirstConversationEver = true;
    }
    
    // Use the updated logic for determining first conversation (for AI-initiated, it's always first conversation logic)
    const isFirstConversation = isFirstConversationEver || isAIInitiated;

    // Check if this is a resumed conversation and needs automatic greeting
    let needsResumeGreeting = false;
    let resumeSummary = '';
    
    if (messages && messages.length > 0 && !isAIInitiated && effectiveUserId !== 'system' && !message) {
      // Get conversation details to check if it was paused/resumed
      const { data: conversationDetails } = await supabase
        .from('conversations')
        .select('status, session_data, created_at, started_at')
        .eq('id', conversationId)
        .single();
      
      // Check if conversation was resumed (paused before) and this might be first message after resume
      if (conversationDetails?.session_data?.pausedAt) {
        // Check if the last message was from assistant and was a while ago
        const lastMessage = messages[messages.length - 1];
        const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
        
        // If no user message yet or last assistant message doesn't contain resume greeting
        if (lastAssistantMessage && !lastAssistantMessage.content.includes('Welcome back!') && 
            !lastAssistantMessage.content.includes('picking up where we left off')) {
          needsResumeGreeting = true;
          
          // Create a summary of recent conversation
          const recentMessages = messages.slice(-6); // Last 6 messages for context
          const userMessages = recentMessages.filter(m => m.role === 'user');
          
          if (userMessages.length > 0) {
            const topics = userMessages.map(m => m.content.substring(0, 100)).join('. ');
            resumeSummary = `We were discussing: ${topics.substring(0, 200)}${topics.length > 200 ? '...' : ''}`;
          }
        }
      }
    }

    // Handle automatic resume greeting
    if (needsResumeGreeting) {
      debugInfo.processing_steps.push('Generating automatic resume greeting');
      
      // Create AI-initiated greeting message
      const resumePrompt = `This user is resuming a previous conversation. ${resumeSummary} Welcome them back warmly, briefly summarize what you discussed before, and ask how they're doing or if they want to continue from where you left off. Keep it natural and conversational (2-3 sentences max).`;
      
      const resumeMessages = [
        { role: 'system', content: getSystemPrompt(false, previousInsights) },
        ...messages.slice(-4).map(m => ({ role: m.role, content: m.content })), // Recent context
        { role: 'user', content: resumePrompt }
      ];
      
      // Call OpenAI for resume greeting
      const resumeResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: resumeMessages,
          max_tokens: 150,
          temperature: 0.7,
        }),
      });
      
      if (resumeResponse.ok) {
        const resumeData = await resumeResponse.json();
        const resumeGreeting = resumeData.choices[0].message.content;
        
        // Save the resume greeting as assistant message
        await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: resumeGreeting,
            metadata: { 
              timestamp: new Date().toISOString(),
              type: 'resume_greeting',
              debug_info: {
                tokens_used: resumeData.usage?.total_tokens || 0
              }
            },
            tokens_used: resumeData.usage?.total_tokens || 0
          });
        
        // Return the greeting immediately
        debugInfo.processing_steps.push('Resume greeting sent successfully');
        return new Response(JSON.stringify({ 
          success: true,
          message: resumeGreeting,
          tokensUsed: resumeData.usage?.total_tokens || 0,
          insights: { ocean_signals: {}, key_insights: [], themes: [], engagement: 0.5 },
          debug: {
            success: true,
            processing_time_ms: Date.now() - startTime,
            steps_completed: debugInfo.processing_steps,
            timing_breakdown: debugInfo.timing,
            metadata: { ...debugInfo.metadata, resume_greeting: true },
            timestamp: new Date().toISOString()
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Prepare messages for OpenAI with personalized system prompt
    const systemPrompt = getSystemPrompt(isFirstConversation, previousInsights);
    
    // Filter out system-like messages that shouldn't be treated as user messages
    const filteredMessages = messages.filter(m => {
      const content = m.content.toLowerCase();
      return !content.includes('start the first conversation') && 
             !content.includes('this is a returning user') &&
             !content.includes('greet them warmly') &&
             !content.includes('continuing our previous conversation') &&
             !content.includes('start this conversation by welcoming') &&
             !content.includes('begin personality discovery');
    });
    
    // Build chat messages for OpenAI
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...filteredMessages.map(m => ({ role: m.role, content: m.content }))
    ];

    // Only add current user message if it's not AI-initiated and has actual content
    if (!isAIInitiated && message && message !== "__AI_START_CONVERSATION__") {
      chatMessages.push({ role: 'user', content: message });
    }

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
          model: 'gpt-4o-mini', // Reliable model that was working
          messages: chatMessages,
          max_tokens: 150, // Use max_tokens for legacy models
          temperature: 0.7,
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
    let assistantMessage = data.choices[0].message.content;
    const tokensUsed = data.usage?.total_tokens || 0;

    // Count user messages in the conversation to add ending prompt at specific intervals
    const userMessageCount = filteredMessages.filter(m => m.role === 'user').length;
    const isCurrentUserMessage = !isAIInitiated && message && message !== "__AI_START_CONVERSATION__";
    const totalUserMessages = userMessageCount + (isCurrentUserMessage ? 1 : 0);

    // Add conversation ending reminder after 5 and 10 user messages
    if (totalUserMessages === 5 || totalUserMessages === 10) {
      assistantMessage += " Whenever you feel ready to end this conversation, select end conversation.";
      debugInfo.processing_steps.push(`Added ending prompt at message ${totalUserMessages}`);
    }

    debugInfo.processing_steps.push('OpenAI response received successfully');
    debugInfo.metadata.tokens_used = tokensUsed;
    debugInfo.metadata.assistant_message_length = assistantMessage.length;
    debugInfo.metadata.finish_reason = data.choices[0].finish_reason;

    // Analyze message for OCEAN signals and insights (only if we have a real user message)
    let insights: { ocean_signals: any, key_insights: string[], themes: string[], engagement: number } = { 
      ocean_signals: {}, 
      key_insights: [], 
      themes: [], 
      engagement: 0.5 
    };
    if (!isAIInitiated && message && message !== "__AI_START_CONVERSATION__") {
      debugInfo.processing_steps.push('Analyzing message for insights');
      const insightsStartTime = Date.now();
      const analysisResult = analyzeMessageForInsights(message, assistantMessage);
      insights = {
        ocean_signals: analysisResult.ocean_signals || {},
        key_insights: analysisResult.conversation_themes || [],
        themes: analysisResult.conversation_themes || [],
        engagement: analysisResult.engagement_level || 0.5
      };
      debugInfo.timing.insights_analysis_ms = Date.now() - insightsStartTime;
    } else {
      debugInfo.processing_steps.push('Skipping insights analysis for AI-initiated conversation');
    }

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

    console.log('✅ AI Chat processing completed successfully:', {
      conversation_id: conversationId,
      processing_time_ms: debugInfo.timing.total_processing_ms,
      assistant_message_length: assistantMessage.length,
      tokens_used: tokensUsed
    });

    // 6. Return debugging information in response
    return new Response(JSON.stringify({ 
      success: true,
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
    const err = error as Error;
    console.error('❌ Error in ai-chat function:', {
      error: err.message,
      errorType: err.constructor.name,
      conversationId: debugInfo.metadata?.conversation_id || 'unknown',
      userId: debugInfo.metadata?.user_id || 'unknown',
      processingTimeMs: totalTime,
      stepsCompleted: debugInfo.processing_steps?.length || 0,
      lastStep: debugInfo.processing_steps?.[debugInfo.processing_steps.length - 1] || 'none',
      timestamp: new Date().toISOString(),
      stack: err.stack?.split('\n').slice(0, 5).join('\n') // First 5 lines of stack trace
    });

    // Determine error category for better debugging
    let errorCategory = 'unknown';
    let userFriendlyMessage = 'An unexpected error occurred';
    
    if (err.message.includes('Missing required fields')) {
      errorCategory = 'validation';
      userFriendlyMessage = 'Request is missing required information';
    } else if (err.message.includes('OpenAI')) {
      errorCategory = 'openai_api';
      userFriendlyMessage = 'AI service is temporarily unavailable';
    } else if (err.message.includes('Failed to fetch') || err.message.includes('Database')) {
      errorCategory = 'database';
      userFriendlyMessage = 'Database connection issue';
    } else if (err.message.includes('Failed to save')) {
      errorCategory = 'storage';
      userFriendlyMessage = 'Unable to save conversation data';
    }

    return new Response(JSON.stringify({ 
      error: userFriendlyMessage,
      debug: {
        success: false,
        error_category: errorCategory,
        error_message: err.message,
        error_type: err.constructor.name,
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