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
    const teamData = teamMembers.map((member: any) => ({
      name: member.display_name || member.full_name,
      role: member.role,
      // Mock OCEAN personality data for demonstration
      personality: {
        openness: Math.round(Math.random() * 30 + 60),
        conscientiousness: Math.round(Math.random() * 25 + 70),
        extraversion: Math.round(Math.random() * 40 + 40),
        agreeableness: Math.round(Math.random() * 20 + 75),
        neuroticism: Math.round(Math.random() * 35 + 25)
      }
    }));

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
              "oceanDescription": "A personalized description of the team's OCEAN personality profile and dynamics (2-3 sentences)",
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

            Provide:
            1. A compelling OCEAN profile description highlighting the team's personality dynamics
            2. Specific team strengths based on personality composition
            3. Actionable leadership recommendations tailored to this exact team
            4. Communication strategies optimized for these personality types
            5. Individual motivation approaches for each personality profile

            Make the recommendations specific and actionable for a manager leading this particular team.`
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