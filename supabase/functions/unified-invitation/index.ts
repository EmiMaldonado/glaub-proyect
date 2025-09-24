import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

interface UnifiedInvitationRequest {
  email: string;
  invitationType: 'team_join' | 'manager_request';
  teamId?: string;
  message?: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Processing unified invitation request");
    
    // JWT decode authentication (replace auth.getUser())
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const jwt = authHeader.replace('Bearer ', '');
    let payload;
    try {
      payload = JSON.parse(atob(jwt.split('.')[1]));
      if (payload.exp < Date.now() / 1000) {
        throw new Error('Token expired');
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = payload.sub;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile and check can_manage_teams permission
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile && !profileError) {
      // Create profile if doesn't exist
      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          user_id: userId,
          full_name: payload.user_metadata?.full_name || payload.email?.split('@')[0] || 'User',
          display_name: payload.user_metadata?.display_name || payload.user_metadata?.full_name || payload.email?.split('@')[0] || 'User',
          can_manage_teams: false,
          can_be_managed: true
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating profile:", createError);
        throw new Error(`Failed to create user profile: ${createError.message}`);
      }
      profile = newProfile;
    } else if (profileError) {
      console.error("Error fetching profile:", profileError);
      throw new Error(`Profile error: ${profileError.message}`);
    }

    // Check permissions based on invitation type
    if (invitationType === 'team_join' && !profile?.can_manage_teams) {
      return new Response(JSON.stringify({ error: 'Only managers can invite team members' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (invitationType === 'manager_request' && !profile?.can_be_managed) {
      return new Response(JSON.stringify({ error: 'You cannot request managers' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { email, invitationType, teamId, message }: UnifiedInvitationRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    if (!invitationType) {
      throw new Error("Invitation type is required");
    }

    // Check for existing invitation
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

    // Generate token and create invitation
    const token = crypto.randomUUID();
    const managerIdForInvitation = invitationType === 'team_join' ? (teamId || profile.id) : profile.id;

    const { data: invitation, error: invitationError } = await supabase
      .from("invitations")
      .insert({
        manager_id: managerIdForInvitation,
        invited_by_id: profile.id,
        email,
        token,
        invitation_type: invitationType,
        expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (invitationError) {
      console.error("Error creating invitation:", invitationError);
      throw new Error(`Failed to create invitation: ${invitationError.message}`);
    }

    // Generate invitation URL
    const acceptUrl = `${supabaseUrl}/functions/v1/accept-invitation?token=${token}`;
    
    // Check if user exists
    const { data: existingUserCheck } = await supabase.auth.admin.listUsers();
    const existingUser = existingUserCheck?.users?.find(u => u.email === email);
    
    if (existingUser) {
      // Create notification for existing user
      const { data: recipientProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", existingUser.id)
        .maybeSingle();
        
      if (recipientProfile) {
        const notificationTitle = invitationType === 'team_join' 
          ? 'Team Invitation Received' 
          : 'Manager Request Received';
        const notificationMessage = invitationType === 'team_join'
          ? `${profile.display_name || profile.full_name} has invited you to join their team on EmpathAI.`
          : `${profile.display_name || profile.full_name} has requested you to be their manager on EmpathAI.`;
        
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
              invitation_type: invitationType,
              accept_url: acceptUrl
            }
          });
      }
    } else {
      // Send auth invitation for new users
      const emailSubject = invitationType === 'team_join'
        ? `Join ${profile.team_name || `${profile.display_name || profile.full_name}'s Team`} on EmpathAI`
        : `${profile.display_name || profile.full_name} wants you to be their manager on EmpathAI`;

      const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
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
        throw new Error(`Failed to send invitation email: ${inviteError.message}`);
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
