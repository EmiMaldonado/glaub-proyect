import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvitationRequest {
  email: string;
  invitation_type: 'team_join' | 'manager_request';
  message?: string;
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

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user info from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const requestData: InvitationRequest = await req.json();
    const { email, invitation_type, message } = requestData;

    // Validate input
    if (!email || !invitation_type) {
      return new Response(
        JSON.stringify({ error: 'Email and invitation type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent self-invitations
    if (email === user.email) {
      return new Response(
        JSON.stringify({ error: 'Cannot send invitation to yourself' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get sender profile
    const { data: senderProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError || !senderProfile) {
      return new Response(
        JSON.stringify({ error: 'Sender profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate permissions based on invitation type
    if (invitation_type === 'team_join') {
      // Only managers can invite team members
      if (!senderProfile.can_manage_teams) {
        return new Response(
          JSON.stringify({ error: 'Only managers can send team invitations' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (invitation_type === 'manager_request') {
      // Only manageable users can request managers
      if (senderProfile.can_be_managed === false) {
        return new Response(
          JSON.stringify({ error: 'You cannot request a manager' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check for existing pending invitations
    const { data: existingInvitation } = await supabase
      .from('invitations')
      .select('id, status')
      .eq('email', email)
      .eq('invitation_type', invitation_type)
      .eq('status', 'pending')
      .single();

    if (existingInvitation) {
      return new Response(
        JSON.stringify({ error: 'A pending invitation already exists for this email' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine manager_id based on invitation type
    let managerId = senderProfile.id;
    if (invitation_type === 'manager_request') {
      // For manager requests, we need to find the target manager
      // For now, we'll use the sender's profile ID as a placeholder
      // In practice, you might want to look up the target user's profile
      managerId = senderProfile.id;
    }

    // Create invitation record
    const { data: invitation, error: insertError } = await supabase
      .from('invitations')
      .insert({
        email,
        invitation_type,
        status: 'pending',
        manager_id: managerId,
        invited_by_id: senderProfile.id,
        message: message || null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        invited_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating invitation:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create invitation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate invitation URL
    const invitationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/unified-team-invitation/accept?token=${invitation.token}`;

    // Update invitation with URL
    await supabase
      .from('invitations')
      .update({ invitation_url: invitationUrl })
      .eq('id', invitation.id);

    // TODO: Send email notification using Resend
    // This would require the RESEND_API_KEY environment variable
    console.log(`Invitation created: ${invitation_type} for ${email}`);
    console.log(`Invitation URL: ${invitationUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          type: invitation.invitation_type,
          status: invitation.status,
          expires_at: invitation.expires_at,
          invitation_url: invitationUrl
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in unified-team-invitation function:', error);
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