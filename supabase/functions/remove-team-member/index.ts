import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

interface RemoveTeamMemberRequest {
  membershipId: string;
}

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

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !userProfile) {
      throw new Error("User profile not found");
    }

    if (userProfile.role !== 'manager') {
      throw new Error("Only managers can remove team members");
    }

    const { membershipId }: RemoveTeamMemberRequest = await req.json();

    if (!membershipId) {
      throw new Error("Membership ID is required");
    }

    console.log("Processing team member removal:", { 
      managerId: userProfile.id, 
      membershipId 
    });

    // Verify the team membership exists and belongs to this manager
    const { data: membership, error: membershipError } = await supabase
      .from("team_memberships")
      .select(`
        id,
        employee_id,
        manager_id,
        employee:profiles!team_memberships_employee_id_fkey(
          id, full_name, display_name
        )
      `)
      .eq("id", membershipId)
      .eq("manager_id", userProfile.id)
      .single();

    if (membershipError || !membership) {
      throw new Error("Team membership not found or unauthorized");
    }

    // Delete the team membership
    const { error: deleteError } = await supabase
      .from("team_memberships")
      .delete()
      .eq("id", membershipId);

    if (deleteError) {
      console.error("Error deleting team membership:", deleteError);
      throw new Error(`Failed to remove team member: ${deleteError.message}`);
    }

    console.log("Team membership deleted successfully");

    // Check if manager has any remaining team members
    const { data: remainingMembers, error: checkError } = await supabase
      .from("team_memberships")
      .select("id")
      .eq("manager_id", userProfile.id);

    let wasLastMember = false;

    if (checkError) {
      console.error("Error checking remaining team members:", checkError);
    } else if (!remainingMembers || remainingMembers.length === 0) {
      console.log("Manager has no remaining team members, demoting to employee");
      wasLastMember = true;
      
      // Auto-demote manager to employee and clear team name
      const { error: demoteError } = await supabase
        .from("profiles")
        .update({ 
          role: "employee", 
          team_name: null 
        })
        .eq("id", userProfile.id);

      if (demoteError) {
        console.error("Error demoting manager:", demoteError);
      } else {
        console.log("Manager successfully demoted to employee");
      }
    }

    // Fetch updated team members list
    const { data: updatedTeamMembers, error: teamError } = await supabase
      .from("team_memberships")
      .select(`
        id,
        employee_id,
        joined_at,
        employee:profiles!team_memberships_employee_id_fkey(
          id, user_id, full_name, display_name, role
        )
      `)
      .eq("manager_id", userProfile.id)
      .order("joined_at", { ascending: false });

    if (teamError) {
      console.error("Error fetching updated team members:", teamError);
    }

    const teamMembers = (updatedTeamMembers || []).map(membership => ({
      id: membership.employee.id,
      user_id: membership.employee.user_id,
      full_name: membership.employee.full_name,
      display_name: membership.employee.display_name,
      role: membership.employee.role,
      membershipId: membership.id
    }));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully removed ${membership.employee.display_name || membership.employee.full_name} from team`,
        teamMembers,
        wasLastMember,
        removedMember: {
          name: membership.employee.display_name || membership.employee.full_name
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Error in remove-team-member function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});