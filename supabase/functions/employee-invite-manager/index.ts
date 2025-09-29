import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// Direct Supabase API implementation
const createClient = (url: string, key: string) => {
  return {
    from: (table: string) => ({
      select: (columns?: string) => ({
        eq: (column: string, value: any) => ({
          maybeSingle: async () => {
            const response = await fetch(`${url}/rest/v1/${table}?select=${columns || '*'}&${column}=eq.${value}`, {
              headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
            });
            return { data: await response.json(), error: null };
          },
          single: async () => {
            const response = await fetch(`${url}/rest/v1/${table}?select=${columns || '*'}&${column}=eq.${value}`, {
              headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
            });
            return { data: (await response.json())[0], error: null };
          }
        })
      }),
      insert: (data: any) => ({
        select: () => ({
          single: async () => {
            const response = await fetch(`${url}/rest/v1/${table}`, {
              method: 'POST',
              headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            return { data: (await response.json())[0], error: null };
          }
        })
      })
    }),
    auth: {
      getUser: async (jwt: string) => {
        const response = await fetch(`${url}/auth/v1/user`, {
          headers: { 'Authorization': `Bearer ${jwt}` }
        });
        return { data: { user: await response.json() }, error: null };
      }
    }
  };
};
import { corsHeaders } from "../_shared/cors.ts";

interface EmployeeManagerInvitationRequest {
  managerEmail: string;
}

// Direct API implementation for email sending
async function sendEmail(to: string, subject: string, html: string) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Gläub <noreply@resend.dev>",
      to: [to],
      subject: subject,
      html: html,
    }),
  });

  return await response.json();
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

    // Get employee profile
    const { data: employeeProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, team_name, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !employeeProfile) {
      throw new Error("Employee profile not found");
    }

    const { managerEmail }: EmployeeManagerInvitationRequest = await req.json();

    if (!managerEmail) {
      throw new Error("Manager email is required");
    }

    // Check if invitation already exists for this manager email from this employee
    const existingResponse = await fetch(`${supabaseUrl}/rest/v1/invitations?select=*&email=eq.${managerEmail}&invited_by_id=eq.${employeeProfile.id}&invitation_type=eq.manager_request&status=eq.pending`, {
      headers: { 'apikey': supabaseServiceKey, 'Authorization': `Bearer ${supabaseServiceKey}` }
    });
    const existingInvitations = await existingResponse.json();
    const existingInvitation = existingInvitations.length > 0 ? existingInvitations[0] : null;

    if (existingInvitation) {
      throw new Error("Manager invitation already sent to this email");
    }

    // Generate unique token
    const token = crypto.randomUUID();

    // Create invitation record - Employee → Manager flow
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/invitations`, {
      method: 'POST',
      headers: { 
        'apikey': supabaseServiceKey, 
        'Authorization': `Bearer ${supabaseServiceKey}`, 
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        manager_id: employeeProfile.id, // The employee who will become manager if accepted
        email: managerEmail,
        token,
        invitation_type: "manager_request",
        invited_by_id: employeeProfile.id
      })
    });
    const invitationData = await insertResponse.json();
    const invitation = Array.isArray(invitationData) ? invitationData[0] : invitationData;
    const invitationError = !insertResponse.ok;

    if (invitationError) {
      console.error("Error creating manager invitation:", invitationError);
      throw new Error("Failed to create manager invitation");
    }

    const employeeName = employeeProfile.display_name || employeeProfile.full_name || 'Your colleague';
    const baseUrl = "https://www.glaubinsights.org";
    const acceptUrl = `${baseUrl}/invitation/${token}`;
    
    // Send invitation email
    const emailResponse = await sendEmail(managerEmail, `${employeeName} invited you to be their manager`, `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; text-align: center;">
                <img src="https://www.glaubinsights.org/glaub-logo.png" alt="Gläub" style="height: 40px; margin-bottom: 30px;">

                <h1 style="color: #333; margin-bottom: 20px;">You've been invited to become a manager on Gläub</h1>

                <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                    <strong>${employeeName}</strong> has invited you to be their manager on Gläub, a platform for personality insights and professional development.
                </p>

                <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                    As their manager, you'll be able to:
                </p>

                <ul style="color: #666; font-size: 16px; line-height: 1.6; text-align: left; margin-bottom: 30px; padding-left: 20px;">
                    <li>View shared personality insights to better understand their work style</li>
                    <li>Access personalized recommendations for effective communication</li>
                    <li>Get suggestions for professional development opportunities</li>
                    <li>Build stronger team dynamics through personality awareness</li>
                </ul>

                <a href="${acceptUrl}" style="background: linear-gradient(135deg, hsl(214, 28%, 56%), hsl(214, 28%, 65%)); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block; margin-bottom: 20px;">
                    Accept Manager Invitation
                </a>

                <p style="color: #999; font-size: 14px; margin-top: 30px;">
                    If the button doesn't work, copy and paste this link in your browser:<br>
                    <span style="color: #6889B4; word-break: break-all;">${acceptUrl}</span>
                </p>

                <p style="color: #999; font-size: 12px; margin-top: 30px;">
                    This invitation will expire in 7 days.
                </p>

                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

                <p style="color: #999; font-size: 12px; text-align: center;">
                    If you didn't expect this invitation, you can safely ignore this email.
                </p>
            </div>
        </div>
      `);

    if (!emailResponse || emailResponse.error) {
      console.error("Error sending manager invitation email:", emailResponse?.error);
      throw new Error("Failed to send invitation email");
    }

    console.log("Manager request sent successfully:", { 
      invitationId: invitation.id, 
      email: managerEmail,
      requestedBy: employeeName
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitation: {
          id: invitation.id,
          email: invitation.email,
          status: invitation.status,
          invited_at: invitation.invited_at,
          invitation_type: invitation.invitation_type
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Error in employee-invite-manager function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});