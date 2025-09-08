import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@4.0.0";
import { corsHeaders } from "../_shared/cors.ts";

interface InvitationRequest {
  email: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT and get user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      throw new Error("Invalid token");
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    const { email }: InvitationRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    // Check if invitation already exists for this email
    const { data: existingInvitation } = await supabase
      .from("invitations")
      .select("*")
      .eq("manager_id", profile.id)
      .eq("email", email)
      .eq("status", "pending")
      .single();

    if (existingInvitation) {
      throw new Error("Invitation already sent to this email");
    }

    // Generate unique token
    const token = crypto.randomUUID();

    // Create invitation record
    const { data: invitation, error: invitationError } = await supabase
      .from("invitations")
      .insert({
        manager_id: profile.id,
        email,
        token,
      })
      .select()
      .single();

    if (invitationError) {
      console.error("Error creating invitation:", invitationError);
      throw new Error("Failed to create invitation");
    }

    // Send invitation email
    const acceptUrl = `${supabaseUrl}/functions/v1/accept-invitation?token=${token}`;
    
    const emailResponse = await resend.emails.send({
      from: "EmpathAI <invitations@resend.dev>",
      to: [email],
      subject: `${profile.display_name || profile.full_name || 'Your colleague'} invited you to join their team on EmpathAI`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">You're invited to join a team on EmpathAI</h1>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            Hi there!
          </p>
          
          <p style="font-size: 16px; line-height: 1.6; color: #555;">
            <strong>${profile.display_name || profile.full_name || 'Your colleague'}</strong> has invited you to join their team on EmpathAI, 
            our AI-powered platform for workplace emotional intelligence and team insights.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${acceptUrl}" 
               style="background-color: #007bff; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; 
                      font-weight: bold; font-size: 16px;">
              Join ${profile.display_name || profile.full_name || 'their'} Team on EmpathAI
            </a>
          </div>
          
          <p style="font-size: 14px; line-height: 1.6; color: #666;">
            If you don't have an EmpathAI account yet, you'll be able to create one as part of accepting this invitation.
          </p>
          
          <p style="font-size: 14px; line-height: 1.6; color: #666;">
            This invitation will expire in 7 days.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #999; text-align: center;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    console.log("Invitation sent successfully:", { invitationId: invitation.id, emailResponse });

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitation: {
          id: invitation.id,
          email: invitation.email,
          status: invitation.status,
          invited_at: invitation.invited_at
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});