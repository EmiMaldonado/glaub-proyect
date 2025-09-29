import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2'

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the user's most recent conversation
    const { data: conversations, error: conversationError } = await supabase
      .from('conversations')
      .select(`
        id,
        title,
        insights,
        ocean_signals,
        created_at,
        messages (
          role,
          content,
          created_at
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1);

    if (conversationError) {
      console.error('Error fetching conversations:', conversationError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch conversations' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!conversations || conversations.length === 0) {
      return new Response(
        JSON.stringify({ 
          actionableSteps: {
            summary: "Start your first conversation to receive personalized actionable steps.",
            steps: ["Begin a conversation to explore your thoughts and feelings", "Reflect on your experiences during the session", "Return for follow-up conversations to build on your insights"]
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const latestConversation = conversations[0];
    const messages = latestConversation.messages || [];
    
    // Prepare conversation content for analysis
    const conversationContent = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n');

    const insights = latestConversation.insights || {};
    const oceanSignals = latestConversation.ocean_signals || {};

    // Call OpenAI to generate actionable steps
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert therapeutic coach analyzing conversation data to provide actionable steps for personal growth. Based on the conversation content, insights, and personality signals provided, generate:

1. A brief summary paragraph (2-3 sentences) explaining the key areas for growth identified
2. 3-5 specific, actionable steps the person can take to improve based on their conversation

Format your response as JSON:
{
  "summary": "Brief paragraph explaining key growth areas",
  "steps": ["Step 1", "Step 2", "Step 3", ...]
}

Make the steps:
- Specific and actionable
- Based on actual conversation content
- Focused on personal/professional development
- Achievable within 1-2 weeks
- Personalized to their specific situation`
          },
          {
            role: 'user',
            content: `Analyze this conversation and provide actionable steps:

CONVERSATION:
${conversationContent}

INSIGHTS: ${JSON.stringify(insights)}

PERSONALITY SIGNALS: ${JSON.stringify(oceanSignals)}

Please provide specific, actionable steps this person can take for personal growth based on their conversation.`
          }
        ],
        temperature: 0.7,
        max_tokens: 800
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to generate actionable steps' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    let actionableSteps;

    try {
      actionableSteps = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      // Fallback response
      actionableSteps = {
        summary: "Based on your recent conversation, focus on continued self-reflection and implementing insights from your session.",
        steps: [
          "Schedule regular check-ins with yourself to reflect on progress",
          "Practice the mindfulness techniques discussed in your conversation",
          "Set specific, measurable goals based on your session insights",
          "Consider journaling to track your emotional patterns"
        ]
      };
    }

    return new Response(JSON.stringify({ actionableSteps }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in generate-actionable-steps function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});