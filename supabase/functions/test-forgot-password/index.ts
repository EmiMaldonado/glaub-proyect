import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE"
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🧪 Test forgot-password function triggered");
    console.log("📝 Method:", req.method);
    console.log("🔑 RESEND_API_KEY exists:", !!Deno.env.get("RESEND_API_KEY"));
    console.log("🌐 SITE_URL:", Deno.env.get("SITE_URL"));
    
    const body = await req.json().catch(() => ({}));
    console.log("📨 Request body:", JSON.stringify(body));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Test function is working correctly",
        environment: {
          hasResendKey: !!Deno.env.get("RESEND_API_KEY"),
          siteUrl: Deno.env.get("SITE_URL"),
          timestamp: new Date().toISOString()
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("❌ Test function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);