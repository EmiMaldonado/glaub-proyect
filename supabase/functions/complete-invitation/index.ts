import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

interface CompleteInvitationRequest {
  token: string;
  user_id: string;
  action: 'accept' | 'decline';
  team_name?: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, user_id, action, team_name }: CompleteInvitationRequest = await req.json();
    
    console.log("Complete invitation request received:", { token, user_id, action, team_name });

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

    console.log("Found invitation:", { 
      id: invitation.id, 
      email: invitation.email, 
      manager_id: invitation.manager_id,
      invitation_type: invitation.invitation_type 
    });

    // Check if invitation has expired
    if (new Date() > new Date(invitation.expires_at)) {
      console.error("Invitation expired:", { expires_at: invitation.expires_at, now: new Date().toISOString() });
      throw new Error("Invitation has expired");
    }

    // Validate that the user exists in auth.users first
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user_id);
    
    if (authError || !authUser?.user) {
      console.error("User does not exist in auth.users:", { user_id, authError });
      throw new Error("Invalid user - user must be registered and authenticated first");
    }

    console.log("Validated auth user:", { id: authUser.user.id, email: authUser.user.email });

    // Get the user's profile - use maybeSingle to handle case where profile doesn't exist
    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profileError) {
      console.error("Error finding user profile:", profileError);
      throw new Error("User profile lookup failed: " + profileError.message);
    }

    let userProfile;
    if (!existingProfile) {
      console.log("No profile found, creating new profile for authenticated user:", user_id);
      
      // Create profile for the authenticated user
      const { data: newProfile, error: createProfileError } = await supabase
        .from("profiles")
        .insert({
          user_id: user_id,
          role: 'employee',
          onboarding_completed: false,
          full_name: authUser.user.user_metadata?.full_name,
          display_name: authUser.user.user_metadata?.display_name,
          email: authUser.user.email
        })
        .select()
        .single();

      if (createProfileError) {
        console.error("Error creating user profile:", createProfileError);
        throw new Error("Failed to create user profile: " + createProfileError.message);
      }

      console.log("Created new user profile:", { id: newProfile.id, user_id: newProfile.user_id });
      userProfile = newProfile;
    } else {
      console.log("Found existing user profile:", { id: existingProfile.id, user_id: existingProfile.user_id });
      userProfile = existingProfile;
    }

    console.log("Using user profile:", { id: userProfile.id, user_id: userProfile.user_id });

    if (action === 'accept') {
      console.log("Processing invitation acceptance for type:", invitation.invitation_type);
      
      if (invitation.invitation_type === 'manager_request') {
        console.log("Processing manager request invitation");
        
        // Check if user is already a manager with an active team
        const { data: existingTeamMembers, error: teamCheckError } = await supabase
          .from("team_memberships")
          .select("*")
          .eq("manager_id", userProfile.id)
          .limit(1);

        if (teamCheckError) {
          console.error("Error checking existing team:", teamCheckError);
        }

        // Update the invited user to manager role and set team name
        const finalTeamName = team_name || `${userProfile.display_name || userProfile.full_name || 'Manager'}'s Team`;
        
        const { error: promoteError } = await supabase
          .from("profiles")
          .update({ 
            role: 'manager',
            team_name: finalTeamName
          })
          .eq("id", userProfile.id);

        if (promoteError) {
          console.error("Error promoting user to manager:", promoteError);
          throw new Error("Failed to promote user to manager: " + promoteError.message);
        }

        console.log("Promoted user to manager with team name:", finalTeamName);

        // Create team membership with invited user as manager and inviter as first employee
        const { data: teamMembership, error: createTeamError } = await supabase
          .from("team_memberships")
          .insert({
            manager_id: userProfile.id,
            employee_1_id: invitation.manager_id
          })
          .select()
          .single();

        if (createTeamError) {
          console.error("Error creating team membership:", createTeamError);
          throw new Error("Failed to create team membership: " + createTeamError.message);
        }

        console.log("Created team membership with manager as leader and inviter as first employee");

        // Set up sharing preferences for the new manager-employee relationship
        const { error: sharingError } = await supabase
          .from("sharing_preferences")
          .insert({
            user_id: invitation.manager_id,
            manager_id: userProfile.id,
            share_profile: true,
            share_conversations: true,
            share_insights: true,
            share_ocean_profile: true,
            share_progress: true,
            share_strengths: true,
            share_manager_recommendations: true
          });

        if (sharingError) {
          console.error("Error setting up sharing preferences:", sharingError);
        } else {
          console.log("Set up sharing preferences for new team member");
        }

      } else {
        // Handle team_member invitation (existing logic)
        console.log("Processing team member invitation");
        
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
          const defaultTeamName = managerProfile.team_name || `${managerProfile.display_name || managerProfile.full_name || 'Team'}'s Team`;
          
          const { error: promoteManagerError } = await supabase
            .from("profiles")
            .update({ 
              role: "manager",
              team_name: defaultTeamName
            })
            .eq("id", invitation.manager_id);

          if (promoteManagerError) {
            console.error("Error promoting manager:", promoteManagerError);
          } else {
            console.log("Promoted manager to manager role with team name:", defaultTeamName);
          }
        }

        // Set up sharing preferences for team member
        const { error: sharingError } = await supabase
          .from("sharing_preferences")
          .insert({
            user_id: userProfile.id,
            manager_id: invitation.manager_id,
            share_profile: true,
            share_conversations: true,
            share_insights: true,
            share_ocean_profile: true,
            share_progress: true,
            share_strengths: true,
            share_manager_recommendations: true
          });

        if (sharingError) {
          console.error("Error setting up sharing preferences:", sharingError);
        } else {
          console.log("Set up sharing preferences for new team member");
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