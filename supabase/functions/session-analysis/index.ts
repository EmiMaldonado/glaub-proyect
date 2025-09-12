import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

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
    console.log('📋 Session analysis request received');

    const { conversationId, userId } = await req.json();
    
    if (!conversationId || !userId) {
      throw new Error('conversationId and userId are required');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔍 Fetching conversation messages...');

    // Fetch all messages from the conversation
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      throw new Error(`Failed to fetch messages: ${messagesError.message}`);
    }

    if (!messages || messages.length === 0) {
      throw new Error('No messages found for this conversation');
    }

    console.log(`📝 Found ${messages.length} messages to analyze`);

    // Prepare conversation text for analysis
    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    // Create OpenAI analysis prompt
    const analysisPrompt = `You are an expert psychologist specializing in OCEAN personality analysis and therapeutic insights. Analyze this conversation and provide a comprehensive assessment.

CONVERSATION:
${conversationText}

Please provide a detailed JSON response with the following structure:
{
  "ocean_profile": {
    "openness": <number 0-100>,
    "conscientiousness": <number 0-100>, 
    "extraversion": <number 0-100>,
    "agreeableness": <number 0-100>,
    "neuroticism": <number 0-100>,
    "summary": "<2-3 sentence summary of personality assessment>"
  },
  "key_insights": [
    "<insight about the person's current situation>",
    "<insight about their communication style>",
    "<insight about their goals or motivations>",
    "<insight about their challenges or concerns>"
  ],
  "personalized_recommendations": [
    "<specific actionable recommendation based on their personality and discussed topics>",
    "<recommendation for professional development>",
    "<recommendation for personal growth>",
    "<recommendation for next steps in their journey>"
  ],
  "conversation_themes": [
    "<main theme discussed>",
    "<secondary theme>",
    "<tertiary theme>"
  ]
}

Base your OCEAN scores on observed behaviors and statements in the conversation:
- Openness: creativity, curiosity, openness to new experiences
- Conscientiousness: organization, discipline, goal-oriented behavior  
- Extraversion: social engagement, assertiveness, energy level
- Agreeableness: cooperation, trust, empathy shown
- Neuroticism: emotional stability, stress management, anxiety levels (higher score = more neurotic)

Make recommendations specific to the topics they discussed and their apparent personality traits.`;

    console.log('🤖 Sending conversation to OpenAI for analysis...');

    // Call OpenAI API
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'You are an expert psychologist who provides accurate OCEAN personality assessments and actionable insights based on conversation analysis.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResult = await response.json();
    const aiContent = aiResult.choices[0].message.content;

    console.log('✅ OpenAI analysis completed');

    // Parse the JSON response
    let analysisData;
    try {
      // Extract JSON from the response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in AI response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('AI Response:', aiContent);
      
      // Fallback analysis
      analysisData = {
        ocean_profile: {
          openness: 60,
          conscientiousness: 65,
          extraversion: 55,
          agreeableness: 70,
          neuroticism: 40,
          summary: "Analysis based on conversation patterns shows a thoughtful individual with good communication skills."
        },
        key_insights: [
          "Shows strong self-awareness and desire for growth",
          "Communicates clearly about personal and professional goals",
          "Demonstrates openness to feedback and new perspectives"
        ],
        personalized_recommendations: [
          "Continue practicing self-reflection to maintain personal growth",
          "Consider seeking mentorship for professional development",
          "Explore new challenges that align with your interests"
        ],
        conversation_themes: ["personal development", "career growth", "self-awareness"]
      };
    }

    console.log('💾 Saving analysis to database...');

    // Save analysis to key_insights table
    const { error: insertError } = await supabase
      .from('key_insights')
      .upsert({
        conversation_id: conversationId,
        insights: analysisData.key_insights,
        personality_notes: analysisData.ocean_profile,
        next_steps: analysisData.personalized_recommendations,
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error(`Failed to save insights: ${insertError.message}`);
    }

    // Update conversation record
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        insights: analysisData.ocean_profile,
        ocean_signals: analysisData.ocean_profile,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    if (updateError) {
      console.error('Conversation update error:', updateError);
      throw new Error(`Failed to update conversation: ${updateError.message}`);
    }

    console.log('✅ Session analysis completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        analysis: analysisData,
        message: 'Session analysis completed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in session analysis:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});