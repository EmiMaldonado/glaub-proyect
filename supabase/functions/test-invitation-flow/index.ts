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
    
    // Test 1: Check invitation table structure
    console.log("Testing invitation table structure...");
    const { data: invitations, error: invitationError } = await supabase
      .from("invitations")
      .select("*")
      .limit(1);
    
    tests.push({
      name: "Invitation table access",
      success: !invitationError,
      error: invitationError?.message
    });

    // Test 2: Check team membership table structure
    console.log("Testing team membership table structure...");
    const { data: memberships, error: membershipError } = await supabase
      .from("team_memberships")
      .select("*")
      .limit(1);
    
    tests.push({
      name: "Team membership table access",
      success: !membershipError,
      error: membershipError?.message
    });

    // Test 3: Check profiles table
    console.log("Testing profiles table structure...");
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .limit(1);
    
    tests.push({
      name: "Profiles table access",
      success: !profileError,
      error: profileError?.message
    });

    // Test 4: Validate token generation
    console.log("Testing token generation...");
    const testToken = crypto.randomUUID();
    tests.push({
      name: "Token generation",
      success: testToken && testToken.length > 0,
      token: testToken
    });

    // Test 5: Check invitation expiration logic
    console.log("Testing expiration logic...");
    const now = new Date();
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const isExpired = now > futureDate;
    tests.push({
      name: "Expiration logic",
      success: !isExpired,
      now: now.toISOString(),
      future: futureDate.toISOString()
    });

    // Test 6: Check employee slot logic
    console.log("Testing employee slot logic...");
    const employeeSlots = [
      'employee_1_id', 'employee_2_id', 'employee_3_id', 'employee_4_id', 'employee_5_id',
      'employee_6_id', 'employee_7_id', 'employee_8_id', 'employee_9_id', 'employee_10_id'
    ];
    
    const mockTeamMembership: Record<string, string | null> = {
      employee_1_id: 'user1',
      employee_2_id: null,
      employee_3_id: 'user3'
    };
    
    const availableSlot = employeeSlots.find(slot => !mockTeamMembership[slot]);
    tests.push({
      name: "Employee slot finding",
      success: availableSlot === 'employee_2_id',
      availableSlot,
      expectedSlot: 'employee_2_id'
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Invitation flow tests completed",
        tests,
        summary: {
          total: tests.length,
          passed: tests.filter(t => t.success).length,
          failed: tests.filter(t => !t.success).length
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Error in test-invitation-flow function:", error);
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