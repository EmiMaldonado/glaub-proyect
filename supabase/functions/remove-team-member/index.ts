import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

interface RemoveTeamMemberRequest {
  member_id: string;
  manager_id: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  console.log(`${req.method} request to remove-team-member`);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, { 
      headers: corsHeaders,
      status: 200
    });
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

    const { member_id, manager_id }: RemoveTeamMemberRequest = await req.json();

    if (!member_id) {
      throw new Error("Member ID is required");
    }

    console.log("Processing team member removal:", { 
      managerId: userProfile.id, 
      member_id 
    });

    // Verify the team member exists and belongs to this manager's team
    const { data: teamMember, error: memberError } = await supabase
      .from("team_members")
      .select("*")
      .eq("member_id", member_id)
      .eq("team_id", userProfile.id)
      .single();

    if (memberError || !teamMember) {
      throw new Error("Team member not found or unauthorized");
    }

    // Get the member's profile info for response
    const { data: memberProfile, error: memberProfileError } = await supabase
      .from("profiles")
      .select("full_name, display_name")
      .eq("id", member_id)
      .single();

    if (memberProfileError) {
      console.warn("Could not fetch member profile for response:", memberProfileError);
    }

    const memberName = memberProfile?.display_name || memberProfile?.full_name || "Unknown member";

    // Delete the team member
    const { error: deleteError } = await supabase
      .from("team_members")
      .delete()
      .eq("member_id", member_id)
      .eq("team_id", userProfile.id);

    if (deleteError) {
      console.error("Error deleting team member:", deleteError);
      throw new Error(`Failed to remove team member: ${deleteError.message}`);
    }

    console.log("Team member deleted successfully");

    // Check if manager has any remaining team members
    const { data: remainingMembers, error: checkError } = await supabase
      .from("team_members")
      .select("member_id")
      .eq("team_id", userProfile.id);

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
      .from("team_members")
      .select("member_id")
      .eq("team_id", userProfile.id);

    if (teamError) {
      console.error("Error fetching updated team members:", teamError);
    }

    // Get full profile data for remaining team members
    const teamMemberIds = (updatedTeamMembers || []).map(tm => tm.member_id);
    
    let teamMembers: any[] = [];
    if (teamMemberIds.length > 0) {
      const { data: memberProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, display_name, role")
        .in("id", teamMemberIds);

      if (!profilesError && memberProfiles) {
        teamMembers = memberProfiles;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully removed ${memberName} from team`,
        teamMembers,
        wasLastMember,
        removedMember: {
          name: memberName
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