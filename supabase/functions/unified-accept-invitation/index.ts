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
    console.log("Processing unified invitation acceptance");
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
            <a href="https://xn--glub-thesis-m8a.com/" style="color: #007bff;">Go to Gläub</a>
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
        manager:profiles!invitations_manager_id_fkey(*),
        invited_by:profiles!invitations_invited_by_id_fkey(*)
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
            <a href="https://xn--glub-thesis-m8a.com/" style="color: #007bff;">Go to Gläub</a>
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
            <a href="https://xn--glub-thesis-m8a.com/" style="color: #007bff;">Go to Gläub</a>
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
            <p>This invitation has expired. Please request a new one.</p>
            <a href="https://xn--glub-thesis-m8a.com/" style="color: #007bff;">Go to Gläub</a>
          </body>
        </html>
        `,
        {
          headers: { "Content-Type": "text/html" },
          status: 400,
        }
      );
    }

    // Handle decline action first
    if (action === "decline") {
      console.log("Processing decline action");
      
      // Update invitation status to declined
      const { error: updateError } = await supabase
        .from("invitations")
        .update({ 
          status: "declined", 
          updated_at: new Date().toISOString() 
        })
        .eq("id", invitation.id);

      if (updateError) {
        console.error("Error updating invitation:", updateError);
      }

      // Create notification for the person who sent the invitation
      if (invitation.invited_by) {
        await supabase
          .from("notifications")
          .insert({
            user_id: invitation.invited_by.user_id,
            type: 'invitation_declined',
            title: 'Invitation Declined',
            message: `Your ${invitation.invitation_type === 'team_member' ? 'team' : 'manager'} invitation to ${invitation.email} was declined.`,
            data: {
              invitation_id: invitation.id,
              declined_email: invitation.email,
              invitation_type: invitation.invitation_type
            }
          });
      }

      return new Response(
        `
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #dc2626;">Invitation Declined</h1>
            <p>You have declined the ${invitation.invitation_type === 'team_member' ? 'team' : 'manager'} invitation.</p>
            <p>The person who sent the invitation has been notified.</p>
            <a href="https://xn--glub-thesis-m8a.com/" style="color: #007bff;">Go to Gläub</a>
          </body>
        </html>
        `,
        {
          headers: { "Content-Type": "text/html" },
          status: 200,
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
            <a href="https://xn--glub-thesis-m8a.com/" style="color: #007bff;">Go to Gläub</a>
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
      
      // User exists - get their profile and process invitation
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

      console.log("Processing invitation type:", invitation.invitation_type);

      if (invitation.invitation_type === 'team_member') {
        // Team member invitation - add user to team
        console.log("Processing team member invitation");

        // Ensure user has employee role (if not manager already)
        if (userProfile.role !== 'manager') {
          const { error: updateRoleError } = await supabase
            .from("profiles")
            .update({ role: 'employee' })
            .eq("id", userProfile.id);

          if (updateRoleError) {
            console.error("Error updating user role:", updateRoleError);
          }
        }

        // Check if user is already a member of this team
        const { data: existingMembership } = await supabase
          .from("team_members")
          .select("*")
          .eq("team_id", invitation.manager_id)
          .eq("member_id", userProfile.id)
          .maybeSingle();

        if (!existingMembership) {
          // Add user to team using new scalable system
          const { error: membershipError } = await supabase
            .from("team_members")
            .insert({
              team_id: invitation.manager_id,
              member_id: userProfile.id,
              role: 'employee'
            });

          if (membershipError) {
            console.error("Error creating team membership:", membershipError);
            throw new Error(`Failed to add user to team: ${membershipError.message}`);
          }
        }

        // Promote manager if they were previously an employee
        const { data: managerProfile } = await supabase
          .from("profiles")
          .select("role, team_name, display_name, full_name")
          .eq("id", invitation.manager_id)
          .single();

        if (managerProfile?.role === "employee") {
          console.log("Promoting manager from employee to manager role");
          const teamName = managerProfile.team_name || `${managerProfile.display_name || managerProfile.full_name || 'Team'}'s Team`;
          
          const { error: promoteManagerError } = await supabase
            .from("profiles")
            .update({ 
              can_manage_teams: true,
              team_name: teamName
            })
            .eq("id", invitation.manager_id);

          if (promoteManagerError) {
            console.error("Error promoting manager:", promoteManagerError);
          }

          // Also add manager to their own team if not already there
          const { data: managerMembership } = await supabase
            .from("team_members")
            .select("*")
            .eq("team_id", invitation.manager_id)
            .eq("member_id", invitation.manager_id)
            .maybeSingle();

          if (!managerMembership) {
            await supabase
              .from("team_members")
              .insert({
                team_id: invitation.manager_id,
                member_id: invitation.manager_id,
                can_manage_teams: true
              });
          }
        }

        // Auto-setup sharing preferences with intelligent defaults
        try {
          await supabase.rpc('setup_default_sharing_preferences', {
            target_user_id: userProfile.user_id,
            target_manager_id: invitation.manager_id,
          });
          
          // Send welcome notification
          await supabase.rpc('send_welcome_notification', {
            target_user_id: userProfile.user_id,
            notification_type: 'joined_team',
            team_name: managerProfile?.team_name,
          });
          
          console.log('Auto-configuration completed for new team member');
        } catch (configError) {
          console.error('Auto-configuration failed (non-critical):', configError);
          // Don't fail the invitation acceptance for configuration errors
        }

      } else if (invitation.invitation_type === 'manager_request') {
        // Manager request invitation - assign manager to employee
        console.log("Processing manager request invitation");

        // Update employee's manager_id
        const { error: updateManagerError } = await supabase
          .from("profiles")
          .update({ manager_id: invitation.manager_id })
          .eq("id", userProfile.id);

        if (updateManagerError) {
          console.error("Error updating employee's manager:", updateManagerError);
          throw new Error(`Failed to assign manager: ${updateManagerError.message}`);
        }

        // Promote the manager if they were previously an employee
        const { data: managerProfile } = await supabase
          .from("profiles")
          .select("role, team_name, display_name, full_name")
          .eq("id", invitation.manager_id)
          .single();

        if (managerProfile?.role === "employee") {
          console.log("Promoting user to manager role");
          const teamName = managerProfile.team_name || `${managerProfile.display_name || managerProfile.full_name || 'Team'}'s Team`;
          
          const { error: promoteError } = await supabase
            .from("profiles")
            .update({ 
              can_manage_teams: true,
              team_name: teamName
            })
            .eq("id", invitation.manager_id);

          if (promoteError) {
            console.error("Error promoting to manager:", promoteError);
          }
        }

        // Add both manager and employee to team using new system
        // First ensure manager is in their own team
        const { error: managerTeamError } = await supabase
          .from("team_members")
          .insert({
            team_id: invitation.manager_id,
            member_id: invitation.manager_id,
            can_manage_teams: true
          });

        // Then add employee to manager's team
        const { error: employeeTeamError } = await supabase
          .from("team_members")
          .insert({
            team_id: invitation.manager_id,
            member_id: userProfile.id,
            role: 'employee'
          });

        if (employeeTeamError && employeeTeamError.code !== '23505') { // Ignore duplicate key errors
          console.error("Error adding employee to team:", employeeTeamError);
        }

        // Create notifications for both parties
        await Promise.all([
          // Notification for the employee
          supabase
            .from("notifications")
            .insert({
              user_id: userProfile.user_id,
              type: 'manager_assigned',
              title: 'Manager Assigned',
              message: `${invitation.manager?.display_name || invitation.manager?.full_name} is now your manager.`,
              data: {
                manager_id: invitation.manager_id,
                manager_name: invitation.manager?.display_name || invitation.manager?.full_name
              }
            }),
          // Notification for the new manager
          supabase
            .from("notifications")
            .insert({
              user_id: invitation.manager?.user_id,
              type: 'team_member_added',
              title: 'New Team Member Added',
              message: `${userProfile.display_name || userProfile.full_name} has accepted your manager request and joined your team.`,
              data: {
                employee_id: userProfile.id,
                employee_name: userProfile.display_name || userProfile.full_name
              }
            })
        ]);

        // Auto-setup sharing preferences with intelligent defaults
        try {
          await supabase.rpc('setup_default_sharing_preferences', {
            target_user_id: userProfile.user_id,
            target_manager_id: invitation.manager_id,
          });
          
          // Send welcome notification
          await supabase.rpc('send_welcome_notification', {
            target_user_id: userProfile.user_id,
            notification_type: 'joined_team',
            team_name: managerProfile?.team_name,
          });
          
          console.log('Auto-configuration completed for manager request');
        } catch (configError) {
          console.error('Auto-configuration failed (non-critical):', configError);
          // Don't fail the invitation acceptance for configuration errors
        }
      }

      // Update invitation status to accepted
      const { error: updateInvitationError } = await supabase
        .from("invitations")
        .update({ 
          status: "accepted", 
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", invitation.id);

      if (updateInvitationError) {
        console.error("Error updating invitation:", updateInvitationError);
      }

      console.log("Invitation acceptance completed successfully");

      const successTitle = invitation.invitation_type === 'team_member' 
        ? 'Welcome to the Team!' 
        : 'Manager Request Accepted!';
        
      const successMessage = invitation.invitation_type === 'team_member'
        ? `You've successfully joined ${invitation.manager?.team_name || `${invitation.manager?.display_name || invitation.manager?.full_name}'s team`} on Gläub.`
        : `You've accepted the manager request from ${invitation.invited_by?.display_name || invitation.invited_by?.full_name}. You can now manage their insights and progress.`;

      return new Response(
        `
        <html>
          <head>
            <meta http-equiv="refresh" content="3;url=https://xn--glub-thesis-m8a.com/dashboard">
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #28a745;">${successTitle}</h1>
            <p>${successMessage}</p>
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
      const inviterName = invitation.invitation_type === 'team_member' 
        ? (invitation.manager?.display_name || invitation.manager?.full_name)
        : (invitation.invited_by?.display_name || invitation.invited_by?.full_name);
        
      const teamName = invitation.invitation_type === 'team_member'
        ? (invitation.manager?.team_name || `${inviterName}'s team`)
        : `Managing ${invitation.invited_by?.display_name || invitation.invited_by?.full_name}`;
        
      const signupUrl = `https://xn--glub-thesis-m8a.com/auth?mode=signup&invitation_token=${token}&email=${encodeURIComponent(invitation.email)}&invitation_type=${invitation.invitation_type}`;
      
      const signupTitle = invitation.invitation_type === 'team_member'
        ? 'Create Your Gläub Account'
        : 'Accept Manager Role on Gläub';
        
      const signupMessage = invitation.invitation_type === 'team_member'
        ? `You've been invited to join ${teamName} on Gläub.`
        : `You've been requested to be a manager on Gläub by ${inviterName}.`;
      
      return new Response(
        `
        <html>
          <head>
            <meta http-equiv="refresh" content="3;url=${signupUrl}">
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #007bff;">${signupTitle}</h1>
            <p>${signupMessage}</p>
            <p>Click the button below to create your account and ${invitation.invitation_type === 'team_member' ? 'join the team' : 'accept the manager role'}.</p>
            <p>Redirecting to signup in 3 seconds...</p>
            <a href="${signupUrl}" 
               style="background-color: #28a745; color: white; padding: 15px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; 
                      font-weight: bold; margin-top: 20px;">
              Create Account & ${invitation.invitation_type === 'team_member' ? 'Join Team' : 'Accept Manager Role'}
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
    console.error("Error in unified-accept-invitation function:", error);
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
          <a href="https://xn--glub-thesis-m8a.com/" style="color: #007bff;">Go to Gläub</a>
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