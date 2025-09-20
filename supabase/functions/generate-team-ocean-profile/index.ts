import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string;
}

interface PersonalityData {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { managerId, teamMembers } = await req.json();
    
    console.log('🧠 Generating team OCEAN profile for manager:', managerId);
    console.log('👥 Team members:', teamMembers?.length || 0);

    if (!managerId || !teamMembers || teamMembers.length === 0) {
      throw new Error('Manager ID and team members are required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Step 1: Get all conversations for team members
    const teamUserIds = teamMembers.map((member: TeamMember) => member.user_id);
    console.log('🔍 Fetching conversations for user IDs:', teamUserIds);

    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select('id, user_id, ocean_signals')
      .in('user_id', teamUserIds)
      .eq('status', 'completed');

    if (conversationsError) {
      console.error('Error fetching conversations:', conversationsError);
      throw conversationsError;
    }

    console.log('💬 Found conversations:', conversations?.length || 0);

    // Step 2: Get personality insights from key_insights table
    const conversationIds = conversations?.map(c => c.id) || [];
    let personalityInsights: any[] = [];
    
    if (conversationIds.length > 0) {
      const { data: insights, error: insightsError } = await supabase
        .from('key_insights')
        .select('personality_notes, conversation_id')
        .in('conversation_id', conversationIds);

      if (insightsError) {
        console.error('Error fetching insights:', insightsError);
      } else {
        personalityInsights = insights || [];
      }
    }

    console.log('🔬 Found personality insights:', personalityInsights.length);

    // Step 3: Calculate team OCEAN averages
    let teamPersonality: PersonalityData = {
      openness: 0,
      conscientiousness: 0,
      extraversion: 0,
      agreeableness: 0,
      neuroticism: 0
    };

    let validPersonalityCount = 0;

    // Process OCEAN signals from conversations
    conversations?.forEach(conv => {
      if (conv.ocean_signals && typeof conv.ocean_signals === 'object') {
        const signals = conv.ocean_signals as any;
        if (signals.openness !== undefined) {
          teamPersonality.openness += signals.openness || 0;
          teamPersonality.conscientiousness += signals.conscientiousness || 0;
          teamPersonality.extraversion += signals.extraversion || 0;
          teamPersonality.agreeableness += signals.agreeableness || 0;
          teamPersonality.neuroticism += signals.neuroticism || 0;
          validPersonalityCount++;
        }
      }
    });

    // Process personality notes from insights
    personalityInsights.forEach(insight => {
      if (insight.personality_notes && typeof insight.personality_notes === 'object') {
        const notes = insight.personality_notes as any;
        if (notes.openness !== undefined) {
          teamPersonality.openness += notes.openness || 0;
          teamPersonality.conscientiousness += notes.conscientiousness || 0;
          teamPersonality.extraversion += notes.extraversion || 0;
          teamPersonality.agreeableness += notes.agreeableness || 0;
          teamPersonality.neuroticism += notes.neuroticism || 0;
          validPersonalityCount++;
        }
      }
    });

    // Calculate averages
    if (validPersonalityCount > 0) {
      teamPersonality.openness = Math.round(teamPersonality.openness / validPersonalityCount);
      teamPersonality.conscientiousness = Math.round(teamPersonality.conscientiousness / validPersonalityCount);
      teamPersonality.extraversion = Math.round(teamPersonality.extraversion / validPersonalityCount);
      teamPersonality.agreeableness = Math.round(teamPersonality.agreeableness / validPersonalityCount);
      teamPersonality.neuroticism = Math.round(teamPersonality.neuroticism / validPersonalityCount);
    } else {
      // Fallback to reasonable defaults if no data available
      teamPersonality = {
        openness: 65,
        conscientiousness: 72,
        extraversion: 58,
        agreeableness: 78,
        neuroticism: 42
      };
    }

    console.log('📊 Calculated team personality:', teamPersonality);
    console.log('🔢 Based on', validPersonalityCount, 'data points');

    // Step 4: Generate AI-powered team description using OpenAI
    const teamMemberNames = teamMembers.map((member: TeamMember) => 
      member.display_name || member.full_name
    ).join(', ');

    const aiPrompt = `
    As an expert organizational psychologist, analyze this team's personality profile based on the OCEAN model.

    Team Information:
    - Team Size: ${teamMembers.length} members
    - Team Members: ${teamMemberNames}
    - Total Conversations Analyzed: ${conversations?.length || 0}
    - Personality Data Points: ${validPersonalityCount}

    OCEAN Personality Averages:
    - Openness: ${teamPersonality.openness}%
    - Conscientiousness: ${teamPersonality.conscientiousness}%
    - Extraversion: ${teamPersonality.extraversion}%
    - Agreeableness: ${teamPersonality.agreeableness}%
    - Neuroticism: ${teamPersonality.neuroticism}%

    Provide a comprehensive team personality analysis (200-250 words) that:
    1. Describes the team's collective personality strengths
    2. Identifies potential collaboration patterns
    3. Suggests leadership approaches that would work well
    4. Highlights any notable personality traits that could impact team dynamics
    5. Provides actionable insights for team optimization

    Write in a professional, insightful tone suitable for a manager dashboard.
    `;

    console.log('🤖 Calling OpenAI for team analysis...');

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are an expert organizational psychologist specializing in team dynamics and personality analysis using the OCEAN model.'
          },
          {
            role: 'user',
            content: aiPrompt
          }
        ],
        max_completion_tokens: 400,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const aiResult = await openAIResponse.json();
    const teamDescription = aiResult.choices[0].message.content;

    console.log('✅ Generated team description length:', teamDescription.length);

    return new Response(JSON.stringify({
      success: true,
      personalityData: teamPersonality,
      teamDescription: teamDescription,
      metadata: {
        teamSize: teamMembers.length,
        conversationsAnalyzed: conversations?.length || 0,
        personalityDataPoints: validPersonalityCount,
        generatedAt: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in generate-team-ocean-profile:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      personalityData: {
        openness: 65,
        conscientiousness: 72,
        extraversion: 58,
        agreeableness: 78,
        neuroticism: 42
      },
      teamDescription: "Unable to generate team personality analysis at this time. Please ensure team members have completed conversations to provide personality data."
    }), {
      status: 200, // Return 200 with fallback data instead of error
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});