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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const tests = [];
    
    // Test 1: Check if invitations table is accessible
    try {
      const { data: invitations, error: invitationError } = await supabase
        .from("invitations")
        .select("id, status, invitation_type, manager_id, expires_at")
        .limit(5);
        
      tests.push({
        name: "Invitations table access",
        success: !invitationError,
        data: invitations?.length || 0,
        error: invitationError?.message
      });
    } catch (error) {
      tests.push({
        name: "Invitations table access",
        success: false,
        error: error.message
      });
    }
    
    // Test 2: Check profiles table access
    try {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, display_name, full_name")
        .limit(3);
        
      tests.push({
        name: "Profiles table access",
        success: !profileError,
        data: profiles?.length || 0,
        error: profileError?.message
      });
    } catch (error) {
      tests.push({
        name: "Profiles table access",
        success: false,
        error: error.message
      });
    }
    
    // Test 3: Check team_memberships table access
    try {
      const { data: memberships, error: membershipError } = await supabase
        .from("team_memberships")
        .select("id, manager_id")
        .limit(3);
        
      tests.push({
        name: "Team memberships table access",
        success: !membershipError,
        data: memberships?.length || 0,
        error: membershipError?.message
      });
    } catch (error) {
      tests.push({
        name: "Team memberships table access",
        success: false,
        error: error.message
      });
    }
    
    // Test 4: Test invitation token validation logic
    try {
      const testToken = "invalid-token-test-123";
      const { data: testInvitation, error: testError } = await supabase
        .from("invitations")
        .select("*")
        .eq("token", testToken)
        .eq("status", "pending")
        .single();
        
      tests.push({
        name: "Invalid token handling",
        success: testError?.code === 'PGRST116', // No rows found - expected for invalid token
        error: testError?.message,
        expected: "Should return no rows for invalid token"
      });
    } catch (error) {
      tests.push({
        name: "Invalid token handling",
        success: false,
        error: error.message
      });
    }
    
    // Test 5: Check for pending invitations
    try {
      const { data: pendingInvitations, error: pendingError } = await supabase
        .from("invitations")
        .select("id, token, status, expires_at, invitation_type")
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .limit(5);
        
      tests.push({
        name: "Pending invitations query",
        success: !pendingError,
        data: pendingInvitations?.length || 0,
        error: pendingError?.message
      });
    } catch (error) {
      tests.push({
        name: "Pending invitations query",
        success: false,
        error: error.message
      });
    }

    const passedTests = tests.filter(t => t.success).length;
    const totalTests = tests.length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Database tests completed: ${passedTests}/${totalTests} passed`,
        tests: tests,
        summary: {
          total: totalTests,
          passed: passedTests,
          failed: totalTests - passedTests
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Error in test function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});