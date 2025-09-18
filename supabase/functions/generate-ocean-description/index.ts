import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

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
    const { oceanProfile, userProfile } = await req.json();

    if (!oceanProfile) {
      throw new Error('OCEAN profile data is required');
    }

    // Create a detailed prompt for generating personalized OCEAN description
    const prompt = `You are a professional personality analyst. Generate a personalized and insightful description for a person based on their OCEAN personality profile scores.

Person details:
- Name: ${userProfile?.full_name || userProfile?.display_name || 'User'}
- Job Position: ${userProfile?.job_position || 'Professional'}

OCEAN Profile Scores (0-100%):
- Openness: ${oceanProfile.openness}%
- Conscientiousness: ${oceanProfile.conscientiousness}%
- Extraversion: ${oceanProfile.extraversion}%
- Agreeableness: ${oceanProfile.agreeableness}%
- Neuroticism/Stability: ${oceanProfile.neuroticism}% neuroticism (${100 - oceanProfile.neuroticism}% stability)

Generate a comprehensive 4-5 sentence paragraph that:
1. Explains what these specific scores reveal about their personality
2. Describes how these dimensions work together in their unique profile
3. Relates to their professional context and daily life
4. Uses an engaging, warm but professional tone
5. Focuses on strengths and growth opportunities
6. NEVER mentions age, gender, or any demographic characteristics
7. Focuses purely on personality traits and professional behavior patterns

Make it personal, specific to their scores, and actionable. Avoid generic statements and demographic references.`;

    console.log('Generating OCEAN description for user:', userProfile?.full_name || 'Unknown');
    console.log('OCEAN scores:', oceanProfile);

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
            content: 'You are an expert personality psychologist who creates insightful, personalized descriptions based on OCEAN personality assessments. Your descriptions are warm, professional, and actionable.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedDescription = data.choices[0].message.content;

    console.log('Generated description successfully');

    return new Response(JSON.stringify({ 
      description: generatedDescription,
      success: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-ocean-description function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});