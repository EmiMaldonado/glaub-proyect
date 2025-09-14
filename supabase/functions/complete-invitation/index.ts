import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

interface CompleteInvitationRequest {
  token: string;
  user_id: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Complete invitation request received:", { token, user_id });
    
    const { token, user_id }: CompleteInvitationRequest = await req.json();

    if (!token || !user_id) {
      console.error("Missing required fields:", { token: !!token, user_id: !!user_id });
      throw new Error("Token and user_id are required");
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

    // Update user profile with manager_id
    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({ 
        manager_id: invitation.manager_id 
      })
      .eq("id", userProfile.id);

    if (updateProfileError) {
      console.error("Error updating user profile:", updateProfileError);
      throw new Error("Failed to update user profile: " + updateProfileError.message);
    }

    console.log("Updated user profile with manager_id:", invitation.manager_id);

    // Update invitation status
    const { error: updateInvitationError } = await supabase
      .from("invitations")
      .update({ 
        status: "accepted", 
        accepted_at: new Date().toISOString() 
      })
      .eq("id", invitation.id);

    if (updateInvitationError) {
      console.error("Error updating invitation status:", updateInvitationError);
      throw new Error("Failed to update invitation status: " + updateInvitationError.message);
    }

    console.log("Updated invitation status to accepted");

    // Promote manager to manager role
    const { error: promoteManagerError } = await supabase
      .from("profiles")
      .update({ role: "manager" })
      .eq("id", invitation.manager_id);

    if (promoteManagerError) {
      console.error("Error promoting manager:", promoteManagerError);
    } else {
      console.log("Promoted manager to manager role");
    }

    console.log("Invitation completed successfully:", { 
      invitationId: invitation.id, 
      userId: user_id,
      managerId: invitation.manager_id 
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Invitation completed successfully",
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