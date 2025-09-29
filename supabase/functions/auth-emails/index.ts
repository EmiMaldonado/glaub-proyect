import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthEmailData {
  user: {
    email: string;
    id?: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let user: any = null;
  let email_data: any = null;

  try {
    const emailData: AuthEmailData = await req.json();
    ({ user, email_data } = emailData);
    const { email_action_type, token, token_hash, redirect_to, site_url } = email_data;

    console.log('Auth email triggered:', { 
      email_action_type, 
      user_email: user.email,
      redirect_to,
      site_url 
    });

    let subject = "";
    let html = "";

    if (email_action_type === "signup") {
      subject = "Welcome to Gläub - Confirm your email";
      // Use token_hash for the verification URL as it's more secure
      const confirmUrl = `${site_url}/auth/callback?token_hash=${token_hash}&type=signup&redirect_to=${encodeURIComponent(redirect_to)}`;
      
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; text-align: center;">
            <img src="https://www.glaubinsights.org/glaub-logo.png" alt="Gläub" style="height: 40px; margin-bottom: 30px;">
            
            <h1 style="color: #333; margin-bottom: 20px;">Welcome to Gläub!</h1>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
              Thank you for signing up! To complete your registration and start your journey of self-discovery, please verify your email address.
            </p>
            
            <a href="${confirmUrl}" style="background: linear-gradient(135deg, hsl(214, 28%, 56%), hsl(214, 28%, 65%)); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block; margin-bottom: 20px;">
              Confirm Your Email
            </a>
            
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              If the button doesn't work, copy and paste this link in your browser:<br>
              <span style="color: #6889B4; word-break: break-all;">${confirmUrl}</span>
            </p>
            
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              If you didn't create an account with us, please ignore this email.
            </p>
            
            <p style="color: #999; font-size: 12px; margin-top: 10px;">
              This link will expire in 24 hours for security reasons.
            </p>
          </div>
        </div>
      `;
    } else if (email_action_type === "recovery") {
      subject = "Reset your Gläub password";
      const resetUrl = `${site_url}/auth/callback?token_hash=${token_hash}&type=recovery&redirect_to=${encodeURIComponent(redirect_to)}`;
      
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; text-align: center;">
            <img src="https://www.glaubinsights.org/glaub-logo.png" alt="Gläub" style="height: 40px; margin-bottom: 30px;">
            
            <h1 style="color: #333; margin-bottom: 20px;">Reset Your Password</h1>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
              We received a request to reset your password. Click the button below to create a new password for your Gläub account.
            </p>
            
            <a href="${resetUrl}" style="background: linear-gradient(135deg, hsl(214, 28%, 56%), hsl(214, 28%, 65%)); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block; margin-bottom: 20px;">
              Reset Password
            </a>
            
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              If the button doesn't work, copy and paste this link in your browser:<br>
              <span style="color: #6889B4; word-break: break-all;">${resetUrl}</span>
            </p>
            
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
            </p>
            
            <p style="color: #999; font-size: 12px; margin-top: 10px;">
              This link will expire in 24 hours for security reasons.
            </p>
          </div>
        </div>
      `;
    } else {
      console.log('Unknown email action type:', email_action_type);
      return new Response(JSON.stringify({ error: 'Unknown email action type' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailResponse = await resend.emails.send({
      from: "Gläub <noreply@resend.dev>",
      to: [user.email],
      subject: subject,
      html: html,
    });

    console.log("Auth email sent successfully:", { 
      id: emailResponse.data?.id,
      to: user.email,
      subject,
      action_type: email_action_type 
    });

    return new Response(JSON.stringify({ 
      success: true, 
      email_id: emailResponse.data?.id,
      message: 'Email sent successfully' 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending auth email:", { 
      error: error.message,
      user_email: user?.email,
      action_type: email_data?.email_action_type 
    });
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to send authentication email'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});