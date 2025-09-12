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

  try {
    const emailData: AuthEmailData = await req.json();
    const { user, email_data } = emailData;
    const { email_action_type, token, redirect_to, site_url } = email_data;

    let subject = "";
    let html = "";

    if (email_action_type === "signup") {
      subject = "Welcome to Gläub - Confirm your email";
      const confirmUrl = `${site_url}/auth/v1/verify?token=${token}&type=signup&redirect_to=${redirect_to}`;
      
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; text-align: center;">
            <img src="https://f95a31b2-0a27-4418-b650-07505c789eed.sandbox.lovable.dev/lovable-uploads/eb8e87b8-1951-4632-82f0-7b714e5efcd5.png" alt="Gläub" style="height: 40px; margin-bottom: 30px;">
            
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
          </div>
        </div>
      `;
    } else if (email_action_type === "recovery") {
      subject = "Reset your Gläub password";
      const resetUrl = `${redirect_to}?access_token=${token}&type=recovery`;
      
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; text-align: center;">
            <img src="https://f95a31b2-0a27-4418-b650-07505c789eed.sandbox.lovable.dev/lovable-uploads/eb8e87b8-1951-4632-82f0-7b714e5efcd5.png" alt="Gläub" style="height: 40px; margin-bottom: 30px;">
            
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
              This link will expire in 60 minutes for security reasons.
            </p>
          </div>
        </div>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "Gläub <noreply@resend.dev>",
      to: [user.email],
      subject: subject,
      html: html,
    });

    console.log("Auth email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending auth email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});