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
      console.log("Processing invitation acceptance");
      
      // Get or create team membership record
      let { data: teamMembership, error: membershipFetchError } = await supabase
        .from("team_memberships")
        .select("*")
        .eq("manager_id", invitation.manager_id)
        .maybeSingle();

      if (membershipFetchError && membershipFetchError.code !== 'PGRST116') {
        console.error("Error fetching team membership:", membershipFetchError);
        throw new Error("Failed to fetch team membership: " + membershipFetchError.message);
      }

      if (!teamMembership) {
        // Create new team membership record
        console.log("Creating new team membership record");
        const { data: newMembership, error: createError } = await supabase
          .from("team_memberships")
          .insert({
            manager_id: invitation.manager_id,
            employee_1_id: userProfile.id
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating team membership:", createError);
          throw new Error("Failed to create team membership: " + createError.message);
        }
        
        console.log("Created new team membership with first employee");
      } else {
        // Find next available employee slot
        console.log("Adding to existing team membership");
        const employeeSlots = [
          'employee_1_id', 'employee_2_id', 'employee_3_id', 'employee_4_id', 'employee_5_id',
          'employee_6_id', 'employee_7_id', 'employee_8_id', 'employee_9_id', 'employee_10_id'
        ];
        
        // Check if user is already in the team
        const isAlreadyMember = employeeSlots.some(slot => teamMembership[slot] === userProfile.id);
        if (isAlreadyMember) {
          console.log("User is already a member of this team");
        } else {
          // Find first available slot
          const availableSlot = employeeSlots.find(slot => !teamMembership[slot]);
          
          if (!availableSlot) {
            throw new Error("Team is full (maximum 10 members)");
          }
          
          console.log("Adding user to slot:", availableSlot);
          const { error: updateError } = await supabase
            .from("team_memberships")
            .update({ [availableSlot]: userProfile.id })
            .eq("id", teamMembership.id);

          if (updateError) {
            console.error("Error updating team membership:", updateError);
            throw new Error("Failed to add user to team: " + updateError.message);
          }
        }
      }

      // Update user role to employee if not already a manager
      if (userProfile.role !== 'manager') {
        const { error: updateRoleError } = await supabase
          .from("profiles")
          .update({ role: 'employee' })
          .eq("id", userProfile.id);

        if (updateRoleError) {
          console.error("Error updating user role:", updateRoleError);
        } else {
          console.log("Updated user role to employee");
        }
      }

      // Promote manager if they're currently an employee and set team name
      const { data: managerProfile, error: managerFetchError } = await supabase
        .from("profiles")
        .select("role, team_name, display_name, full_name")
        .eq("id", invitation.manager_id)
        .single();

      if (managerFetchError) {
        console.error("Error fetching manager profile:", managerFetchError);
      } else if (managerProfile?.role === "employee") {
        console.log("Promoting manager from employee to manager role");
        const teamName = managerProfile.team_name || `${managerProfile.display_name || managerProfile.full_name || 'Team'}'s Team`;
        
        const { error: promoteManagerError } = await supabase
          .from("profiles")
          .update({ 
            role: "manager",
            team_name: teamName
          })
          .eq("id", invitation.manager_id);

        if (promoteManagerError) {
          console.error("Error promoting manager:", promoteManagerError);
        } else {
          console.log("Promoted manager to manager role with team name:", teamName);
        }
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