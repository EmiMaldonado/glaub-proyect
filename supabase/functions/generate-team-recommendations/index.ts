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

    if (existingRec) {
      console.log('Found valid cached recommendations');
      return new Response(JSON.stringify({
        recommendations: existingRec.recommendations,
        teamAnalysis: existingRec.team_analysis,
        oceanDescription: existingRec.ocean_description || "Your team shows a balanced personality profile with diverse strengths and collaborative potential.",
        cached: true,
        generatedAt: existingRec.generated_at
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('No valid cache found, generating new recommendations');

    // Prepare team data for AI analysis
    const teamData = [];
    
    for (const member of teamMembers) {
      try {
        // Fetch conversations and insights for this team member to calculate real OCEAN scores
        const { data: conversations } = await supabase
          .from('conversations')
          .select('ocean_signals, insights')
          .eq('user_id', member.user_id)
          .not('ocean_signals', 'is', null)
          .order('created_at', { ascending: false })
          .limit(10);

        // Calculate OCEAN personality from conversation data
        let personality = {
          openness: 50,
          conscientiousness: 50,
          extraversion: 50,
          agreeableness: 50,
          neuroticism: 50
        };

        if (conversations && conversations.length > 0) {
          // Aggregate OCEAN scores from conversations
          let totalScores = { openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0 };
          let validConversations = 0;

          conversations.forEach(conv => {
            if (conv.ocean_signals && typeof conv.ocean_signals === 'object') {
              const signals = conv.ocean_signals as any;
              if (signals.openness !== undefined) {
                totalScores.openness += Number(signals.openness) || 0;
                totalScores.conscientiousness += Number(signals.conscientiousness) || 0;
                totalScores.extraversion += Number(signals.extraversion) || 0;
                totalScores.agreeableness += Number(signals.agreeableness) || 0;
                totalScores.neuroticism += Number(signals.neuroticism) || 0;
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
          }
        }

        teamData.push({
          name: member.display_name || member.full_name,
          role: member.role,
          personality
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
          }
        });
      }
    }

    // Generate AI recommendations using GPT-5-mini
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
            - ${member.name} (${member.role})
              Personality (OCEAN scores 0-100):
              • Openness: ${member.personality.openness}
              • Conscientiousness: ${member.personality.conscientiousness} 
              • Extraversion: ${member.personality.extraversion}
              • Agreeableness: ${member.personality.agreeableness}
              • Neuroticism: ${member.personality.neuroticism}
            `).join('\n')}

            For the oceanDescription, provide a comprehensive management analysis similar to this example format:
            "Based on the OCEAN analysis of this team, the key takeaway for management is to leverage their strengths while strategically addressing potential weaknesses. [Analyze high/low scores and their implications]. [Discuss collaboration patterns and work preferences]. [Provide specific management strategies]. [Address innovation and risk-taking approaches]. By understanding these personality traits, managers can tailor their leadership style to maximize the team's efficiency, well-being, and overall performance."

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
        oceanDescription: "Your team shows a balanced personality profile with diverse strengths. The mix of personality types creates good potential for collaboration and innovative problem-solving.",
        teamAnalysis: {
          strengths: ["Diverse skill set", "Strong collaboration potential", "Balanced personality mix"],
          challenges: ["Communication styles may vary", "Need structured processes"],
          dynamics: "Team shows good potential with balanced personalities",
          diversity: "Good mix of personality traits across the team"
        },
        recommendations: [
          {
            title: "Establish Communication Guidelines",
            description: "Create clear communication protocols to accommodate different personality types and ensure everyone feels heard",
            priority: "high",
            category: "communication"
          },
          {
            title: "Regular Team Check-ins",
            description: "Schedule weekly team meetings to maintain alignment, address concerns, and leverage diverse perspectives",
            priority: "medium", 
            category: "productivity"
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
      error: error.message || 'Failed to generate team recommendations' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});