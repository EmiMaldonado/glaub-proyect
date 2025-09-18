import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

interface UnifiedInvitationRequest {
  email: string;
  invitationType: 'team_member' | 'manager_request';
  teamId?: string; // Solo para invitaciones de team_member
  message?: string; // Mensaje opcional
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Processing unified invitation request");
    
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

    // Get user's profile or create one if it doesn't exist
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

    const { email, invitationType, teamId, message }: UnifiedInvitationRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    if (!invitationType) {
      throw new Error("Invitation type is required");
    }

    console.log("Processing invitation:", { email, invitationType, teamId });

    // Check if invitation already exists for this email and sender
    const { data: existingInvitation } = await supabase
      .from("invitations")
      .select("*")
      .eq("invited_by_id", profile.id)
      .eq("email", email)
      .eq("status", "pending")
      .eq("invitation_type", invitationType)
      .maybeSingle();

    if (existingInvitation) {
      throw new Error("Invitation already sent to this email");
    }

    // Generate unique token
    const token = crypto.randomUUID();

    // For team_member invitations, use the teamId, otherwise use profile.id (manager_request)
    const managerIdForInvitation = invitationType === 'team_member' ? (teamId || profile.id) : profile.id;

    // Create invitation record
    const { data: invitation, error: invitationError } = await supabase
      .from("invitations")
      .insert({
        manager_id: managerIdForInvitation,
        invited_by_id: profile.id,
        email,
        token,
        invitation_type: invitationType,
        expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() // 72 horas
      })
      .select()
      .single();

    if (invitationError) {
      console.error("Error creating invitation:", invitationError);
      throw new Error(`Failed to create invitation: ${invitationError.message}`);
    }

    console.log("Invitation created successfully:", invitation.id);

    // Generate invitation URL based on type
    let acceptUrl: string;
    let emailSubject: string;
    let emailContent: string;
    
    if (invitationType === 'team_member') {
      acceptUrl = `${supabaseUrl}/functions/v1/accept-invitation?token=${token}`;
      emailSubject = `Join ${profile.team_name || `${profile.display_name || profile.full_name}'s Team`} on EmpathAI`;
      
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; text-align: center;">You're Invited to Join ${profile.team_name || `${profile.display_name || profile.full_name}'s Team`}!</h1>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              Hello! You've been invited by <strong>${profile.display_name || profile.full_name}</strong> to join their team on EmpathAI.
            </p>
            
            ${message ? `<p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px; background: #e0f2fe; padding: 10px; border-radius: 4px;">
              <strong>Personal message:</strong> ${message}
            </p>` : ''}
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              EmpathAI is an AI-powered therapeutic conversation platform that helps teams share insights and improve workplace well-being.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${acceptUrl}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; font-weight: bold; 
                        display: inline-block;">
                Accept Invitation & Join Team
              </a>
            </div>
            
            <p style="font-size: 14px; color: #64748b; margin-top: 20px;">
              If the button doesn't work, you can also copy and paste this link into your browser:
              <br><a href="${acceptUrl}" style="color: #2563eb;">${acceptUrl}</a>
            </p>
            
            <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">
              This invitation expires in 72 hours.
            </p>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">
              This invitation was sent by ${profile.display_name || profile.full_name}. If you believe this was sent in error, you can safely ignore this email.
            </p>
          </div>
        </div>
      `;
    } else { // manager_request
      acceptUrl = `${supabaseUrl}/functions/v1/accept-manager-invitation?token=${token}`;
      emailSubject = `${profile.display_name || profile.full_name} wants you to be their manager on EmpathAI`;
      
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; text-align: center;">You've been requested as a manager on EmpathAI!</h1>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              Hello! <strong>${profile.display_name || profile.full_name}</strong> has requested you to be their manager on EmpathAI.
            </p>
            
            ${message ? `<p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px; background: #e0f2fe; padding: 10px; border-radius: 4px;">
              <strong>Personal message:</strong> ${message}
            </p>` : ''}
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              EmpathAI is an AI-powered therapeutic conversation platform that helps teams share insights and improve workplace well-being.
            </p>
            
            <div style="text-align: center; margin: 30px 0; display: flex; gap: 10px; justify-content: center;">
              <a href="${acceptUrl}&action=accept" 
                 style="background-color: #16a34a; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; font-weight: bold; 
                        display: inline-block;">
                Accept Manager Role
              </a>
              <a href="${acceptUrl}&action=decline" 
                 style="background-color: #dc2626; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; font-weight: bold; 
                        display: inline-block;">
                Decline Request
              </a>
            </div>
            
            <p style="font-size: 14px; color: #64748b; margin-top: 20px;">
              Accept link: <a href="${acceptUrl}&action=accept" style="color: #2563eb;">${acceptUrl}&action=accept</a><br>
              Decline link: <a href="${acceptUrl}&action=decline" style="color: #2563eb;">${acceptUrl}&action=decline</a>
            </p>
            
            <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">
              This invitation expires in 72 hours.
            </p>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">
              This request was sent by ${profile.display_name || profile.full_name}. If you believe this was sent in error, you can safely ignore this email.
            </p>
          </div>
        </div>
      `;
    }

    // Use Supabase's built-in email invitation system
    console.log("Sending invitation email via Supabase Auth...");
    
    const { data: authInvitation, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: acceptUrl,
        data: {
          invitation_token: token,
          invited_by: profile.display_name || profile.full_name || 'Your colleague',
          invitation_type: invitationType,
          team_name: profile.team_name || `${profile.display_name || profile.full_name}'s Team`,
          message: message || null
        }
      }
    );

    if (inviteError) {
      console.error("Error sending invitation email:", inviteError);
      // Don't throw error - invitation record was created, just log the email issue
      console.log("Invitation record created but email failed to send:", invitation.id);
    } else {
      console.log("Invitation sent successfully via Supabase auth:", { 
        invitationId: invitation.id, 
        authInvitation 
      });
    }

    // Create notification for the recipient (if they already have an account)
    const { data: existingUserCheck } = await supabase.auth.admin.listUsers();
    const existingUser = existingUserCheck?.users?.find(u => u.email === email);
    
    if (existingUser) {
      const { data: recipientProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", existingUser.id)
        .maybeSingle();
        
      if (recipientProfile) {
        let notificationTitle: string;
        let notificationMessage: string;
        
        if (invitationType === 'team_member') {
          notificationTitle = 'Team Invitation Received';
          notificationMessage = `${profile.display_name || profile.full_name} has invited you to join their team on EmpathAI.`;
        } else {
          notificationTitle = 'Manager Request Received';
          notificationMessage = `${profile.display_name || profile.full_name} has requested you to be their manager on EmpathAI.`;
        }
        
        await supabase
          .from("notifications")
          .insert({
            user_id: existingUser.id,
            type: 'invitation_received',
            title: notificationTitle,
            message: notificationMessage,
            data: {
              invitation_id: invitation.id,
              invitation_token: token,
              invited_by: profile.display_name || profile.full_name,
              invitation_type: invitationType
            }
          });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitation: {
          id: invitation.id,
          email: invitation.email,
          invitation_type: invitation.invitation_type,
          status: invitation.status,
          invited_at: invitation.invited_at,
          expires_at: invitation.expires_at
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Error in unified-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});