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
    console.log("Processing manager invitation request");
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const action = url.searchParams.get("action") || "accept";
    
    console.log("Token received:", token ? "✓" : "✗", "Action:", action);

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

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log("Looking up manager invitation with token:", token);

    // Find the manager invitation
    const { data: invitation, error: invitationError } = await supabase
      .from("invitations")
      .select(`
        *,
        invited_by:profiles!invitations_invited_by_id_fkey(*)
      `)
      .eq("token", token)
      .eq("invitation_type", "manager_request")
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
      console.log("No pending manager invitation found for token");
      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #dc3545;">Invalid or Used Invitation</h1>
            <p>This manager invitation link is invalid or has already been used.</p>
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
            <p>This manager invitation has expired. Please ask the employee to send a new request.</p>
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

    if (action === "decline") {
      console.log("Processing invitation decline");
      
      // Update invitation status to declined
      await supabase
        .from("invitations")
        .update({ status: "declined" })
        .eq("id", invitation.id);

      // Create notification for the employee who sent the request
      await supabase
        .from("notifications")
        .insert({
          user_id: invitation.invited_by.user_id,
          type: "invitation_declined",
          title: "Manager Request Declined",
          message: `Your manager request to ${invitation.email} was declined.`,
          data: { 
            manager_email: invitation.email,
            invitation_id: invitation.id 
          }
        });

      console.log("Manager invitation declined");

      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #dc2626;">Request Declined</h1>
            <p>You have declined the manager request from ${invitation.invited_by?.display_name || invitation.invited_by?.full_name}.</p>
            <p>They have been notified of your decision.</p>
            <a href="https://xn--glub-thesis-m8a.com/" style="color: #007bff;">Go to EmpathAI</a>
          </body>
        </html>
        `,
        {
          headers: { "Content-Type": "text/html" },
          status: 200,
        }
      );
    }

    console.log("Processing manager invitation acceptance for email:", invitation.email);

    // Check if manager (person accepting) already exists
    const { data: existingUsers, error: userCheckError } = await supabase.auth.admin.listUsers();
    
    if (userCheckError) {
      console.error("Error checking users:", userCheckError);
      throw new Error(`Error checking user accounts: ${userCheckError.message}`);
    }
    
    const managerUser = existingUsers?.users?.find(u => u.email === invitation.email);
    console.log("Manager user exists:", !!managerUser);

    if (managerUser) {
      // Manager exists - complete the relationship setup
      console.log("Setting up manager-employee relationship for existing user");
      
      // Get or create manager profile
      let { data: managerProfile, error: managerProfileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", managerUser.id)
        .maybeSingle();

      if (!managerProfile && !managerProfileError) {
        // Create manager profile if it doesn't exist
        const { data: newManagerProfile, error: createManagerError } = await supabase
          .from("profiles")
          .insert({
            user_id: managerUser.id,
            full_name: managerUser.user_metadata?.full_name || managerUser.email?.split('@')[0] || 'Manager',
            display_name: managerUser.user_metadata?.display_name || managerUser.user_metadata?.full_name || managerUser.email?.split('@')[0] || 'Manager',
            role: 'manager'
          })
          .select()
          .single();

        if (createManagerError) {
          throw new Error(`Failed to create manager profile: ${createManagerError.message}`);
        }
        managerProfile = newManagerProfile;
      } else if (managerProfileError) {
        throw new Error(`Manager profile error: ${managerProfileError.message}`);
      }

      // Update manager role and set team name if not already a manager
      const teamName = managerProfile.team_name || `${managerProfile.display_name || managerProfile.full_name || 'Team'}'s Team`;
      
      if (managerProfile.role !== 'manager') {
        await supabase
          .from("profiles")
          .update({ 
            role: 'manager',
            team_name: teamName
          })
          .eq("id", managerProfile.id);
      }

      // Update employee to set manager relationship
      await supabase
        .from("profiles")
        .update({ 
          manager_id: managerProfile.id,
          role: 'employee'
        })
        .eq("id", invitation.manager_id); // The employee who sent the request

      // Create team membership using the new team_members table
      console.log("Setting up team members in team_members table");
      
      // First, add the manager themselves to the team (if not already there)
      const { error: managerInsertError } = await supabase
        .from("team_members")
        .insert({
          team_id: managerProfile.id,
          member_id: managerProfile.id,
          role: 'manager'
        });

      if (managerInsertError && managerInsertError.code !== '23505') { // Ignore duplicate key errors
        console.error("Error adding manager to team_members:", managerInsertError);
      } else {
        console.log("Manager added to team_members successfully");
      }

      // Then add the employee who requested to be managed
      const { error: employeeInsertError } = await supabase
        .from("team_members")
        .insert({
          team_id: managerProfile.id,
          member_id: invitation.manager_id, // This is the employee's profile ID
          role: 'employee'
        });

      if (employeeInsertError && employeeInsertError.code !== '23505') { // Ignore duplicate key errors
        console.error("Error adding employee to team_members:", employeeInsertError);
      } else {
        console.log("Employee added to team_members successfully");
      }

      console.log("Team members created in team_members table");

      // Setup sharing preferences for the employee
      const { error: sharingError } = await supabase
        .from("sharing_preferences")
        .insert({
          user_id: invitation.invited_by.user_id,
          manager_id: managerProfile.id,
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
        // Don't fail the whole process for this
      } else {
        console.log("Sharing preferences setup completed for employee");
      }

      // Update invitation status
      await supabase
        .from("invitations")
        .update({ 
          status: "accepted", 
          accepted_at: new Date().toISOString() 
        })
        .eq("id", invitation.id);

      // Send welcome notifications
      try {
        // Send welcome notification to the new manager
        await supabase.functions.invoke('send_welcome_notification', {
          body: {
            target_user_id: managerUser.id,
            notification_type: 'new_manager',
            team_name: teamName
          }
        });
        console.log("Welcome notification sent to new manager");
      } catch (notifyError) {
        console.error("Error sending manager welcome notification:", notifyError);
        // Don't fail the process for notification errors
      }

      try {
        // Send welcome notification to the employee
        await supabase.functions.invoke('send_welcome_notification', {
          body: {
            target_user_id: invitation.invited_by.user_id,
            notification_type: 'joined_team',
            team_name: teamName
          }
        });
        console.log("Welcome notification sent to employee");
      } catch (notifyError) {
        console.error("Error sending employee welcome notification:", notifyError);
        // Don't fail the process for notification errors
      }

      console.log("Manager-employee relationship established successfully");

      return new Response(
        `
        <html>
          <head>
            <meta http-equiv="refresh" content="3;url=https://xn--glub-thesis-m8a.com/dashboard">
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #16a34a;">Welcome, Manager!</h1>
            <p>You have successfully accepted the manager request from ${invitation.invited_by?.display_name || invitation.invited_by?.full_name}.</p>
            <p>You can now log in to access your manager dashboard and view team insights.</p>
            <p>Redirecting to dashboard in 3 seconds...</p>
            <a href="https://xn--glub-thesis-m8a.com/dashboard" 
               style="background-color: #007bff; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; 
                      font-weight: bold; margin-top: 20px;">
              Go to Manager Dashboard
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
      console.log("Manager doesn't exist, redirecting to signup");
      // Manager doesn't exist - redirect to signup with special parameters
      const signupUrl = `https://xn--glub-thesis-m8a.com/auth?mode=signup&manager_invitation_token=${token}&email=${encodeURIComponent(invitation.email)}`;
      
      return new Response(
        `
        <html>
          <head>
            <meta http-equiv="refresh" content="3;url=${signupUrl}">
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #007bff;">Create Your Manager Account</h1>
            <p>You've been requested to be a manager for ${invitation.invited_by?.display_name || invitation.invited_by?.full_name} on EmpathAI.</p>
            <p>Click the button below to create your account and become their manager.</p>
            <p>Redirecting to signup in 3 seconds...</p>
            <a href="${signupUrl}" 
               style="background-color: #16a34a; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; 
                      font-weight: bold; margin-top: 20px;">
              Create Manager Account
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
    console.error("Error in accept-manager-invitation function:", error);
    return new Response(
      `
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #dc3545;">Error</h1>
          <p>An error occurred while processing your manager invitation: ${error.message}</p>
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