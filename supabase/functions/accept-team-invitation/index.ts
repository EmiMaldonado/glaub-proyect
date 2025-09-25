import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvitationResponse {
  token: string;
  action: 'accept' | 'decline';
  user_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const requestData: InvitationResponse = await req.json();
    const { token, action, user_id } = requestData;

    // Validate input
    if (!token || !action) {
      return new Response(
        JSON.stringify({ error: 'Token and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['accept', 'decline'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Must be "accept" or "decline"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get invitation details
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select(`
        *,
        manager:profiles!invitations_manager_id_fkey (
          id, user_id, display_name, full_name, email, team_name
        ),
        inviter:profiles!invitations_invited_by_id_fkey (
          id, user_id, display_name, full_name, email
        )
      `)
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (invitationError || !invitation) {
      return new Response(
        JSON.stringify({ error: 'Invitation not found or already processed' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Invitation has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the user accepting the invitation
    let acceptingUserId: string;
    if (user_id) {
      acceptingUserId = user_id;
    } else {
      // Try to get user from auth header
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'User authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      acceptingUserId = user.id;
    }

    // Get accepting user's profile
    const { data: acceptingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', acceptingUserId)
      .single();

    if (profileError || !acceptingProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the invitation is for this user
    if (invitation.email !== acceptingProfile.email) {
      return new Response(
        JSON.stringify({ error: 'This invitation is not for your email address' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from('invitations')
      .update({
        status: action === 'accept' ? 'accepted' : 'declined',
        accepted_at: action === 'accept' ? new Date().toISOString() : null
      })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('Error updating invitation status:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update invitation status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If declined, just return success
    if (action === 'decline') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Invitation declined successfully'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle acceptance based on invitation type
    if (invitation.invitation_type === 'manager_request') {
      // User becomes a manager, inviter joins their team
      
      // Update accepting user to become a manager
      const { error: managerError } = await supabase
        .from('profiles')
        .update({ 
          can_manage_teams: true,
          team_name: acceptingProfile.team_name || `${acceptingProfile.display_name || acceptingProfile.full_name || 'Manager'}'s Team`
        })
        .eq('id', acceptingProfile.id);

      if (managerError) {
        console.error('Error updating manager status:', managerError);
      }

      // Add inviter as team member
      if (invitation.inviter) {
        const { error: memberError } = await supabase
          .from('team_members')
          .insert({
            team_id: acceptingProfile.id,
            member_id: invitation.inviter.id,
            role: 'member'
          });

        if (memberError) {
          console.error('Error adding team member:', memberError);
        }
      }

      // Add manager as team leader
      const { error: leaderError } = await supabase
        .from('team_members')
        .insert({
          team_id: acceptingProfile.id,
          member_id: acceptingProfile.id,
          role: 'leader'
        });

      if (leaderError) {
        console.error('Error adding team leader:', leaderError);
      }

    } else if (invitation.invitation_type === 'team_join') {
      // User joins the manager's team
      
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: invitation.manager_id,
          member_id: acceptingProfile.id,
          role: 'member'
        });

      if (memberError) {
        console.error('Error adding team member:', memberError);
      }
    }

    // Create success notification for the inviter
    if (invitation.inviter) {
      await supabase
        .from('notifications')
        .insert({
          user_id: invitation.inviter.user_id,
          type: 'invitation_accepted',
          title: 'Invitation Accepted',
          message: `${acceptingProfile.display_name || acceptingProfile.full_name} accepted your ${invitation.invitation_type === 'manager_request' ? 'manager request' : 'team invitation'}`,
          data: {
            invitation_id: invitation.id,
            accepted_by: acceptingProfile.email
          }
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation ${action}ed successfully`,
        invitation_type: invitation.invitation_type
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in accept-team-invitation function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(handler);