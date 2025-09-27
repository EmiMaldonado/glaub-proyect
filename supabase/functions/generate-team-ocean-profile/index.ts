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
    }
    // If no valid personality data, keep values at 0 (initialized above)

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

    Provide exactly two sections in your response:

    **Team Profile Summary:**
    Write one comprehensive paragraph describing the overall character of this team. What are its collective strengths? What are its potential blind spots or conflicts? How does the mix of different roles (technical, creative, business, strategic) create a unique dynamic? Specifically address how this professional diversity influences group motivation—for example, does it foster innovation through different perspectives, or could it lead to misalignment if not managed correctly?

    **Tailored Leadership Strategies:**
    Based on the team's profile, provide concrete leadership strategies that would be most effective for this specific group. Answer: How should a leader communicate to motivate such a diverse team? What type of environment and processes should be established to ensure all personality types and roles feel valued and productive? How can a leader bridge the motivational gaps between, for example, a data-driven scientist and a results-oriented salesperson? Provide actionable recommendations.

    Format your response with clear section headers and write in a professional, insightful tone suitable for a manager dashboard.
    `;

    console.log('🤖 Calling OpenAI for team analysis...');
    console.log('📝 Prompt length:', aiPrompt.length);
    console.log('🔑 OpenAI key status:', openAIApiKey ? 'Present' : 'Missing');

    const openAIPayload = {
      model: 'gpt-4o-mini',
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
      max_tokens: 800,
      temperature: 0.7,
    };

    console.log('🔄 Making OpenAI request with model:', openAIPayload.model);
    console.log('💰 Request tokens estimated:', Math.ceil(aiPrompt.length / 4));

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openAIPayload),
    });

    console.log('📡 OpenAI response status:', openAIResponse.status);
    console.log('📡 OpenAI response headers:', Object.fromEntries(openAIResponse.headers.entries()));

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('❌ OpenAI API error response:', errorText);
      console.error('❌ OpenAI API status:', openAIResponse.status);
      throw new Error(`OpenAI API error: ${openAIResponse.status} - ${errorText}`);
    }

    const aiResult = await openAIResponse.json();
    console.log('🔍 OpenAI full response structure:', {
      hasChoices: !!aiResult.choices,
      choicesLength: aiResult.choices?.length || 0,
      firstChoiceStructure: aiResult.choices?.[0] ? Object.keys(aiResult.choices[0]) : 'N/A',
      usage: aiResult.usage,
      error: aiResult.error
    });
    
    if (aiResult.error) {
      console.error('❌ OpenAI returned error in response:', aiResult.error);
      throw new Error(`OpenAI API error: ${aiResult.error.message || 'Unknown error'}`);
    }

    if (!aiResult.choices || aiResult.choices.length === 0) {
      console.error('❌ OpenAI returned no choices in response');
      throw new Error('OpenAI API returned no choices');
    }

    const teamDescription = aiResult.choices[0]?.message?.content || '';
    console.log('✅ Generated team description length:', teamDescription.length);
    console.log('📄 Team description preview:', teamDescription.substring(0, 200) + '...');
    
    if (teamDescription.length === 0) {
      console.error('❌ OpenAI returned empty content');
      console.log('🔍 Full message object:', JSON.stringify(aiResult.choices[0]?.message, null, 2));
    }

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
    console.error('❌ Error in generate-team-ocean-profile:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Check if it's an OpenAI-specific error
    const isOpenAIError = error.message.includes('OpenAI API error');
    const errorMessage = isOpenAIError 
      ? `OpenAI service unavailable: ${error.message}` 
      : `Analysis generation failed: ${error.message}`;
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      personalityData: {
        openness: 0,
        conscientiousness: 0,
        extraversion: 0,
        agreeableness: 0,
        neuroticism: 0
      },
      teamDescription: isOpenAIError 
        ? "The AI analysis service is temporarily unavailable. The personality data shown is based on your team's conversation patterns. Please try refreshing in a moment."
        : "Unable to generate team personality analysis at this time. Please ensure team members have completed conversations to provide personality data."
    }), {
      status: 200, // Return 200 with fallback data instead of error
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});