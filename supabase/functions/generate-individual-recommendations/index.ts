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
    const { managerId, member } = await req.json();
    
    console.log('Generating individual recommendations for:', member?.display_name || member?.full_name);

    if (!managerId || !member) {
      throw new Error('Manager ID and member data are required');
    }

    // Generate member hash for cache invalidation
    const memberData = `${member.id}|${member.display_name}|${member.full_name}|${member.role}`;
    const memberHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(memberData)
    );
    const memberHashString = Array.from(new Uint8Array(memberHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    console.log('Member hash generated:', memberHashString);

    // Check for existing valid recommendations
    const { data: existingRec } = await supabase
      .from('individual_recommendations')
      .select('*')
      .eq('manager_id', managerId)
      .eq('member_id', member.id)
      .eq('member_hash', memberHashString)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingRec) {
      console.log('Found valid cached individual recommendations');
      return new Response(JSON.stringify({
        recommendations: existingRec.recommendations,
        leadershipTips: existingRec.leadership_tips,
        memberAnalysis: existingRec.member_analysis,
        cached: true,
        generatedAt: existingRec.generated_at
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('No valid cache found, generating new individual recommendations');

    // Mock personality data for demonstration
    const personality = {
      openness: Math.round(Math.random() * 30 + 60),
      conscientiousness: Math.round(Math.random() * 25 + 70),
      extraversion: Math.round(Math.random() * 40 + 40),
      agreeableness: Math.round(Math.random() * 20 + 75),
      neuroticism: Math.round(Math.random() * 35 + 25)
    };

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
            content: `You are an expert leadership coach specializing in personality-based individual development. 
            Analyze the individual's profile and provide personalized management and development recommendations.
            
            Return your response as a JSON object with this exact structure:
            {
              "memberAnalysis": {
                "strengths": ["strength1", "strength2"],
                "growthAreas": ["area1", "area2"],
                "communicationStyle": "Communication style description",
                "motivationFactors": ["factor1", "factor2"]
              },
              "recommendations": [
                {
                  "title": "Recommendation Title",
                  "description": "Detailed description",
                  "priority": "high|medium|low",
                  "category": "communication|development|motivation|performance"
                }
              ],
              "leadershipTips": [
                {
                  "situation": "Situation description",
                  "approach": "How to approach this person in this situation",
                  "avoid": "What to avoid"
                }
              ]
            }`
          },
          {
            role: 'user',
            content: `Analyze this team member and provide personalized management recommendations:

            Name: ${member.display_name || member.full_name}
            Role: ${member.role}
            
            Personality Profile (OCEAN scores 0-100):
            • Openness: ${personality.openness} - ${personality.openness > 70 ? 'High (creative, curious, open to new experiences)' : personality.openness > 40 ? 'Moderate' : 'Low (prefers routine, traditional approaches)'}
            • Conscientiousness: ${personality.conscientiousness} - ${personality.conscientiousness > 70 ? 'High (organized, reliable, goal-oriented)' : personality.conscientiousness > 40 ? 'Moderate' : 'Low (flexible, spontaneous)'}
            • Extraversion: ${personality.extraversion} - ${personality.extraversion > 60 ? 'High (outgoing, energetic, social)' : personality.extraversion > 40 ? 'Moderate' : 'Low (reserved, independent, thoughtful)'}
            • Agreeableness: ${personality.agreeableness} - ${personality.agreeableness > 70 ? 'High (cooperative, trusting, helpful)' : personality.agreeableness > 40 ? 'Moderate' : 'Low (competitive, skeptical, direct)'}
            • Neuroticism: ${personality.neuroticism} - ${personality.neuroticism > 60 ? 'High (sensitive to stress, emotional)' : personality.neuroticism > 40 ? 'Moderate' : 'Low (calm, resilient, stable)'}

            Provide specific recommendations for:
            1. How to communicate most effectively with this person
            2. What motivates them and drives performance  
            3. How to provide feedback and coaching
            4. Development opportunities that match their personality
            5. Potential challenges and how to address them`
          }
        ],
        max_completion_tokens: 1200,
        temperature: 0.7
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
        memberAnalysis: {
          strengths: ["Reliable team player", "Strong work ethic"],
          growthAreas: ["Leadership skills", "Public speaking"],
          communicationStyle: "Direct and clear communication works best",
          motivationFactors: ["Recognition", "Professional growth", "Autonomy"]
        },
        recommendations: [
          {
            title: "Provide Regular Feedback",
            description: "Schedule regular one-on-one meetings to provide constructive feedback and recognition",
            priority: "high",
            category: "communication"
          },
          {
            title: "Development Opportunities",
            description: "Identify skill development opportunities that align with their career goals",
            priority: "medium",
            category: "development"
          }
        ],
        leadershipTips: [
          {
            situation: "When assigning new projects",
            approach: "Clearly outline expectations and provide necessary resources",
            avoid: "Micromanaging or being overly vague about requirements"
          }
        ]
      };
    }

    // Cache the recommendations
    const { error: cacheError } = await supabase
      .from('individual_recommendations')
      .upsert({
        manager_id: managerId,
        member_id: member.id,
        member_hash: memberHashString,
        recommendations: parsedResult.recommendations,
        leadership_tips: parsedResult.leadershipTips,
        member_analysis: parsedResult.memberAnalysis,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      });

    if (cacheError) {
      console.error('Failed to cache individual recommendations:', cacheError);
      // Don't throw error, just log it
    } else {
      console.log('Individual recommendations cached successfully');
    }

    return new Response(JSON.stringify({
      recommendations: parsedResult.recommendations,
      leadershipTips: parsedResult.leadershipTips,
      memberAnalysis: parsedResult.memberAnalysis,
      cached: false,
      generatedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating individual recommendations:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to generate individual recommendations' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});