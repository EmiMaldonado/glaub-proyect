import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

interface CompleteInvitationRequest {
  token: string;
  user_id: string;
  action: 'accept' | 'decline';
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, user_id, action }: CompleteInvitationRequest = await req.json();
    
    console.log("Complete invitation request received:", { token, user_id, action });

    if (!token || !user_id || !action) {
      console.error("Missing required fields:", { token: !!token, user_id: !!user_id, action: !!action });
      throw new Error("Token, user_id, and action are required");
    }

    // Validate the action parameter
    if (action !== 'accept' && action !== 'decline') {
      throw new Error('Invalid action. Must be "accept" or "decline"');
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Looking for invitation with token:", token);

    // Find the invitation
    const { data: invitation, error: invitationError } = await supabase
      .from("invitations")
      .select(`
        *,
        manager:profiles!invitations_manager_id_fkey(*)
      `)
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (invitationError) {
      console.error("Error finding invitation:", invitationError);
      throw new Error("Invalid or expired invitation: " + invitationError.message);
    }

    if (!invitation) {
      console.error("No invitation found for token:", token);
      throw new Error("Invalid or expired invitation");
    }

    console.log("Found invitation:", { id: invitation.id, email: invitation.email, manager_id: invitation.manager_id });

    // Check if invitation has expired
    if (new Date() > new Date(invitation.expires_at)) {
      console.error("Invitation expired:", { expires_at: invitation.expires_at, now: new Date().toISOString() });
      throw new Error("Invitation has expired");
    }

    // Get the new user's profile
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (profileError) {
      console.error("Error finding user profile:", profileError);
      throw new Error("User profile not found: " + profileError.message);
    }

    if (!userProfile) {
      console.error("No user profile found for user_id:", user_id);
      throw new Error("User profile not found");
    }

    console.log("Found user profile:", { id: userProfile.id, user_id: userProfile.user_id });

    if (action === 'accept') {
      // Check if membership already exists
      const { data: existingMembership } = await supabase
        .from("team_memberships")
        .select("id")
        .eq("employee_id", userProfile.id)
        .eq("manager_id", invitation.manager_id)
        .single();

      if (existingMembership) {
        throw new Error("User is already a team member");
      }

      // Create team membership
      const { error: membershipError } = await supabase
        .from("team_memberships")
        .insert({
          employee_id: userProfile.id,
          manager_id: invitation.manager_id
        });

      if (membershipError) {
        console.error("Error creating team membership:", membershipError);
        throw new Error("Failed to create team membership: " + membershipError.message);
      }

      console.log("Created team membership for user:", userProfile.id);

      // Promote manager if they're currently an employee
      const { error: promoteManagerError } = await supabase
        .from("profiles")
        .update({ role: "manager" })
        .eq("id", invitation.manager_id)
        .eq("role", "employee");

      if (promoteManagerError) {
        console.error("Error promoting manager:", promoteManagerError);
      } else {
        console.log("Promoted manager to manager role");
      }
    }

    // Update invitation status
    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    const updateData: any = { status: newStatus };
    
    if (action === 'accept') {
      updateData.accepted_at = new Date().toISOString();
    }

    const { error: updateInvitationError } = await supabase
      .from("invitations")
      .update(updateData)
      .eq("id", invitation.id);

    if (updateInvitationError) {
      console.error("Error updating invitation status:", updateInvitationError);
      throw new Error("Failed to update invitation status: " + updateInvitationError.message);
    }

    console.log(`Updated invitation status to ${newStatus}`);

    console.log("Invitation completed successfully:", { 
      invitationId: invitation.id, 
      userId: user_id,
      managerId: invitation.manager_id 
    });

    const responseMessage = action === 'accept' 
      ? "Invitation accepted successfully" 
      : "Invitation declined successfully";

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: responseMessage,
        action: action,
        manager_name: invitation.manager?.display_name || invitation.manager?.full_name
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Error in complete-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});