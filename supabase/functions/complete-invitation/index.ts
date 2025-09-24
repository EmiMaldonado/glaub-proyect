import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

interface CompleteInvitationRequest {
  token: string;
  user_id?: string; // Optional for new users coming from email
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

    if (!token || !action) {
      console.error("Missing required fields:", { token: !!token, action: !!action });
      throw new Error("Token and action are required");
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
      .select("*")
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

    // Get manager profile for reference
    const { data: managerProfile, error: managerError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", invitation.manager_id)
      .single();

    if (managerError) {
      console.error("Error finding manager profile:", managerError);
      throw new Error("Manager profile not found: " + managerError.message);
    }

    console.log("Found manager profile:", { id: managerProfile.id, display_name: managerProfile.display_name });

    let authUser;
    let finalUserId = user_id;

    // If user_id is provided, validate it exists in auth.users
    if (user_id) {
      const { data: validatedUser, error: authError } = await supabase.auth.admin.getUserById(user_id);
      
      if (authError || !validatedUser?.user) {
        console.error("Provided user_id does not exist in auth.users:", { user_id, authError });
        throw new Error("Invalid user_id - user must be registered first");
      }
      
      authUser = validatedUser;
      console.log("Validated provided auth user:", { id: authUser.user.id, email: authUser.user.email });
    } else {
      // No user_id provided - check if there's an existing auth user with the invitation email
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === invitation.email);
      
      if (existingUser) {
        authUser = { user: existingUser };
        finalUserId = existingUser.id;
        console.log("Found existing auth user by email:", { id: existingUser.id, email: existingUser.email });
      } else {
        console.log("No existing auth user found for email:", invitation.email);
        // For decline action, we don't need a user account
        if (action === 'decline') {
          console.log("Declining invitation without user account");
        } else {
          throw new Error("To accept this invitation, you must first create an account with the email: " + invitation.email);
        }
      }
    }

    let userProfile = null;

    // Only get/create profile if we have a valid user (not for decline without user)
    if (finalUserId && authUser) {
      // Get the user's profile - use maybeSingle to handle case where profile doesn't exist
      const { data: existingProfile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", finalUserId)
        .maybeSingle();

      if (profileError) {
        console.error("Error finding user profile:", profileError);
        throw new Error("User profile lookup failed: " + profileError.message);
      }

      if (!existingProfile) {
        console.log("No profile found, creating new profile for authenticated user:", finalUserId);
        
        // Create profile for the authenticated user
        const { data: newProfile, error: createProfileError } = await supabase
          .from("profiles")
          .insert({
            user_id: finalUserId,
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
    }

    if (action === 'accept' && userProfile) {
      console.log("Processing invitation acceptance for type:", invitation.invitation_type);
      
      if (invitation.invitation_type === 'manager_request') {
        console.log("Processing manager request invitation");
        
        // Check if user is already a manager with an active team
        const { data: existingTeamMembers, error: teamCheckError } = await supabase
          .from("team_members")
          .select("*")
          .eq("team_id", userProfile.id)
          .eq("role", "manager")
          .limit(1);

        if (teamCheckError) {
          console.error("Error checking existing team:", teamCheckError);
        }

        // Update the invited user to manager role and set team name
        const finalTeamName = team_name || `${userProfile.display_name || userProfile.full_name || 'Manager'}'s Team`;
        
        const { error: promoteError } = await supabase
          .from("profiles")
          .update({ 
            can_manage_teams: true,
            team_name: finalTeamName
          })
          .eq("id", userProfile.id);

        if (promoteError) {
          console.error("Error promoting user to manager:", promoteError);
          throw new Error("Failed to promote user to manager: " + promoteError.message);
        }

        console.log("Promoted user to manager with team name:", finalTeamName);

        // Add both users to team_members table: new manager and inviter as employee
        const { error: addManagerError } = await supabase
          .from("team_members")
          .insert({
            team_id: userProfile.id,
            member_id: userProfile.id,
            can_manage_teams: true
          });

        if (addManagerError && addManagerError.code !== '23505') { // Ignore duplicate key errors
          console.error("Error adding manager to team_members:", addManagerError);
          throw new Error("Failed to add manager to team: " + addManagerError.message);
        }

        // Add inviter as first employee
        const { error: addEmployeeError } = await supabase
          .from("team_members")
          .insert({
            team_id: userProfile.id,
            member_id: invitation.manager_id,
            role: 'employee'
          });

        if (addEmployeeError && addEmployeeError.code !== '23505') { // Ignore duplicate key errors
          console.error("Error adding employee to team_members:", addEmployeeError);
          throw new Error("Failed to add employee to team: " + addEmployeeError.message);
        }

        // Update inviter's profile to have this manager
        const { error: updateInviterError } = await supabase
          .from("profiles")
          .update({ manager_id: userProfile.id })
          .eq("id", invitation.manager_id);

        if (updateInviterError) {
          console.error("Error updating inviter's manager_id:", updateInviterError);
        }

        console.log("Created team with manager and first employee");

        // Set up sharing preferences for the new manager-employee relationship
        // Get the inviter's user_id for sharing preferences
        const { data: inviterProfile, error: inviterFetchError } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", invitation.manager_id)
          .single();

        if (inviterFetchError) {
          console.error("Error fetching inviter profile:", inviterFetchError);
        } else {
          const { error: sharingError } = await supabase
            .from("sharing_preferences")
            .insert({
              user_id: inviterProfile.user_id, // Use auth user_id
              manager_id: userProfile.id, // Use profile_id
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


      } else {
        // Handle team_member invitation (existing logic)
        console.log("Processing team member invitation");
        
        // Check if user is already a team member
        const { data: existingMember, error: memberCheckError } = await supabase
          .from("team_members")
          .select("*")
          .eq("team_id", invitation.manager_id)
          .eq("member_id", userProfile.id)
          .maybeSingle();

        if (memberCheckError && memberCheckError.code !== 'PGRST116') {
          console.error("Error checking existing membership:", memberCheckError);
          throw new Error("Failed to check team membership: " + memberCheckError.message);
        }

        if (existingMember) {
          console.log("User is already a member of this team");
        } else {
          // Check team size limit (max 10 members including manager)
          const { count: teamSize, error: countError } = await supabase
            .from("team_members")
            .select("*", { count: 'exact', head: true })
            .eq("team_id", invitation.manager_id);

          if (countError) {
            console.error("Error counting team members:", countError);
            throw new Error("Failed to check team size: " + countError.message);
          }

          if (teamSize && teamSize >= 10) {
            throw new Error("Team is full (maximum 10 members)");
          }

          // Add user to team_members table
          console.log("Adding user to team_members table");
          const { error: addMemberError } = await supabase
            .from("team_members")
            .insert({
              team_id: invitation.manager_id,
              member_id: userProfile.id,
              role: 'employee'
            });

          if (addMemberError) {
            console.error("Error adding team member:", addMemberError);
            throw new Error("Failed to add user to team: " + addMemberError.message);
          }

          console.log("Successfully added user to team");
        }

        // Update user role to employee and set manager_id if not already a manager
        if (userProfile.role !== 'manager') {
          const { error: updateRoleError } = await supabase
            .from("profiles")
            .update({ 
              role: 'employee',
              manager_id: invitation.manager_id
            })
            .eq("id", userProfile.id);

          if (updateRoleError) {
            console.error("Error updating user role:", updateRoleError);
          } else {
            console.log("Updated user role to employee and set manager_id");
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
              can_manage_teams: true,
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
            user_id: userProfile.user_id, // Use auth user_id, not profile_id
            manager_id: invitation.manager_id, // Use profile_id for manager
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
      userId: finalUserId,
      managerId: invitation.manager_id,
      action: action
    });

    const responseMessage = action === 'accept' 
      ? "Invitation accepted successfully" 
      : "Invitation declined successfully";

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: responseMessage,
        action: action,
        manager_name: managerProfile?.display_name || managerProfile?.full_name
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Error in complete-invitation function:", {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Return more specific error status codes
    let statusCode = 400;
    if (error.message.includes("expired")) {
      statusCode = 410; // Gone
    } else if (error.message.includes("not found") || error.message.includes("Invalid")) {
      statusCode = 404; // Not Found
    } else if (error.message.includes("already")) {
      statusCode = 409; // Conflict
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        code: error.code || 'INVITATION_ERROR'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: statusCode,
      }
    );
  }
});