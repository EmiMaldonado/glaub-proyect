import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.2';
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(resendApiKey);

interface EmployeeManagerInvitationRequest {
  managerEmail: string;
}

serve(async (req: Request) => {
  const startTime = Date.now();
  console.log(`🚀 Manager invitation request started at ${new Date().toISOString()}`);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the user from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("❌ No authorization header");
      throw new Error("No authorization header");
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error("❌ User authentication failed:", userError?.message);
      throw new Error("Unauthorized");
    }

    console.log(`👤 Request from user: ${user.email}`);

    // Get employee profile using SDK
    const { data: employeeProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, team_name, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !employeeProfile) {
      console.error("❌ Employee profile not found:", profileError?.message);
      throw new Error("Employee profile not found");
    }

    console.log(`📋 Employee profile: ${employeeProfile.display_name || employeeProfile.full_name}`);

    const { managerEmail }: EmployeeManagerInvitationRequest = await req.json();

    if (!managerEmail) {
      console.error("❌ Manager email is required");
      throw new Error("Manager email is required");
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(managerEmail)) {
      console.error("❌ Invalid email format");
      throw new Error("Invalid email format");
    }

    console.log(`📧 Manager email: ${managerEmail}`);

    // Check if invitation already exists using SDK
    const { data: existingInvitations, error: checkError } = await supabase
      .from('invitations')
      .select('*')
      .eq('email', managerEmail)
      .eq('invited_by_id', employeeProfile.id)
      .eq('invitation_type', 'manager_request')
      .eq('status', 'pending');

    if (checkError) {
      console.error("❌ Error checking existing invitations:", checkError.message);
      throw new Error("Failed to check existing invitations");
    }

    if (existingInvitations && existingInvitations.length > 0) {
      console.error("❌ Manager invitation already exists");
      throw new Error("Manager invitation already sent to this email");
    }

    // Generate unique token
    const token = crypto.randomUUID();
    console.log("🔑 Generated invitation token");

    // Create invitation record using SDK
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
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
      console.error("❌ Error creating manager invitation:", invitationError.message);
      throw new Error("Failed to create manager invitation");
    }

    console.log("✅ Invitation created successfully:", invitation.id);

    const employeeName = employeeProfile.display_name || employeeProfile.full_name || 'Your colleague';
    const baseUrl = "https://www.glaubinsights.org";
    const acceptUrl = `${baseUrl}/invitation/${token}`;
    
    console.log("📧 Sending invitation email...");
    
    // Send invitation email using Resend SDK
    const emailResponse = await resend.emails.send({
      from: "Gläub <noreply@resend.dev>",
      to: [managerEmail],
      subject: `${employeeName} invited you to be their manager`,
      html: `
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
      `
    });

    if (emailResponse.error) {
      console.error("❌ Error sending manager invitation email:", emailResponse.error);
      throw new Error("Failed to send invitation email");
    }

    console.log(`✅ Email sent successfully. ID: ${emailResponse.data?.id}`);

    const totalTime = Date.now() - startTime;
    console.log(`🏁 Manager invitation completed in ${totalTime}ms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitation: {
          id: invitation.id,
          email: invitation.email,
          status: invitation.status,
          invited_at: invitation.invited_at,
          invitation_type: invitation.invitation_type
        },
        processingTime: totalTime
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`💥 Error in employee-invite-manager function (${totalTime}ms):`, error.message);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        processingTime: totalTime
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});