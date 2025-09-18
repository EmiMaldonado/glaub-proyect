import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

interface LeaveTeamRequest {
  managerId: string;
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
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !userProfile) {
      throw new Error("User profile not found");
    }

    const { managerId }: LeaveTeamRequest = await req.json();

    if (!managerId) {
      throw new Error("Manager ID is required");
    }

    console.log("Processing team leave request:", { 
      employeeId: userProfile.id, 
      managerId 
    });

    // Verify the team membership exists
    const { data: teamMembership, error: membershipError } = await supabase
      .from("team_members")
      .select("member_id, team_id")
      .eq("member_id", userProfile.id)
      .eq("team_id", managerId)
      .single();

    if (membershipError || !teamMembership) {
      throw new Error("Team membership not found");
    }

    // Delete the team membership
    const { error: deleteError } = await supabase
      .from("team_members")
      .delete()
      .eq("member_id", userProfile.id)
      .eq("team_id", managerId);

    if (deleteError) {
      console.error("Error deleting team membership:", deleteError);
      throw new Error(`Failed to leave team: ${deleteError.message}`);
    }

    console.log("Team membership deleted successfully");

    // Check if manager has any remaining team members
    const { data: remainingMembers, error: checkError } = await supabase
      .from("team_members")
      .select("member_id")
      .eq("team_id", managerId);

    if (checkError) {
      console.error("Error checking remaining team members:", checkError);
      // Don't throw error here, user has successfully left the team
    } else if (!remainingMembers || remainingMembers.length === 0) {
      console.log("Manager has no remaining team members, demoting to employee");
      
      // Auto-demote manager to employee and clear team name
      const { error: demoteError } = await supabase
        .from("profiles")
        .update({ 
          role: "employee", 
          team_name: null 
        })
        .eq("id", managerId);

      if (demoteError) {
        console.error("Error demoting manager:", demoteError);
        // Don't throw error here, user has successfully left the team
      } else {
        console.log("Manager successfully demoted to employee");
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Successfully left the team" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Error in leave-team function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});