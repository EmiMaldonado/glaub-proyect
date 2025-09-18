import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HistoricalDataRequest {
  period: 'last_week' | 'last_month' | 'last_3_months';
  userId: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { period, userId }: HistoricalDataRequest = await req.json();

    if (!userId || !period) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'last_week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last_month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last_3_months':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Fetch conversations from the period
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (conversationsError) {
      console.error('Error fetching conversations:', conversationsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch conversations" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Fetch insights for these conversations
    const conversationIds = conversations?.map(c => c.id) || [];
    const { data: insights, error: insightsError } = await supabase
      .from('key_insights')
      .select('*')
      .in('conversation_id', conversationIds);

    if (insightsError) {
      console.error('Error fetching insights:', insightsError);
    }

    // Generate summary data
    const totalConversations = conversations?.length || 0;
    const totalDuration = conversations?.reduce((sum, conv) => sum + (conv.duration_minutes || 0), 0) || 0;
    const avgDuration = totalConversations > 0 ? Math.round(totalDuration / totalConversations) : 0;

    // Extract all strengths from insights
    const allStrengths = insights?.flatMap(insight => insight.insights || []).slice(0, 5) || [];

    // Extract all recommendations by category
    const developmentRecommendations = insights?.flatMap(insight => insight.next_steps || []).slice(0, 4) || [];
    
    // Generate conversation summary
    const conversationSummary = totalConversations > 0 
      ? `During the ${period.replace('_', ' ')}, you completed ${totalConversations} conversation${totalConversations > 1 ? 's' : ''} with a total duration of ${totalDuration} minutes (avg: ${avgDuration} min per session). Your conversations showed consistent patterns of self-reflection and growth-oriented thinking.`
      : `No conversations completed during the ${period.replace('_', ' ')}. Start a new conversation to begin building your historical insights.`;

    const response = {
      period,
      conversation_summary: conversationSummary,
      total_conversations: totalConversations,
      total_duration: totalDuration,
      avg_duration: avgDuration,
      strengths: allStrengths,
      recommendations: [
        {
          category: "Personal Development",
          items: developmentRecommendations.slice(0, 2)
        },
        {
          category: "Communication & Growth", 
          items: developmentRecommendations.slice(2, 4)
        }
      ]
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in generate-historical-data function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);