import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

interface AcceptInvitationRequest {
  token: string;
  action?: 'accept' | 'decline';
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
    const { token, action = 'accept', team_name }: AcceptInvitationRequest = await req.json();
    
    console.log("Unified accept invitation request received:", { token, action, team_name });

    if (!token) {
      throw new Error("Token is required");
    }

    // Validate the action parameter
    if (action !== 'accept' && action !== 'decline') {
      throw new Error('Invalid action. Must be "accept" or "decline"');
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT (Supabase handles JWT verification automatically when verify_jwt = true)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No Authorization header provided");
      throw new Error('Authorization header is required');
    }

    const jwt = authHeader.replace('Bearer ', '');
    console.log("Processing request with JWT token present");

    // Get user from the JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      console.error("Error getting user from JWT:", userError);
      throw new Error("Invalid or expired authentication token");
    }

    console.log("Authenticated user:", { id: user.id, email: user.email });

    // Find the invitation
    const { data: invitation, error: invitationError } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (invitationError) {
      console.error("Error finding invitation:", invitationError);
      throw new Error("Invalid or expired invitation");
    }

    if (!invitation) {
      throw new Error("Invalid or expired invitation");
    }

    // Verify the invitation is for this user's email
    if (invitation.email !== user.email) {
      throw new Error("This invitation is not for your email address");
    }

    console.log("Found invitation:", { 
      id: invitation.id, 
      email: invitation.email, 
      invitation_type: invitation.invitation_type 
    });

    // Check if invitation has expired
    if (new Date() > new Date(invitation.expires_at)) {
      throw new Error("Invitation has expired");
    }

    // Call the complete-invitation function
    const { data: completionResult, error: completionError } = await supabase.functions.invoke('complete-invitation', {
      body: {
        token: token,
        user_id: user.id,
        action: action,
        team_name: team_name
      }
    });

    if (completionError) {
      console.error("Error completing invitation:", completionError);
      throw new Error(completionError.message || "Failed to complete invitation");
    }

    if (!completionResult.success) {
      throw new Error(completionResult.error || "Failed to complete invitation");
    }

    console.log("Invitation completed successfully via complete-invitation function");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: completionResult.message,
        action: action,
        manager_name: completionResult.manager_name
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Error in unified-accept-invitation function:", {
      error: error.message,
      stack: error.stack
    });
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});