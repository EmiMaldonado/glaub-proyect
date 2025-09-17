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
      
      // User exists - get their profile and add to team
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

      console.log("Adding user to team membership and updating invitation status");

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

      // Add team membership - find next available slot
      console.log("Finding existing team membership for manager:", invitation.manager_id);
      
      // Get or create team membership record
      let { data: teamMembership, error: membershipFetchError } = await supabase
        .from("team_memberships")
        .select("*")
        .eq("manager_id", invitation.manager_id)
        .maybeSingle();

      if (membershipFetchError && membershipFetchError.code !== 'PGRST116') {
        console.error("Error fetching team membership:", membershipFetchError);
        throw new Error(`Failed to fetch team membership: ${membershipFetchError.message}`);
      }

      if (!teamMembership) {
        // Create new team membership record
        console.log("Creating new team membership record");
        const { data: newMembership, error: createError } = await supabase
          .from("team_memberships")
          .insert({
            manager_id: invitation.manager_id,
            employee_1_id: userProfile.id
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating team membership:", createError);
          throw new Error(`Failed to create team membership: ${createError.message}`);
        }
        
        teamMembership = newMembership;
        console.log("Created new team membership with first employee");
      } else {
        // Find next available employee slot
        console.log("Adding to existing team membership");
        const employeeSlots = [
          'employee_1_id', 'employee_2_id', 'employee_3_id', 'employee_4_id', 'employee_5_id',
          'employee_6_id', 'employee_7_id', 'employee_8_id', 'employee_9_id', 'employee_10_id'
        ];
        
        // Check if user is already in the team
        const isAlreadyMember = employeeSlots.some(slot => teamMembership[slot] === userProfile.id);
        if (isAlreadyMember) {
          console.log("User is already a member of this team");
        } else {
          // Find first available slot
          const availableSlot = employeeSlots.find(slot => !teamMembership[slot]);
          
          if (!availableSlot) {
            throw new Error("Team is full (maximum 10 members)");
          }
          
          console.log("Adding user to slot:", availableSlot);
          const { error: updateError } = await supabase
            .from("team_memberships")
            .update({ [availableSlot]: userProfile.id })
            .eq("id", teamMembership.id);

          if (updateError) {
            console.error("Error updating team membership:", updateError);
            throw new Error(`Failed to add user to team: ${updateError.message}`);
          }
        }
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

      // Check manager's current role and promote if needed (with team name)
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
            role: "manager",
            team_name: teamName
          })
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
            <p>You've successfully joined ${managerProfile?.team_name || `${invitation.manager?.display_name || invitation.manager?.full_name}'s team`} on EmpathAI.</p>
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
            <p>You've been invited to join ${invitation.manager?.team_name || `${invitation.manager?.display_name || invitation.manager?.full_name}'s team`} on EmpathAI.</p>
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