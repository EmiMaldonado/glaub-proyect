import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { corsHeaders } from "../_shared/cors.ts";

interface UnifiedInvitationRequest {
  email: string;
  invitationType: 'team_join' | 'manager_request';
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

    // Get user's profile or create one if it doesn't exist using service role
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

    const { email, invitationType }: UnifiedInvitationRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    if (!invitationType || !['team_join', 'manager_request'].includes(invitationType)) {
      return new Response(
        JSON.stringify({ error: "Invalid invitation type. Must be 'team_join' or 'manager_request'" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Prevent self-invitations
    if (email.toLowerCase() === user.email?.toLowerCase()) {
      return new Response(
        JSON.stringify({ 
          error: "You cannot send an invitation to yourself",
          type: "self_invitation"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Additional validation for manager_request type
    if (invitationType === 'manager_request') {
      // Check if user can send manager_request
      const { data: canSendRequest } = await supabase.rpc('can_send_manager_request', { 
        requester_profile_id: profile.id 
      });

      if (!canSendRequest) {
        return new Response(
          JSON.stringify({ error: 'You cannot send a manager request. You may already be a manager or have a manager.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Check for circular relationships
      const { data: wouldCreateCircular } = await supabase.rpc('would_create_circular_relationship', { 
        potential_manager_email: email,
        requester_profile_id: profile.id 
      });

      if (wouldCreateCircular) {
        return new Response(
          JSON.stringify({ error: 'Cannot invite this user as your manager - it would create a circular relationship.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    // Check if invitation already exists for this email and type - only check pending and non-expired
    const { data: existingInvitation } = await supabase
      .from("invitations")
      .select("*")
      .eq("email", email)
      .eq("invitation_type", invitationType === 'team_join' ? 'team_member' : 'manager_request')
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existingInvitation) {
      // Return success with informative message - not an error
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Invitation is already pending for this email",
          type: "existing_pending",
          invitation: {
            id: existingInvitation.id,
            email: existingInvitation.email,
            status: existingInvitation.status,
            invited_at: existingInvitation.invited_at,
            expires_at: existingInvitation.expires_at
          }
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Clean up any previous expired or declined invitations
    await supabase
      .from("invitations")
      .delete()
      .eq("invited_by_id", profile.id)
      .eq("email", email)
      .eq("invitation_type", invitationType === 'team_join' ? 'team_member' : 'manager_request')
      .in("status", ["declined", "expired"])
      .lt("expires_at", new Date().toISOString());

    console.log("Cleaned up old invitations for:", email);

    // Generate unique token
    const token = crypto.randomUUID();

    // Set expiration date (3 days for manager requests, 7 days for team invitations)
    const expirationHours = invitationType === 'manager_request' ? 72 : 168;
    const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000).toISOString();

    // Create invitation record
    const { data: invitation, error: invitationError } = await supabase
      .from("invitations")
      .insert({
        manager_id: profile.id,
        invited_by_id: profile.id,
        email,
        token,
        invitation_type: invitationType === 'team_join' ? 'team_member' : 'manager_request',
        expires_at: expiresAt
      })
      .select()
      .single();

    if (invitationError) {
      console.error("Error creating invitation:", invitationError);
      throw new Error("Failed to create invitation");
    }

    // Send appropriate email based on invitation type
    const acceptUrl = `${supabaseUrl}/functions/v1/accept-invitation?token=${token}`;
    let emailSent = false;

    try {
      if (invitationType === 'manager_request') {
        // Send manager request email using Resend
        const managerName = profile.display_name || profile.full_name || 'A colleague';
        const teamName = profile.team_name || `${managerName}'s Team`;
        
        const { error: emailError } = await resend.emails.send({
          from: "Gläub <onboarding@resend.dev>",
          to: [email],
          subject: `Request to be your manager on Gläub - ${teamName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #2563eb; text-align: center;">Manager Request from ${managerName}</h1>
              
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
                  Hello! <strong>${managerName}</strong> is requesting to be your manager for the team "<strong>${teamName}</strong>" on Gläub.
                </p>
                
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                  Gläub is an AI-powered therapeutic conversation platform that helps teams share insights and improve workplace well-being.
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${acceptUrl}" 
                     style="background-color: #2563eb; color: white; padding: 12px 24px; 
                            text-decoration: none; border-radius: 6px; font-weight: bold; 
                            display: inline-block;">
                    Accept Manager Request
                  </a>
                </div>
                
                <p style="font-size: 14px; color: #64748b; margin-top: 20px;">
                  If the button doesn't work, you can also copy and paste this link into your browser:
                  <br><a href="${acceptUrl}" style="color: #2563eb;">${acceptUrl}</a>
                </p>
              </div>
              
              <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">
                  This request was sent by ${managerName}. If you believe this was sent in error, you can safely ignore this email.
                </p>
              </div>
            </div>
          `,
        });

        if (emailError) {
          console.error("Error sending manager request email:", emailError);
        } else {
          emailSent = true;
        }
      } else {
        // Send team invitation using Supabase's built-in system
        const { data: authInvitation, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
          email,
          {
            redirectTo: acceptUrl,
            data: {
              invitation_token: token,
              invited_by: profile.display_name || profile.full_name || 'Your colleague',
              role: 'team_member',
              invitation_type: 'team_invitation'
            }
          }
        );

        if (inviteError) {
          console.error("Error sending team invitation email:", inviteError);
        } else {
          emailSent = true;
          console.log("Team invitation sent successfully via Supabase auth:", authInvitation);
        }
      }
    } catch (emailError) {
      console.error("Error sending invitation email:", emailError);
    }

    console.log(`${invitationType} invitation created successfully:`, { 
      invitationId: invitation.id, 
      email: email,
      emailSent
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Invitation sent successfully",
        type: "new_invitation",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          status: invitation.status,
          invitation_type: invitation.invitation_type,
          invited_at: invitation.invited_at,
          expires_at: invitation.expires_at
        },
        emailSent
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Error in unified-invitation function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        type: "server_error"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});