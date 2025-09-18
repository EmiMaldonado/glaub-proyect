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

    // Get sharing preferences for this member and manager
    const { data: sharingPrefs } = await supabase
      .from('sharing_preferences')
      .select('*')
      .eq('user_id', member.user_id || member.id)
      .eq('manager_id', managerId)
      .maybeSingle();

    console.log('Sharing preferences:', sharingPrefs);

    // Calculate OCEAN profile from shared conversations (always available)
    let oceanProfile = null;
    let conversationData = '';
    let insightsData = '';

    // OCEAN profile is always shared for individual analysis
    if (sharingPrefs?.share_conversations) {
      // Get conversation data to calculate OCEAN if sharing is enabled
      const { data: conversations } = await supabase
        .from('conversations')
        .select(`
          id, title, ocean_signals, insights,
          messages:messages(role, content)
        `)
        .eq('user_id', member.user_id || member.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5);

      if (conversations && conversations.length > 0) {
        // Extract conversation content and signals
        conversationData = conversations.map(conv => 
          conv.messages?.map(msg => msg.content).join(' ') || ''
        ).join(' ');

        // Aggregate OCEAN signals
        const signals = conversations.reduce((acc, conv) => {
          if (conv.ocean_signals) {
            Object.keys(conv.ocean_signals).forEach(key => {
              acc[key] = (acc[key] || 0) + (conv.ocean_signals[key] || 0);
            });
          }
          return acc;
        }, {} as any);

        // Calculate percentages
        const totalSignals = Object.values(signals).reduce((sum: number, val: any) => sum + val, 0);
        if (totalSignals > 0) {
          oceanProfile = {
            openness: Math.round((signals.openness || 0) / totalSignals * 100),
            conscientiousness: Math.round((signals.conscientiousness || 0) / totalSignals * 100),
            extraversion: Math.round((signals.extraversion || 0) / totalSignals * 100),
            agreeableness: Math.round((signals.agreeableness || 0) / totalSignals * 100),
            neuroticism: Math.round((signals.neuroticism || 0) / totalSignals * 100)
          };
        }
      }
    }

    // If no conversation data available, use general OCEAN profile
    if (!oceanProfile) {
      oceanProfile = {
        openness: 65,
        conscientiousness: 75,
        extraversion: 55,
        agreeableness: 80,
        neuroticism: 35
      };
    }

    // Get insights if sharing is enabled
    if (sharingPrefs?.share_insights) {
      const { data: insights } = await supabase
        .from('key_insights')
        .select('insights, personality_notes')
        .in('conversation_id', 
          await supabase
            .from('conversations')
            .select('id')
            .eq('user_id', member.user_id || member.id)
            .then(({ data }) => data?.map(c => c.id) || [])
        )
        .limit(10);

      if (insights && insights.length > 0) {
        insightsData = insights.map(i => 
          JSON.stringify(i.insights) + ' ' + JSON.stringify(i.personality_notes)
        ).join(' ');
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
            content: `Analyze this team member and provide personalized management recommendations based on SHARED DATA ONLY:

            Name: ${member.display_name || member.full_name}
            Role: ${member.role}
            
            OCEAN Personality Profile (Always Available - scores 0-100):
            • Openness: ${oceanProfile.openness} - ${oceanProfile.openness > 70 ? 'High (creative, curious, open to new experiences)' : oceanProfile.openness > 40 ? 'Moderate' : 'Low (prefers routine, traditional approaches)'}
            • Conscientiousness: ${oceanProfile.conscientiousness} - ${oceanProfile.conscientiousness > 70 ? 'High (organized, reliable, goal-oriented)' : oceanProfile.conscientiousness > 40 ? 'Moderate' : 'Low (flexible, spontaneous)'}
            • Extraversion: ${oceanProfile.extraversion} - ${oceanProfile.extraversion > 60 ? 'High (outgoing, energetic, social)' : oceanProfile.extraversion > 40 ? 'Moderate' : 'Low (reserved, independent, thoughtful)'}
            • Agreeableness: ${oceanProfile.agreeableness} - ${oceanProfile.agreeableness > 70 ? 'High (cooperative, trusting, helpful)' : oceanProfile.agreeableness > 40 ? 'Moderate' : 'Low (competitive, skeptical, direct)'}
            • Neuroticism: ${oceanProfile.neuroticism} - ${oceanProfile.neuroticism > 60 ? 'High (sensitive to stress, emotional)' : oceanProfile.neuroticism > 40 ? 'Moderate' : 'Low (calm, resilient, stable)'}

            ${sharingPrefs?.share_conversations ? `\nConversation History (SHARED): Available - Use for analysis` : '\nConversation History: NOT SHARED - Do not reference specific conversations'}
            ${sharingPrefs?.share_insights ? `\nTherapeutic Insights (SHARED): Available - Use for analysis` : '\nTherapeutic Insights: NOT SHARED - Do not reference specific insights'}
            ${sharingPrefs?.share_progress ? `\nProgress Reports (SHARED): Available - Use for analysis` : '\nProgress Reports: NOT SHARED - Do not reference progress data'}

            ${conversationData ? `\nConversation Data: ${conversationData.substring(0, 1000)}...` : ''}
            ${insightsData ? `\nInsights Data: ${insightsData.substring(0, 500)}...` : ''}

            IMPORTANT INSTRUCTIONS:
            - Base recommendations ONLY on the OCEAN profile and explicitly shared data
            - If limited data is shared, focus primarily on OCEAN-based strategies
            - Do not make assumptions about unshared data
            - Clearly indicate when recommendations are based on personality vs. shared behavioral data

            Provide specific recommendations for:
            1. How to communicate most effectively based on their personality
            2. What motivates them based on OCEAN traits and shared data
            3. How to provide feedback that matches their personality
            4. Development opportunities aligned with their OCEAN profile
            5. Potential challenges based on personality and how to address them`
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