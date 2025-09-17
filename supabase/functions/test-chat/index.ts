import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 Testing AI Chat Function');
    
    // Test the ai-chat function directly
    const testMessage = {
      message: "Hello, this is a test message",
      conversationId: "test-conversation-id",
      userId: "test-user-id",
      isFirstMessage: true
    };

    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage)
    });

    const responseData = await response.text();
    console.log('AI Chat Response Status:', response.status);
    console.log('AI Chat Response Data:', responseData);

    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch {
      parsedData = { raw_response: responseData };
    }

    return new Response(JSON.stringify({
      test_status: response.ok ? 'SUCCESS' : 'FAILED',
      status_code: response.status,
      response_data: parsedData,
      test_message: testMessage,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    return new Response(JSON.stringify({
      test_status: 'ERROR',
      error: error.message,
      error_type: error.constructor.name,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});