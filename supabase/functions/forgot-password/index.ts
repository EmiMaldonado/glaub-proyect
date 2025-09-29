import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { PasswordResetEmail } from './_templates/password-reset-email.tsx';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE"
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
  const startTime = Date.now();
  console.log(`🚀 Password reset request started at ${new Date().toISOString()}`);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: ForgotPasswordRequest = await req.json();

    console.log(`📧 Processing password reset for: ${email.substring(0, 3)}***@${email.split('@')[1]}`);
    console.log("🔑 RESEND_API_KEY status:", Deno.env.get("RESEND_API_KEY") ? "Present" : "Missing");
    console.log("🌐 SITE_URL:", Deno.env.get("SITE_URL"));

    if (!email) {
      console.error("❌ Email validation failed: No email provided");
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("❌ Email validation failed: Invalid format");
      return new Response(
        JSON.stringify({ error: "Valid email address is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`📧 Processing password reset for: ${email.substring(0, 3)}***@${email.split('@')[1]}`);
    
    let userExists = false;
    let userId = null;

    // OPTIMIZATION: Use efficient user lookup instead of listing all users
    try {
      const lookupStart = Date.now();
      
      // First check profiles table (much faster than listing all auth users)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', email)
        .single();

      console.log("👤 Profile lookup result:", profile ? "Found" : "Not found", profileError?.message || "");

      if (!profileError && profile) {
        userExists = true;
        userId = profile.user_id;
        console.log(`✅ User found via profiles table in ${Date.now() - lookupStart}ms`);
      } else {
        // Fallback: List all users and find by email
        console.log("🔍 Fallback: Checking auth users...");
        const { data: allUsers, error: listError } = await supabase.auth.admin.listUsers();
        if (!listError && allUsers?.users) {
          const authUser = allUsers.users.find((u: any) => u.email === email);
          if (authUser) {
            userExists = true;
            userId = authUser.id;
            console.log(`✅ User found via auth lookup in ${Date.now() - lookupStart}ms`);
          }
        } else {
          console.log(`ℹ️ User not found (security: continuing anyway) in ${Date.now() - lookupStart}ms`);
        }
      }
    } catch (error) {
      console.error("⚠️ Error during user lookup:", error);
      // Continue anyway for security
    }

    // Generate token with timeout
    const tokenStart = Date.now();
    const tokenPromise = supabase.rpc('generate_reset_token');
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Token generation timeout')), 5000)
    );
    
    let token: string;
    try {
      const { data, error: tokenError } = await Promise.race([tokenPromise, timeoutPromise]) as any;
      
      if (tokenError || !data) {
        console.error("❌ Token generation failed:", tokenError);
        throw new Error("Failed to generate reset token");
      }
      token = data;
      console.log(`🔑 Token generated in ${Date.now() - tokenStart}ms`);
    } catch (error) {
      console.error("❌ Token generation error or timeout:", error);
      throw new Error("Token generation failed");
    }

    // Store token only if user exists (with timeout)
    if (userExists && userId) {
      const storeStart = Date.now();
      const storePromise = supabase
        .from('password_reset_tokens')
        .insert({
          user_id: userId,
          token: token,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          is_used: false
        });
      
      const storeTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Token storage timeout')), 5000)
      );

      try {
        await Promise.race([storePromise, storeTimeoutPromise]);
        console.log(`💾 Token stored in ${Date.now() - storeStart}ms`);
      } catch (error) {
        console.error("⚠️ Token storage failed or timeout:", error);
        // Continue for security (don't fail the whole operation)
      }
    }

    // Send email with custom template and timeout
    const emailStart = Date.now();
    
    // Use correct domain for reset URL
    const siteUrl = Deno.env.get("SITE_URL") || "https://www.glaubinsights.org";
    const resetUrl = `${siteUrl}/reset-password?token=${token}`;
    
    console.log("📧 Attempting to send email...");
    console.log("🔗 Reset URL:", resetUrl);
    console.log("📤 Sending to:", email);
    
    try {
      // Render custom email template
      const templateStart = Date.now();
      console.log("🎨 Rendering email template...");
      const html = PasswordResetEmail({
        resetUrl,
        expirationTime: "1 hour",
      });
      console.log(`🎨 Email template rendered in ${Date.now() - templateStart}ms`);

      // Send email with timeout
      const sendStart = Date.now();
      console.log("📨 Calling Resend API...");
      const emailPromise = resend.emails.send({
        from: "Gläub <onboarding@resend.dev>",
        to: [email],
        subject: "Reset Password - Gläub",
        html,
      });
      
      const emailTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Email sending timeout')), 10000)
      );

      const emailResponse = await Promise.race([emailPromise, emailTimeoutPromise]) as any;

      if (emailResponse?.error) {
        console.error("❌ Email sending failed:", emailResponse.error);
        throw new Error(`Resend API error: ${JSON.stringify(emailResponse.error)}`);
      } else {
        console.log(`📨 Email sent successfully in ${Date.now() - sendStart}ms`);
        console.log(`📊 Email ID: ${emailResponse?.data?.id || 'unknown'}`);
        console.log("✅ Resend response:", JSON.stringify(emailResponse?.data || {}));
      }
    } catch (emailError) {
      console.error("❌ Email template or sending failed:", emailError);
      console.error("❌ Email error details:", JSON.stringify(emailError));
      throw emailError; // Re-throw to see the error in logs
    }

    const totalTime = Date.now() - startTime;
    console.log(`🏁 Password reset completed in ${totalTime}ms`);

    // Always return success for security
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "If an account with that email exists, a reset link has been sent.",
        processingTime: totalTime
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`💥 Fatal error in forgot-password function (${totalTime}ms):`, error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        processingTime: totalTime
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
