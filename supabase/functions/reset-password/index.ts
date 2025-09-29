import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE"  // Add this line
};

interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, new_password }: ResetPasswordRequest = await req.json();

    if (!token || !new_password) {
      return new Response(
        JSON.stringify({ error: "Token and new password are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate password strength
    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters long" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate token and get user ID
    // Get user ID from token
    const { data: userId, error: tokenError } = await supabase.rpc('get_user_id_from_token', {
      token_input: token
    });
    
    console.log('Token lookup result - userId:', userId, 'error:', tokenError);
    
    if (tokenError || !userId) {
      console.error("Token validation error:", tokenError);
      return new Response(
        JSON.stringify({ error: "This reset link is invalid or has expired. Please request a new one." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Update user password
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: new_password
    });

    if (updateError) {
      console.error("Password update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update password" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Mark token as used
    const { error: markUsedError } = await supabase
      .from('password_reset_tokens')
      .update({ is_used: true })
      .eq('token', token);

    if (markUsedError) {
      console.error("Error marking token as used:", markUsedError);
      // Don't fail the request if we can't mark the token as used
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Your password has been updated successfully. You can now log in." 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in reset-password function:", error);
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
