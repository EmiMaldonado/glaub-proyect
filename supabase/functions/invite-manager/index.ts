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
      .select("*")
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
        email: managerEmail,
        token,
      })
      .select()
      .single();

    if (invitationError) {
      console.error("Error creating manager invitation:", invitationError);
      throw new Error("Failed to create manager invitation");
    }

    // Send invitation email to manager
    const acceptUrl = `${supabaseUrl}/functions/v1/accept-invitation?token=${token}`;
    
    const emailResponse = await resend.emails.send({
      from: "Gläub <noreply@resend.dev>",
      to: [managerEmail],
      subject: `${profile.display_name || profile.full_name || 'A team member'} wants you to be their manager on Gläub`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; text-align: center;">
            <img src="https://f95a31b2-0a27-4418-b650-07505c789eed.sandbox.lovable.dev/lovable-uploads/eb8e87b8-1951-4632-82f0-7b714e5efcd5.png" alt="Gläub" style="height: 40px; margin-bottom: 30px;">
            
            <h1 style="color: #333; margin-bottom: 20px;">You've been invited to become a manager on Gläub</h1>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              <strong>${profile.display_name || profile.full_name || 'A team member'}</strong> has invited you to be their manager on Gläub, a platform for personality insights and professional development.
            </p>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
              As their manager, you'll be able to:
            </p>
            
            <ul style="color: #666; font-size: 16px; line-height: 1.6; text-align: left; margin-bottom: 30px; padding-left: 20px;">
              <li>View shared personality insights to better understand their work style</li>
              <li>Access personalized recommendations for effective communication</li>
              <li>Get suggestions for professional development opportunities</li>
              <li>Build stronger team dynamics through personality awareness</li>
            </ul>
            
            <a href="${acceptUrl}" style="background: linear-gradient(135deg, hsl(214, 28%, 56%), hsl(214, 28%, 65%)); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block; margin-bottom: 20px;">
              Accept Manager Invitation
            </a>
            
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              If the button doesn't work, copy and paste this link in your browser:<br>
              <span style="color: #6889B4; word-break: break-all;">${acceptUrl}</span>
            </p>
            
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              This invitation will expire in 7 days.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    });

    console.log("Manager invitation sent successfully:", { invitationId: invitation.id, emailResponse });

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