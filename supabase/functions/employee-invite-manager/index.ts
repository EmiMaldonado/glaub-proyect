import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@4.0.0";
import { corsHeaders } from "../_shared/cors.ts";

interface EmployeeManagerInvitationRequest {
  managerEmail: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
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
    const { data: existingInvitation } = await supabase
      .from("invitations")
      .select("*")
      .eq("email", managerEmail)
      .eq("invited_by_id", employeeProfile.id)
      .eq("invitation_type", "manager_request")
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvitation) {
      throw new Error("Manager invitation already sent to this email");
    }

    // Generate unique token
    const token = crypto.randomUUID();

    // Create invitation record - Employee → Manager flow
    const { data: invitation, error: invitationError } = await supabase
      .from("invitations")
      .insert({
        manager_id: employeeProfile.id, // The employee who will become manager if accepted
        email: managerEmail,
        token,
        invitation_type: "manager_request",
        invited_by_id: employeeProfile.id
      })
      .select()
      .single();

    if (invitationError) {
      console.error("Error creating manager invitation:", invitationError);
      throw new Error("Failed to create manager invitation");
    }

    const employeeName = employeeProfile.display_name || employeeProfile.full_name || 'Your colleague';
    const acceptUrl = `${supabaseUrl}/functions/v1/accept-manager-invitation?token=${token}`;
    
    // Send invitation email using Resend
    const { error: emailError } = await resend.emails.send({
      from: "EmpathAI <onboarding@resend.dev>",
      to: [managerEmail],
      subject: `${employeeName} wants you to be their manager on EmpathAI`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; text-align: center;">You've Been Requested as a Manager!</h1>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
              Hello! <strong>${employeeName}</strong> has requested you to be their manager on EmpathAI.
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              EmpathAI is an AI-powered therapeutic conversation platform that helps teams share insights and improve workplace well-being. As a manager, you'll be able to view shared insights and provide better support to your team.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${acceptUrl}" 
                 style="background-color: #16a34a; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; font-weight: bold; 
                        display: inline-block; margin-right: 10px;">
                Accept & Become Manager
              </a>
              <a href="${acceptUrl}&action=decline" 
                 style="background-color: #dc2626; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; font-weight: bold; 
                        display: inline-block;">
                Decline Request
              </a>
            </div>
            
            <p style="font-size: 14px; color: #64748b; margin-top: 20px;">
              If the buttons don't work, you can copy and paste this link into your browser:
              <br><a href="${acceptUrl}" style="color: #2563eb;">${acceptUrl}</a>
            </p>
          </div>
          
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">
              This manager request was sent by ${employeeName}. If you believe this was sent in error, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    });

    if (emailError) {
      console.error("Error sending manager invitation email:", emailError);
      throw new Error(`Failed to send invitation email: ${emailError.message}`);
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