import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's most recent completed conversation
    const { data: conversations, error: conversationError } = await supabase
      .from('conversations')
      .select('id, insights, ocean_signals, created_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);

    if (conversationError) {
      console.error('Error fetching conversations:', conversationError);
      return new Response(JSON.stringify({ error: 'Failed to fetch conversation data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!conversations || conversations.length === 0) {
      // Return empty response if no conversations found
      return new Response(JSON.stringify({
        recommendations: null,
        message: "No conversation data available for generating recommendations"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lastConversation = conversations[0];

    // Get messages from the last conversation
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('content, role')
      .eq('conversation_id', lastConversation.id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch conversation messages' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare conversation context for OpenAI
    const conversationText = messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || '';
    const insights = lastConversation.insights || {};
    const oceanSignals = lastConversation.ocean_signals || {};

    // OpenAI API call
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are an expert career coach and personal development advisor. Based on the user's recent conversation, personality insights, and OCEAN personality signals, generate specific, actionable personal recommendations.

    Analyze the conversation and provide exactly 4 categories with 3 recommendations each:
    1. Personal Development (development)
    2. Wellness & Balance (wellness) 
    3. Skill Building (skills)
    4. Goal Achievement (goals)

    Each recommendation should be:
    - Specific and actionable (not vague advice)
    - Based on insights from the conversation
    - Tailored to the user's personality profile
    - Achievable within 1-4 weeks
    - Focused on professional and personal growth

    Current insights: ${JSON.stringify(insights)}
    OCEAN signals: ${JSON.stringify(oceanSignals)}
    
    Respond in this exact JSON format:
    {
      "development": ["recommendation 1", "recommendation 2", "recommendation 3"],
      "wellness": ["recommendation 1", "recommendation 2", "recommendation 3"],
      "skills": ["recommendation 1", "recommendation 2", "recommendation 3"],
      "goals": ["recommendation 1", "recommendation 2", "recommendation 3"]
    }`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Based on this conversation, please generate personalized recommendations:\n\n${conversationText}` }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', await response.text());
      return new Response(JSON.stringify({ error: 'Failed to generate recommendations' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openAIData = await response.json();
    const generatedContent = openAIData.choices[0].message.content;

    // Parse the JSON response from OpenAI
    let recommendations;
    try {
      recommendations = JSON.parse(generatedContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError, generatedContent);
      // Return fallback recommendations
      recommendations = {
        development: [
          "Schedule daily reflection time based on your conversation patterns",
          "Practice active listening techniques you discussed",
          "Set measurable goals aligned with your career aspirations"
        ],
        wellness: [
          "Implement stress management techniques mentioned in your session",
          "Create work-life balance strategies based on your needs",
          "Develop mindfulness practices for emotional regulation"
        ],
        skills: [
          "Focus on communication skills highlighted in your conversation",
          "Build technical competencies relevant to your goals",
          "Strengthen leadership abilities through practice opportunities"
        ],
        goals: [
          "Create an action plan for objectives discussed in your session",
          "Set up accountability systems for your personal goals",
          "Establish metrics to track progress on your development areas"
        ]
      };
    }

    return new Response(JSON.stringify({ recommendations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-personal-recommendations function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});