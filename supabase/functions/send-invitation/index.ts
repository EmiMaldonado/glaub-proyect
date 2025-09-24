import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@4.0.0";
import { corsHeaders } from "../_shared/cors.ts";

interface InvitationRequest {
  email: string;
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
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT and get user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      throw new Error("Invalid token");
    }

    // Get user's profile or create one if it doesn't exist using service role
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile && !profileError) {
      // Profile doesn't exist, create one using service role to bypass RLS
      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          display_name: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating profile:", createError);
        throw new Error(`Failed to create user profile: ${createError.message}`);
      }

      profile = newProfile;
      console.log("Created new profile for user:", user.id);
    } else if (profileError) {
      console.error("Error fetching profile:", profileError);
      throw new Error(`Profile error: ${profileError.message}`);
    } else if (!profile) {
      throw new Error("Profile not found and could not be created");
    }

    const { email }: InvitationRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    // Check if invitation already exists for this email
    const { data: existingInvitation } = await supabase
      .from("invitations")
      .select("*")
      .eq("manager_id", profile.id)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvitation) {
      throw new Error("Invitation already sent to this email");
    }

    // Reemplazar la verificación con:
    // Eliminar invitación anterior pendiente si existe
    await supabase
      .from("invitations")
      .delete()
      .eq("invited_by_id", profile.id)
      .eq("email", email)
      .eq("status", "pending")
      .eq("invitation_type", invitationType);

    console.log("Previous invitation cleaned if existed");

    // Reemplazar la verificación con:
    // Eliminar invitación anterior pendiente si existe
    await supabase
      .from("invitations")
      .delete()
      .eq("invited_by_id", profile.id)
      .eq("email", email)
      .eq("status", "pending")
      .eq("invitation_type", invitationType);

    console.log("Previous invitation cleaned if existed");

    // Generate unique token
    const token = crypto.randomUUID();

    // Create invitation record
    const { data: invitation, error: invitationError } = await supabase
      .from("invitations")
      .insert({
        manager_id: profile.id,
        email,
        token,
      })
      .select()
      .single();

    if (invitationError) {
      console.error("Error creating invitation:", invitationError);
      throw new Error("Failed to create invitation");
    }

    // Use Supabase's built-in email invitation system
    const acceptUrl = `${supabaseUrl}/functions/v1/accept-invitation?token=${token}`;
    
    // Send invitation using Supabase's native auth system
    const { data: authInvitation, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: acceptUrl,
        data: {
          invitation_token: token,
          invited_by: profile.display_name || profile.full_name || 'Your colleague',
          role: 'team_member',
          invitation_type: 'team_invitation'
        }
      }
    );

    if (inviteError) {
      console.error("Error sending invitation email:", inviteError);
      // Don't throw error - invitation record was created, just log the email issue
      console.log("Invitation record created but email failed to send:", invitation.id);
    } else {
      console.log("Invitation sent successfully via Supabase auth:", { 
        invitationId: invitation.id, 
        authInvitation 
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitation: {
          id: invitation.id,
          email: invitation.email,
          status: invitation.status,
          invited_at: invitation.invited_at
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});