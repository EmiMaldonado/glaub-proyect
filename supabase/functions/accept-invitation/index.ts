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
    console.log("Processing invitation acceptance request");
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    
    console.log("Token received:", token ? "✓" : "✗");

    if (!token) {
      console.error("No token provided");
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #dc3545;">Invalid Link</h1>
            <p>No invitation token provided.</p>
            <a href="https://xn--glub-thesis-m8a.com/" style="color: #007bff;">Go to EmpathAI</a>
          </body>
        </html>
        `,
        {
          headers: { "Content-Type": "text/html" },
          status: 400,
        }
      );
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log("Looking up invitation with token:", token);

    // Find the invitation using service role
    const { data: invitation, error: invitationError } = await supabase
      .from("invitations")
      .select(`
        *,
        manager:profiles!invitations_manager_id_fkey(*)
      `)
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle();

    console.log("Invitation lookup result:", { 
      found: !!invitation, 
      error: invitationError?.message 
    });

    if (invitationError) {
      console.error("Database error:", invitationError);
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #dc3545;">Database Error</h1>
            <p>Error looking up invitation: ${invitationError.message}</p>
            <a href="https://xn--glub-thesis-m8a.com/" style="color: #007bff;">Go to EmpathAI</a>
          </body>
        </html>
        `,
        {
          headers: { "Content-Type": "text/html" },
          status: 500,
        }
      );
    }

    if (!invitation) {
      console.log("No pending invitation found for token");
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #dc3545;">Invalid or Used Invitation</h1>
            <p>This invitation link is invalid or has already been used.</p>
            <a href="https://xn--glub-thesis-m8a.com/" style="color: #007bff;">Go to EmpathAI</a>
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
      console.log("Invitation has expired");
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #dc3545;">Invitation Expired</h1>
            <p>This invitation has expired. Please ask your manager to send a new one.</p>
            <a href="https://xn--glub-thesis-m8a.com/" style="color: #007bff;">Go to EmpathAI</a>
          </body>
        </html>
        `,
        {
          headers: { "Content-Type": "text/html" },
          status: 400,
        }
      );
    }

    console.log("Checking if user exists for email:", invitation.email);

    // Check if user with this email already exists
    const { data: existingUser, error: userCheckError } = await supabase.auth.admin.listUsers();
    
    if (userCheckError) {
      console.error("Error checking users:", userCheckError);
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #dc3545;">Error</h1>
            <p>Error checking user accounts: ${userCheckError.message}</p>
            <a href="https://xn--glub-thesis-m8a.com/" style="color: #007bff;">Go to EmpathAI</a>
          </body>
        </html>
        `,
        {
          headers: { "Content-Type": "text/html" },
          status: 500,
        }
      );
    }
    
    const userExists = existingUser?.users?.find(u => u.email === invitation.email);
    console.log("User exists:", !!userExists);

    if (userExists) {
      console.log("Processing invitation for existing user:", userExists.id);
      
      // User exists - update their profile to link to manager and accept invitation
      const { data: userProfile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userExists.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching user profile:", profileError);
        throw new Error(`Profile lookup failed: ${profileError.message}`);
      }

      if (!userProfile) {
        console.error("User profile not found for user:", userExists.id);
        throw new Error("User profile not found");
      }

      console.log("Updating profile and invitation status");

      // Update user profile with manager_id and ensure employee role
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({ 
          manager_id: invitation.manager_id,
          role: 'employee'
        })
        .eq("id", userProfile.id);

      if (updateProfileError) {
        console.error("Error updating profile:", updateProfileError);
        throw new Error(`Failed to update user profile: ${updateProfileError.message}`);
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
        console.error("Error updating invitation:", updateInvitationError);
        throw new Error(`Failed to update invitation status: ${updateInvitationError.message}`);
      }

      // Check manager's current role and promote if needed
      const { data: managerProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", invitation.manager_id)
        .single();

      if (managerProfile?.role === "employee") {
        console.log("Promoting manager from employee to manager role");
        const { error: promoteManagerError } = await supabase
          .from("profiles")
          .update({ role: "manager" })
          .eq("id", invitation.manager_id);

        if (promoteManagerError) {
          console.error("Error promoting manager:", promoteManagerError);
        }
      }

      console.log("Invitation acceptance completed successfully");

      return new Response(
        `
        <html>
          <head>
            <meta http-equiv="refresh" content="3;url=https://xn--glub-thesis-m8a.com/dashboard">
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #28a745;">Welcome to the Team!</h1>
            <p>You've successfully joined ${invitation.manager?.display_name || invitation.manager?.full_name}'s team on EmpathAI.</p>
            <p>You can now log in to your existing account to access team features.</p>
            <p>Redirecting to dashboard in 3 seconds...</p>
            <a href="https://xn--glub-thesis-m8a.com/dashboard" 
               style="background-color: #007bff; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; 
                      font-weight: bold; margin-top: 20px;">
              Go to Dashboard Now
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
      console.log("User doesn't exist, redirecting to signup");
      // User doesn't exist - redirect to signup with special parameters
      const signupUrl = `https://xn--glub-thesis-m8a.com/auth?mode=signup&invitation_token=${token}&email=${encodeURIComponent(invitation.email)}`;
      
      return new Response(
        `
        <html>
          <head>
            <meta http-equiv="refresh" content="3;url=${signupUrl}">
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #007bff;">Create Your EmpathAI Account</h1>
            <p>You've been invited to join ${invitation.manager?.display_name || invitation.manager?.full_name}'s team on EmpathAI.</p>
            <p>Click the button below to create your account and join the team.</p>
            <p>Redirecting to signup in 3 seconds...</p>
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
        <head>
          <meta http-equiv="refresh" content="5;url=https://xn--glub-thesis-m8a.com/error?message=invitation-error">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #dc3545;">Error</h1>
          <p>An error occurred while processing your invitation: ${error.message}</p>
          <p>Redirecting to error page in 5 seconds...</p>
          <a href="https://xn--glub-thesis-m8a.com/" style="color: #007bff;">Go to EmpathAI</a>
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