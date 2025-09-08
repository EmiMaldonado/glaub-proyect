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
    const { token, user_id }: CompleteInvitationRequest = await req.json();

    if (!token || !user_id) {
      throw new Error("Token and user_id are required");
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    if (invitationError || !invitation) {
      throw new Error("Invalid or expired invitation");
    }

    // Check if invitation has expired
    if (new Date() > new Date(invitation.expires_at)) {
      throw new Error("Invitation has expired");
    }

    // Get the new user's profile
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (profileError || !userProfile) {
      throw new Error("User profile not found");
    }

    // Update user profile with manager_id
    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({ 
        manager_id: invitation.manager_id 
      })
      .eq("id", userProfile.id);

    if (updateProfileError) {
      throw new Error("Failed to update user profile");
    }

    // Update invitation status
    const { error: updateInvitationError } = await supabase
      .from("invitations")
      .update({ 
        status: "accepted", 
        accepted_at: new Date().toISOString() 
      })
      .eq("id", invitation.id);

    if (updateInvitationError) {
      throw new Error("Failed to update invitation status");
    }

    // Promote manager to manager role
    const { error: promoteManagerError } = await supabase
      .from("profiles")
      .update({ role: "manager" })
      .eq("id", invitation.manager_id);

    if (promoteManagerError) {
      console.error("Error promoting manager:", promoteManagerError);
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