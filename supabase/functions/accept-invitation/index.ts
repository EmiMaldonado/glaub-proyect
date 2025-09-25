import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action") || "view";

  console.log("Accept invitation request:", { token, action, method: req.method });

  if (!token) {
    return new Response(getErrorHTML("Invalid invitation link"), {
      headers: { "Content-Type": "text/html" },
      status: 400,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get invitation details
    const { data: invitation, error: invitationError } = await supabase
      .from("invitations")
      .select(`
        *,
        manager:profiles!invitations_manager_id_fkey(display_name, full_name, team_name)
      `)
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (invitationError || !invitation) {
      console.error("Invitation not found:", invitationError);
      return new Response(getErrorHTML("Invitation not found or has expired"), {
        headers: { "Content-Type": "text/html" },
        status: 404,
      });
    }

    // Check if expired
    if (new Date() > new Date(invitation.expires_at)) {
      return new Response(getErrorHTML("This invitation has expired"), {
        headers: { "Content-Type": "text/html" },
        status: 410,
      });
    }

    const managerName = invitation.manager?.display_name || invitation.manager?.full_name || 'Your colleague';
    const teamName = invitation.manager?.team_name || `${managerName}'s Team`;

    // Handle POST requests (form submissions)
    if (req.method === "POST") {
      const formData = await req.formData();
      const formAction = formData.get("action");
      const userEmail = formData.get("email");

      console.log("Processing form submission:", { formAction, userEmail });

      if (!formAction || (formAction === "accept" && !userEmail)) {
        return new Response(getErrorHTML("Missing required information"), {
          headers: { "Content-Type": "text/html" },
          status: 400,
        });
      }

      // Find existing user by email
      let userId = null;
      if (userEmail) {
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users?.users?.find(u => u.email === userEmail);
        if (existingUser) {
          userId = existingUser.id;
        }
      }

      if (formAction === "accept") {
        if (!userId) {
          return new Response(getErrorHTML("User not found. Please make sure you're signed up with the correct email address."), {
            headers: { "Content-Type": "text/html" },
            status: 400,
          });
        }

        // Get or create user profile
        let { data: userProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (!userProfile) {
          // Create profile for user with boolean fields
          const { data: newProfile, error: profileError } = await supabase
            .from("profiles")
            .insert({
              user_id: userId,
              full_name: userEmail?.split('@')[0] || 'User',
              display_name: userEmail?.split('@')[0] || 'User',
              can_manage_teams: invitation.invitation_type === 'manager_request',
              can_be_managed: true
            })
            .select()
            .single();

          if (profileError) {
            console.error("Error creating user profile:", profileError);
            return new Response(getErrorHTML("Failed to create user profile"), {
              headers: { "Content-Type": "text/html" },
              status: 500,
            });
          }
          userProfile = newProfile;
        }

        // Insert into team_members table ONLY (no more dual table logic)
        const { error: memberError } = await supabase
          .from('team_members')
          .insert({
            team_id: invitation.manager_id,
            member_id: userProfile.id,
            role: invitation.invitation_type === 'manager_request' ? 'leader' : 'member'
          });

        if (memberError) {
          console.error('Error adding team member:', memberError);
          return new Response(getErrorHTML("Failed to add team member"), {
            headers: { "Content-Type": "text/html" },
            status: 500,
          });
        }

        // If manager_request, update can_manage_teams boolean
        if (invitation.invitation_type === 'manager_request') {
          await supabase
            .from('profiles')
            .update({ can_manage_teams: true })
            .eq('id', userProfile.id);
        }

        // Mark invitation as accepted
        await supabase
          .from('invitations')
          .update({ 
            status: 'accepted',
            accepted_at: new Date().toISOString()
          })
          .eq('id', invitation.id);

        const successMessage = invitation.invitation_type === 'manager_request'
          ? `Successfully accepted manager request from ${managerName}!`
          : `Successfully joined ${teamName}!`;
          
        return new Response(getSuccessHTML(successMessage), {
          headers: { "Content-Type": "text/html" },
          status: 200,
        });

      } else if (formAction === "decline") {
        // Mark invitation as declined
        await supabase
          .from('invitations')
          .update({ 
            status: 'declined',
            accepted_at: new Date().toISOString()
          })
          .eq('id', invitation.id);

        return new Response(getSuccessHTML("Successfully declined the invitation."), {
          headers: { "Content-Type": "text/html" },
          status: 200,
        });
      }
    }

    // GET request - show invitation details and form
    const invitationType = invitation.invitation_type === "manager_request" 
      ? "manager request" 
      : "team invitation";
      
    return new Response(getInvitationHTML(invitation, managerName, teamName, invitationType), {
      headers: { "Content-Type": "text/html" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Error in accept-invitation:", error);
    return new Response(getErrorHTML("An error occurred while processing your invitation"), {
      headers: { "Content-Type": "text/html" },
      status: 500,
    });
  }
});

function getInvitationHTML(invitation: any, managerName: string, teamName: string, invitationType: string) {
  const isManagerRequest = invitation.invitation_type === "manager_request";
  const actionText = isManagerRequest ? "become their manager" : "join their team";
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gläub Invitation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 500px;
            width: 100%;
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #2563eb, #3b82f6);
            color: white;
            text-align: center;
            padding: 30px 20px;
        }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .header p { opacity: 0.9; font-size: 16px; }
        .content { padding: 30px; }
        .invitation-details {
            background: #f8fafc;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 24px;
            border-left: 4px solid #2563eb;
        }
        .invitation-details h3 { color: #1e293b; margin-bottom: 8px; }
        .invitation-details p { color: #64748b; line-height: 1.5; }
        .form-group { margin-bottom: 20px; }
        .form-group label { 
            display: block;
            margin-bottom: 8px;
            color: #374151;
            font-weight: 500;
        }
        .form-group input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.2s;
        }
        .form-group input:focus {
            outline: none;
            border-color: #2563eb;
        }
        .button-group {
            display: flex;
            gap: 12px;
            margin-top: 24px;
        }
        .btn {
            flex: 1;
            padding: 14px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-accept {
            background: #16a34a;
            color: white;
        }
        .btn-accept:hover {
            background: #15803d;
        }
        .btn-decline {
            background: #dc2626;
            color: white;
        }
        .btn-decline:hover {
            background: #b91c1c;
        }
        .note {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            color: #92400e;
            padding: 12px;
            border-radius: 8px;
            font-size: 14px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Gläub Invitation</h1>
            <p>You've been invited to ${actionText}</p>
        </div>
        
        <div class="content">
            <div class="invitation-details">
                <h3>${managerName} has sent you a ${invitationType}</h3>
                <p>
                    ${isManagerRequest 
                      ? `They would like you to become their manager on Gläub, an AI-powered therapeutic conversation platform.`
                      : `They've invited you to join "${teamName}" on Gläub, an AI-powered therapeutic conversation platform that helps teams share insights and improve workplace well-being.`
                    }
                </p>
            </div>

            <form method="POST" id="invitationForm">
                <div class="form-group">
                    <label for="email">Your Email Address:</label>
                    <input 
                        type="email" 
                        id="email" 
                        name="email" 
                        value="${invitation.email}"
                        required
                        placeholder="Enter your email address"
                    />
                </div>

                <div class="button-group">
                    <button type="submit" name="action" value="accept" class="btn btn-accept">
                        ${isManagerRequest ? 'Accept Manager Role' : 'Join Team'}
                    </button>
                    <button type="submit" name="action" value="decline" class="btn btn-decline">
                        Decline
                    </button>
                </div>

                <div class="note">
                    <strong>Note:</strong> To accept this invitation, make sure you use the same email address (${invitation.email}) when creating your Gläub account.
                </div>
            </form>
        </div>
    </div>

    <script>
        document.getElementById('invitationForm').addEventListener('submit', function(e) {
            const submitBtn = e.submitter;
            const action = submitBtn.value;
            
            if (action === 'decline') {
                if (!confirm('Are you sure you want to decline this invitation?')) {
                    e.preventDefault();
                    return false;
                }
            }
            
            submitBtn.disabled = true;
            submitBtn.textContent = action === 'accept' ? 'Processing...' : 'Declining...';
        });
    </script>
</body>
</html>
  `;
}

function getSuccessHTML(message: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Success - Gläub</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 500px;
            width: 100%;
            text-align: center;
            padding: 40px;
        }
        .success-icon {
            width: 64px;
            height: 64px;
            background: #10b981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
        }
        .success-icon::after {
            content: '✓';
            color: white;
            font-size: 32px;
            font-weight: bold;
        }
        h1 { color: #065f46; margin-bottom: 16px; }
        p { color: #374151; line-height: 1.5; margin-bottom: 24px; }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon"></div>
        <h1>Success!</h1>
        <p>${message}</p>
        <a href="https://gläub-thesis.com" class="btn">Continue to Gläub</a>
    </div>
</body>
</html>
  `;
}

function getErrorHTML(message: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error - Gläub</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 500px;
            width: 100%;
            text-align: center;
            padding: 40px;
        }
        .error-icon {
            width: 64px;
            height: 64px;
            background: #dc2626;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
        }
        .error-icon::after {
            content: '!';
            color: white;
            font-size: 32px;
            font-weight: bold;
        }
        h1 { color: #7f1d1d; margin-bottom: 16px; }
        p { color: #374151; line-height: 1.5; margin-bottom: 24px; }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon"></div>
        <h1>Error</h1>
        <p>${message}</p>
        <a href="https://gläub-thesis.com" class="btn">Return to Gläub</a>
    </div>
</body>
</html>
  `;
}
