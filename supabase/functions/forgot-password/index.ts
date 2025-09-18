import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ForgotPasswordRequest {
  email: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: ForgotPasswordRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // For security, we always return success regardless of whether the user exists
    // This prevents email enumeration attacks
    
    let userExists = false;
    let userId = null;

    try {
      // Check if a profile exists for this email by looking at auth users
      // We'll use a more secure approach by directly querying for auth users
      const { data: users, error: listError } = await supabase.auth.admin.listUsers();
      
      if (!listError && users && users.users) {
        const foundUser = users.users.find(user => user.email === email);
        if (foundUser) {
          userExists = true;
          userId = foundUser.id;
        }
      }
    } catch (error) {
      console.log("Error checking user existence:", error);
      // Continue anyway for security
    }

    // Generate a secure token regardless of user existence
    const { data: token, error: tokenError } = await supabase.rpc('generate_reset_token');
    
    if (tokenError || !token) {
      console.error("Error generating reset token:", tokenError);
      throw new Error("Failed to generate reset token");
    }

    // Only store token if user exists
    if (userExists && userId) {
      const { error: storeError } = await supabase
        .from('password_reset_tokens')
        .insert({
          user_id: userId,
          token: token,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
          is_used: false
        });

      if (storeError) {
        console.error("Error storing reset token:", storeError);
        // Don't throw error here for security
      }
    }

    // Always try to send email (even if user doesn't exist, for security)
    try {
      const baseUrl = Deno.env.get("SITE_URL") || "https://f95a31b2-0a27-4418-b650-07505c789eed.sandbox.lovable.dev";
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      const emailResponse = await resend.emails.send({
        from: "Glaub <onboarding@resend.dev>",
        to: [email],
        subject: "Reset your password",
        html: `
          <h2>Password Reset Request</h2>
          <p>You requested to reset your password. Click the link below to create a new password:</p>
          <p><a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a></p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p>${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
        `,
      });

      if (emailResponse.error) {
        console.error("Error sending email:", emailResponse.error);
        // Don't throw for security reasons
      } else {
        console.log("Password reset email sent successfully via Resend");
      }
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Don't throw for security reasons
    }

    // Always return success for security
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "If an account with that email exists, a reset link has been sent." 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in forgot-password function:", error);
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