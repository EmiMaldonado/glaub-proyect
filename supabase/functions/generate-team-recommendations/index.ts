import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { managerId, teamMembers } = await req.json();
    
    console.log('Generating team recommendations for manager:', managerId);
    console.log('Team members count:', teamMembers?.length);

    if (!managerId || !teamMembers || teamMembers.length === 0) {
      throw new Error('Manager ID and team members are required');
    }

    // Generate team hash for cache invalidation
    const teamHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(
        teamMembers.map((m: any) => m.id).sort().join('|')
      )
    );
    const teamHashString = Array.from(new Uint8Array(teamHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    console.log('Team hash generated:', teamHashString);

    // Check for existing valid recommendations
    const { data: existingRec } = await supabase
      .from('manager_recommendations')
      .select('*')
      .eq('manager_id', managerId)
      .eq('team_hash', teamHashString)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingRec && existingRec.ocean_description) {
      console.log('Found valid cached recommendations with ocean description');
      return new Response(JSON.stringify({
        recommendations: existingRec.recommendations,
        teamAnalysis: existingRec.team_analysis,
        oceanDescription: existingRec.ocean_description,
        cached: true,
        generatedAt: existingRec.generated_at
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If cache exists but no ocean description, regenerate
    if (existingRec && !existingRec.ocean_description) {
      console.log('Cache exists but missing ocean description, regenerating...');
    }

    // Clear old cache entries for this manager (force regeneration with new logic)
    console.log('Forcing cache regeneration by clearing existing recommendations');
    await supabase
      .from('manager_recommendations')
      .delete()
      .eq('manager_id', managerId);

    console.log('Cache cleared, proceeding with fresh generation');

    // Prepare team data for AI analysis
    const teamData = [];
    
    for (const member of teamMembers) {
      try {
        console.log(`Processing member: ${member.display_name || member.full_name} (${member.user_id})`);
        
        // Fetch conversations and insights for this team member to calculate real OCEAN scores
        const { data: conversations, error: convError } = await supabase
          .from('conversations')
          .select('ocean_signals, insights')
          .eq('user_id', member.user_id)
          .not('ocean_signals', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10);

        if (convError) {
          console.error(`Error fetching conversations for ${member.user_id}:`, convError);
        }

        console.log(`Found ${conversations?.length || 0} conversations for ${member.display_name || member.full_name}`);

        // Calculate OCEAN personality from conversation data
        let personality = {
          openness: 50,
          conscientiousness: 50,
          extraversion: 50,
          agreeableness: 50,
          neuroticism: 50
        };

        if (conversations && conversations.length > 0) {
          console.log(`Processing ${conversations.length} conversations for member: ${member.display_name || member.full_name}`);
          
          // Aggregate OCEAN scores from conversations
          let totalScores = { openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0 };
          let validConversations = 0;

          conversations.forEach((conv, index) => {
            if (conv.ocean_signals && typeof conv.ocean_signals === 'object') {
              const signals = conv.ocean_signals as any;
              if (signals.openness !== undefined) {
                // Normalize OCEAN values: detect if they're on 0-1 scale or 0-100 scale
                const normalizeOceanValue = (value: number): number => {
                  const numValue = Number(value) || 0;
                  // If value is between 0-1, convert to 0-100 scale
                  if (numValue > 0 && numValue <= 1) {
                    return Math.round(numValue * 100);
                  }
                  // If value is already 0-100 scale or invalid, return as is (clamped to 0-100)
                  return Math.max(0, Math.min(100, Math.round(numValue)));
                };

                const normalizedScores = {
                  openness: normalizeOceanValue(signals.openness),
                  conscientiousness: normalizeOceanValue(signals.conscientiousness),
                  extraversion: normalizeOceanValue(signals.extraversion),
                  agreeableness: normalizeOceanValue(signals.agreeableness),
                  neuroticism: normalizeOceanValue(signals.neuroticism)
                };

                console.log(`Conversation ${index + 1} OCEAN scores:`, {
                  raw: {
                    openness: signals.openness,
                    conscientiousness: signals.conscientiousness,
                    extraversion: signals.extraversion,
                    agreeableness: signals.agreeableness,
                    neuroticism: signals.neuroticism
                  },
                  normalized: normalizedScores
                });

                totalScores.openness += normalizedScores.openness;
                totalScores.conscientiousness += normalizedScores.conscientiousness;
                totalScores.extraversion += normalizedScores.extraversion;
                totalScores.agreeableness += normalizedScores.agreeableness;
                totalScores.neuroticism += normalizedScores.neuroticism;
                validConversations++;
              }
            }
          });

          // Calculate averages if we have valid data
          if (validConversations > 0) {
            personality = {
              openness: Math.round(totalScores.openness / validConversations),
              conscientiousness: Math.round(totalScores.conscientiousness / validConversations),
              extraversion: Math.round(totalScores.extraversion / validConversations),
              agreeableness: Math.round(totalScores.agreeableness / validConversations),
              neuroticism: Math.round(totalScores.neuroticism / validConversations)
            };
            
            console.log(`Final averaged OCEAN scores for ${member.display_name || member.full_name}:`, personality);
            console.log(`Based on ${validConversations} valid conversations out of ${conversations.length} total`);
          }
        }

        teamData.push({
          name: member.display_name || member.full_name,
          role: member.role,
          personality,
          hasConversationData: (conversations?.length || 0) > 0
        });
      } catch (memberError) {
        console.error(`Error processing member ${member.id}:`, memberError);
        // Add member with default personality if error occurs
        teamData.push({
          name: member.display_name || member.full_name,
          role: member.role,
          personality: {
            openness: 50,
            conscientiousness: 50,
            extraversion: 50,
            agreeableness: 50,
            neuroticism: 50
          },
          hasConversationData: false
        });
      }
    }

    // Generate AI recommendations using GPT-5-mini
    const promptContent = `Analyze this team of ${teamData.length} members and provide personalized management recommendations:

${teamData.map(member => `
- ${member.name} (${member.role}) ${!member.hasConversationData ? '[Using baseline OCEAN profile - limited data]' : '[Based on conversation analysis]'}
  Personality (OCEAN scores 0-100):
  • Openness: ${member.personality.openness}
  • Conscientiousness: ${member.personality.conscientiousness} 
  • Extraversion: ${member.personality.extraversion}
  • Agreeableness: ${member.personality.agreeableness}
  • Neuroticism: ${member.personality.neuroticism}
`).join('\n')}

${teamData.every(m => !m.hasConversationData) ? 
  'NOTE: This team analysis is based on baseline OCEAN profiles as no conversation data is available yet. Generate a description that indicates limited information is available but still provides general guidance based on the baseline personality scores.' : 
  'Team analysis includes both conversation-based and baseline OCEAN profiles where indicated.'
}

For the oceanDescription, provide a comprehensive management analysis similar to this example format:
"Based on the OCEAN analysis of this team, the key takeaway for management is to leverage their strengths while strategically addressing potential weaknesses. [Analyze high/low scores and their implications]. [Discuss collaboration patterns and work preferences]. [Provide specific management strategies]. [Address innovation and risk-taking approaches]. By understanding these personality traits, managers can tailor their leadership style to maximize the team's efficiency, well-being, and overall performance."

${teamData.every(m => !m.hasConversationData) ? 
  'If all team members have baseline profiles (no conversation data), start the oceanDescription with: "No comprehensive information is available from the team yet, however based on baseline personality profiles..." and provide general guidance.' : 
  'Provide detailed, data-driven insights for members with conversation analysis.'
}

Provide:
1. A detailed OCEAN profile analysis with specific management insights (4-6 sentences)
2. Concrete team strengths based on personality composition
3. Actionable leadership recommendations tailored to this exact team
4. Communication and work environment strategies optimized for these personality types
5. Specific approaches for fostering innovation while respecting team preferences

Make all recommendations specific and actionable for a manager leading this particular team.`;

    console.log('=== PROMPT BEING SENT TO OPENAI ===');
    console.log(promptContent);
    console.log('=== END PROMPT ===');

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          {
            role: 'system',
            content: `You are an expert team management consultant specializing in personality-based team optimization. 
            Analyze the team composition and provide actionable management recommendations.
            
            Return your response as a JSON object with this exact structure:
            {
              "oceanDescription": "A comprehensive management-focused analysis of the team's OCEAN personality profile. This should be a detailed paragraph (3-5 sentences) that provides specific insights about the team's personality composition, their strengths and potential challenges, and concrete guidance for managers on how to leverage their personality traits for optimal performance. Include specific recommendations about work styles, communication preferences, innovation approaches, and leadership strategies tailored to this exact team composition.",
              "teamAnalysis": {
                "strengths": ["strength1", "strength2", "strength3"],
                "challenges": ["challenge1", "challenge2"],
                "dynamics": "Overall team dynamic assessment",
                "diversity": "Personality diversity analysis"
              },
              "recommendations": [
                {
                  "title": "Recommendation Title",
                  "description": "Detailed actionable description for the manager",
                  "priority": "high|medium|low",
                  "category": "communication|productivity|development|wellbeing"
                }
              ]
            }`
          },
          {
            role: 'user',
            content: `Analyze this team of ${teamData.length} members and provide personalized management recommendations:

            ${teamData.map(member => `
            - ${member.name} (${member.role}) ${!member.hasConversationData ? '[Using baseline OCEAN profile - limited data]' : '[Based on conversation analysis]'}
              Personality (OCEAN scores 0-100):
              • Openness: ${member.personality.openness}
              • Conscientiousness: ${member.personality.conscientiousness} 
              • Extraversion: ${member.personality.extraversion}
              • Agreeableness: ${member.personality.agreeableness}
              • Neuroticism: ${member.personality.neuroticism}
            `).join('\n')}

            ${teamData.every(m => !m.hasConversationData) ? 
              'NOTE: This team analysis is based on baseline OCEAN profiles as no conversation data is available yet. Generate a description that indicates limited information is available but still provides general guidance based on the baseline personality scores.' : 
              'Team analysis includes both conversation-based and baseline OCEAN profiles where indicated.'
            }

            For the oceanDescription, provide a comprehensive management analysis similar to this example format:
            "Based on the OCEAN analysis of this team, the key takeaway for management is to leverage their strengths while strategically addressing potential weaknesses. [Analyze high/low scores and their implications]. [Discuss collaboration patterns and work preferences]. [Provide specific management strategies]. [Address innovation and risk-taking approaches]. By understanding these personality traits, managers can tailor their leadership style to maximize the team's efficiency, well-being, and overall performance."

            ${teamData.every(m => !m.hasConversationData) ? 
              'If all team members have baseline profiles (no conversation data), start the oceanDescription with: "No comprehensive information is available from the team yet, however based on baseline personality profiles..." and provide general guidance.' : 
              'Provide detailed, data-driven insights for members with conversation analysis.'
            }

            Provide:
            1. A detailed OCEAN profile analysis with specific management insights (4-6 sentences)
            2. Concrete team strengths based on personality composition
            3. Actionable leadership recommendations tailored to this exact team
            4. Communication and work environment strategies optimized for these personality types
            5. Specific approaches for fostering innovation while respecting team preferences

            Make all recommendations specific and actionable for a manager leading this particular team.`
          }
        ],
        max_completion_tokens: 1500
      }),
    });

    if (!openAIResponse.ok) {
      const error = await openAIResponse.json();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const aiResult = await openAIResponse.json();
    const content = aiResult.choices[0].message.content;
    
    console.log('AI response received:', content.substring(0, 200) + '...');

    let parsedResult;
    try {
      parsedResult = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback response if parsing fails
      parsedResult = {
        oceanDescription: "No information available from the team. Unable to generate personality analysis at this time.",
        teamAnalysis: {
          strengths: ["Team composition pending analysis"],
          challenges: ["Insufficient data for analysis"],
          dynamics: "Team analysis unavailable",
          diversity: "Personality diversity analysis pending"
        },
        recommendations: [
          {
            title: "Complete Team Setup",
            description: "Ensure all team members complete their onboarding to enable personality analysis",
            priority: "high",
            category: "development"
          }
        ]
      };
    }

    // Cache the recommendations
    const { error: cacheError } = await supabase
      .from('manager_recommendations')
      .upsert({
        manager_id: managerId,
        team_hash: teamHashString,
        recommendations: parsedResult.recommendations,
        team_analysis: parsedResult.teamAnalysis,
        ocean_description: parsedResult.oceanDescription,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      });

    if (cacheError) {
      console.error('Failed to cache recommendations:', cacheError);
      // Don't throw error, just log it
    } else {
      console.log('Recommendations cached successfully');
    }

    return new Response(JSON.stringify({
      recommendations: parsedResult.recommendations,
      teamAnalysis: parsedResult.teamAnalysis,
      oceanDescription: parsedResult.oceanDescription,
      cached: false,
      generatedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating team recommendations:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error).message || 'Failed to generate team recommendations' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});