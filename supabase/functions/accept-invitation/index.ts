import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      throw new Error("Token is required");
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
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #dc3545;">Invalid or Expired Invitation</h1>
            <p>This invitation link is invalid or has already been used.</p>
            <a href="https://bmrifufykczudfxomenr.supabase.co" style="color: #007bff;">Go to EmpathAI</a>
          </body>
        </html>
        `,
        {
          headers: { "Content-Type": "text/html" },
          status: 400,
        }
      );
    }

    // Check if invitation has expired
    if (new Date() > new Date(invitation.expires_at)) {
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #dc3545;">Invitation Expired</h1>
            <p>This invitation has expired. Please ask your manager to send a new one.</p>
            <a href="https://bmrifufykczudfxomenr.supabase.co" style="color: #007bff;">Go to EmpathAI</a>
          </body>
        </html>
        `,
        {
          headers: { "Content-Type": "text/html" },
          status: 400,
        }
      );
    }

    // Check if user with this email already exists
    const { data: existingUser, error: userCheckError } = await supabase.auth.admin.listUsers();
    
    const userExists = existingUser?.users?.find(u => u.email === invitation.email);

    if (userExists) {
      // User exists - update their profile to link to manager and accept invitation
      const { data: userProfile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userExists.id)
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

      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #28a745;">Welcome to the Team!</h1>
            <p>You've successfully joined ${invitation.manager?.display_name || invitation.manager?.full_name}'s team on EmpathAI.</p>
            <p>You can now log in to your existing account to access team features.</p>
            <a href="https://bmrifufykczudfxomenr.supabase.co/auth" 
               style="background-color: #007bff; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; 
                      font-weight: bold; margin-top: 20px;">
              Log In to EmpathAI
            </a>
          </body>
        </html>
        `,
        {
          headers: { "Content-Type": "text/html" },
          status: 200,
        }
      );
    } else {
      // User doesn't exist - redirect to signup with special parameters
      const signupUrl = `https://bmrifufykczudfxomenr.supabase.co/auth?mode=signup&invitation_token=${token}&email=${encodeURIComponent(invitation.email)}`;
      
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #007bff;">Create Your EmpathAI Account</h1>
            <p>You've been invited to join ${invitation.manager?.display_name || invitation.manager?.full_name}'s team on EmpathAI.</p>
            <p>Click the button below to create your account and join the team.</p>
            <a href="${signupUrl}" 
               style="background-color: #28a745; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; 
                      font-weight: bold; margin-top: 20px;">
              Create Account & Join Team
            </a>
          </body>
        </html>
        `,
        {
          headers: { "Content-Type": "text/html" },
          status: 200,
        }
      );
    }

  } catch (error: any) {
    console.error("Error in accept-invitation function:", error);
    return new Response(
      `
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #dc3545;">Error</h1>
          <p>An error occurred while processing your invitation: ${error.message}</p>
          <a href="https://bmrifufykczudfxomenr.supabase.co" style="color: #007bff;">Go to EmpathAI</a>
        </body>
      </html>
      `,
      {
        headers: { "Content-Type": "text/html" },
        status: 500,
      }
    );
  }
});