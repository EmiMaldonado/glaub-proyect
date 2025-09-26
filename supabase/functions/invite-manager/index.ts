import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@4.0.0";
import { corsHeaders } from "../_shared/cors.ts";

interface ManagerInvitationRequest {
  managerEmail: string;
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Get user profile or create one if it doesn't exist using service role
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, team_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile && !profileError) {
      // Profile doesn't exist, create one using service role to bypass RLS
      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          display_name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating profile:", createError);
        throw new Error(`Failed to create user profile: ${createError.message}`);
      }

      profile = newProfile;
      console.log("Created new profile for user:", user.id);
    } else if (profileError) {
      console.error("Error fetching profile:", profileError);
      throw new Error(`Profile error: ${profileError.message}`);
    } else if (!profile) {
      throw new Error("Profile not found and could not be created");
    }

    const { managerEmail }: ManagerInvitationRequest = await req.json();

    if (!managerEmail) {
      throw new Error("Manager email is required");
    }

    // Check if invitation already exists for this manager email
    const { data: existingInvitation } = await supabase
      .from("invitations")
      .select("*")
      .eq("manager_id", profile.id)
      .eq("email", managerEmail)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvitation) {
      throw new Error("Invitation already sent to this manager");
    }

    // Generate unique token
    const token = crypto.randomUUID();

    // Create invitation record
    const { data: invitation, error: invitationError } = await supabase
      .from("invitations")
      .insert({
        manager_id: profile.id,
        invited_by_id: profile.id,
        email: managerEmail,
        token,
        invitation_type: 'manager_request',
        expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (invitationError) {
      console.error("Error creating manager invitation:", invitationError);
      throw new Error("Failed to create manager invitation");
    }

    // Use Resend to send custom invitation email with team name
    const managerName = profile.display_name || profile.full_name || 'Your manager';
    const teamName = profile.team_name || `${managerName}'s Team`;
    const acceptUrl = `${supabaseUrl}/functions/v1/accept-invitation?token=${token}`;
    
    // Send invitation email using Resend
    const { error: emailError } = await resend.emails.send({
      from: "EmpathAI <onboarding@resend.dev>",
      to: [managerEmail],
      subject: `Invitation to join ${teamName} on EmpathAI`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; text-align: center;">You're Invited to Join ${teamName}!</h1>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              Hello! You've been invited by <strong>${managerName}</strong> to join their team "<strong>${teamName}</strong>" on EmpathAI.
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              EmpathAI is an AI-powered therapeutic conversation platform that helps teams share insights and improve workplace well-being.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${acceptUrl}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; font-weight: bold; 
                        display: inline-block;">
                Accept Invitation & Join ${teamName}
              </a>
            </div>
            
            <p style="font-size: 14px; color: #64748b; margin-top: 20px;">
              If the button doesn't work, you can also copy and paste this link into your browser:
              <br><a href="${acceptUrl}" style="color: #2563eb;">${acceptUrl}</a>
            </p>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">
              This invitation was sent by ${managerName}. If you believe this was sent in error, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    });

    if (emailError) {
      console.error("Error sending invitation email:", emailError);
      throw new Error(`Failed to send invitation email: ${emailError.message}`);
    }

    console.log("Manager invitation sent successfully:", { 
      invitationId: invitation.id, 
      email: managerEmail,
      teamName: teamName
    });

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
      }
    );

  } catch (error: any) {
    console.error("Error in invite-manager function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});