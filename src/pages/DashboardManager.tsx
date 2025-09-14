import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, TrendingUp, Users, Calendar, Plus, History, Settings, Target, Lightbulb, Share2, UserCheck, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import TeamManagement from "@/components/TeamManagement";

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string;
  email?: string;
}

interface UserProfile {
  id: string;
  role: string;
  full_name: string;
}

const DashboardManager = () => {
  const { user } = useAuth();
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedMemberData, setSelectedMemberData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [memberEmail, setMemberEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (user) {
      loadManagerData();
    }
  }, [user]);

  useEffect(() => {
    if (selectedMemberId) {
      loadSelectedMemberData(selectedMemberId);
    }
  }, [selectedMemberId]);

  const loadManagerData = async () => {
    if (!user) return;
    try {
      setLoading(true);

      // Get manager profile
      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      setUserProfile(profile);

      // Get team members from team_memberships table CHANGE MADE BY CLAUDE AI
      const { data: teamMembership } = await supabase
        .from('team_memberships')
        .select(`
          *,
          employer_1:profiles!employer_id_1(id, user_id, full_name, display_name, email),
          employer_2:profiles!employer_id_2(id, user_id, full_name, display_name, email),
          employer_3:profiles!employer_id_3(id, user_id, full_name, display_name, email),
          employer_4:profiles!employer_id_4(id, user_id, full_name, display_name, email),
          employer_5:profiles!employer_id_5(id, user_id, full_name, display_name, email),
          employer_6:profiles!employer_id_6(id, user_id, full_name, display_name, email),
          employer_7:profiles!employer_id_7(id, user_id, full_name, display_name, email),
          employer_8:profiles!employer_id_8(id, user_id, full_name, display_name, email),
          employer_9:profiles!employer_id_9(id, user_id, full_name, display_name, email),
          employer_10:profiles!employer_id_10(id, user_id, full_name, display_name, email)
        `)
        .eq('manager_id', profile?.id)
        .single();

      // Extract all non-null employees from the 10 slots
      const members = [];
      if (teamMembership) {
        for (let i = 1; i <= 10; i++) {
          const employee = teamMembership[`employer_${i}`];
          if (employee) {
            members.push(employee);
          }
        }
      }

      // Set team members without trying to access emails from auth.users
      // Email access requires service role permissions which aren't available in client-side code
      const membersWithoutEmails = (members || []).map(member => ({
        ...member,
        email: 'Email not accessible'
      }));
      setTeamMembers(membersWithoutEmails || []);

      // Auto-select first team member if available
      if (membersWithoutEmails && membersWithoutEmails.length > 0) {
        setSelectedMemberId(membersWithoutEmails[0].id);
      }
    } catch (error) {
      console.error('Error loading manager data:', error);
      toast({
        title: "Error",
        description: "Failed to load team data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedMemberData = async (memberId: string) => {
    try {
      const selectedMember = teamMembers.find(m => m.id === memberId);
      if (!selectedMember) return;

      // Load conversations for the selected team member
      const { data: conversations } = await supabase.from('conversations').select('*').eq('user_id', selectedMember.user_id).order('created_at', {
        ascending: false
      });

      // Load insights for the selected team member
      const { data: insights } = await supabase.from('key_insights').select('*').order('created_at', {
        ascending: false
      });

      // Filter insights that belong to user's conversations
      const userConversationIds = conversations?.map(c => c.id) || [];
      const userInsights = insights?.filter(insight => userConversationIds.includes(insight.conversation_id)) || [];

      // Calculate OCEAN profile
      let oceanProfile = null;
      if (userInsights.length > 0) {
        const personalityData = userInsights.map(i => i.personality_notes).filter(Boolean);
        if (personalityData.length > 0) {
          oceanProfile = {
            openness: Math.round(personalityData.reduce((sum, p: any) => sum + (p?.openness || 0), 0) / personalityData.length),
            conscientiousness: Math.round(personalityData.reduce((sum, p: any) => sum + (p?.conscientiousness || 0), 0) / personalityData.length),
            extraversion: Math.round(personalityData.reduce((sum, p: any) => sum + (p?.extraversion || 0), 0) / personalityData.length),
            agreeableness: Math.round(personalityData.reduce((sum, p: any) => sum + (p?.agreeableness || 0), 0) / personalityData.length),
            neuroticism: Math.round(personalityData.reduce((sum, p: any) => sum + (p?.neuroticism || 0), 0) / personalityData.length)
          };
        }
      }
      setSelectedMemberData({
        member: selectedMember,
        conversations: conversations || [],
        insights: userInsights,
        oceanProfile,
        stats: {
          totalConversations: conversations?.length || 0,
          completedConversations: conversations?.filter(c => c.status === 'completed').length || 0,
          totalInsights: userInsights.length
        }
      });
    } catch (error) {
      console.error('Error loading member data:', error);
      toast({
        title: "Error",
        description: "Failed to load team member data",
        variant: "destructive"
      });
    }
  };

  // CHANGE MADE BY CLAUDE AI
  const handleInviteMember = async () => {
    if (!memberEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter team member's email address",
        variant: "destructive"
      });
      return;
    }

    setIsInviting(true);
    try {
      // First, find the user by email
      const { data: targetUser, error: userError } = await supabase
        .from('profiles')
        .select('id, email, full_name, display_name')
        .eq('email', memberEmail.trim().toLowerCase())
        .single();

      if (userError || !targetUser) {
        toast({
          title: "User Not Found",
          description: `No user found with email ${memberEmail}. They need to register first.`,
          variant: "destructive"
        });
        return;
      }

      // Check if team_memberships record exists for this manager
      let { data: teamRecord } = await supabase
        .from('team_memberships')
        .select('*')
        .eq('manager_id', userProfile?.id)
        .single();

      // Create team record if it doesn't exist
      if (!teamRecord) {
        const { data: newTeam, error: createError } = await supabase
          .from('team_memberships')
          .insert({ manager_id: userProfile?.id })
          .select()
          .single();

        if (createError) throw createError;
        teamRecord = newTeam;
      }

      // Find first available slot (employer_id_1 through employer_id_10)
      let availableSlot = null;
      for (let i = 1; i <= 10; i++) {
        if (!teamRecord[`employer_id_${i}`]) {
          availableSlot = i;
          break;
        }
      }

      if (!availableSlot) {
        toast({
          title: "Team Full",
          description: "You already have 10 team members. Remove someone first.",
          variant: "destructive"
        });
        return;
      }

      // Add user to the available slot
      const { error: updateError } = await supabase
        .from('team_memberships')
        .update({ [`employer_id_${availableSlot}`]: targetUser.id })
        .eq('id', teamRecord.id);

      if (updateError) throw updateError;

      toast({
        title: "Team Member Added!",
        description: `${targetUser.full_name || targetUser.email} has been added to your team.`
      });

      setMemberEmail('');
      loadManagerData(); // Refresh data
    } catch (error: any) {
      console.error('Error adding team member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add team member",
        variant: "destructive"
      });
    } finally {
      setIsInviting(false);
    }
  };

  // Remove member from team by setting manager_id to null CHANGE MADE BY CLAUDE AI
  const handleRemoveTeamMember = async (memberId: string) => {
    try {
      // Find which slot this member is in
      const { data: teamRecord } = await supabase
        .from('team_memberships')
        .select('*')
        .eq('manager_id', userProfile?.id)
        .single();

      if (!teamRecord) return;

      // Find the slot number for this member
      let slotToRemove = null;
      for (let i = 1; i <= 10; i++) {
        if (teamRecord[`employer_id_${i}`] === memberId) {
          slotToRemove = i;
          break;
        }
      }

      if (!slotToRemove) return;

      // Remove member from the slot
      const { error } = await supabase
        .from('team_memberships')
        .update({ [`employer_id_${slotToRemove}`]: null })
        .eq('id', teamRecord.id);

      if (error) throw error;

      toast({
        title: "Team Member Removed",
        description: "Team member has been removed from your team"
      });

      // Reload manager data
      await loadManagerData();

      // Check if no team members left
      const remainingMembers = teamMembers.filter(m => m.id !== memberId);
      if (remainingMembers.length === 0) {
        const { error: roleError } = await supabase
          .from('profiles')
          .update({ role: 'employee' })
          .eq('id', userProfile?.id);

        if (!roleError) {
          toast({
            title: "Role Updated",
            description: "You've been moved back to employee status as you have no team members"
          });
          window.location.href = '/dashboard';
        }
      }
    } catch (error: any) {
      console.error('Error removing team member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove team member",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    </div>;
  }

  if (!userProfile || userProfile.role !== 'manager') {
    return <div className="container mx-auto px-4 py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            You need to be a manager to access this dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/dashboard">Go to Regular Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Welcome Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Manager Dashboard 🎯</h1>
            <p className="text-lg text-muted-foreground">
              Manage your team and view shared insights from team members.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/dashboard" className="-bottom-0 bg-primary text-primary-foreground hover:bg-primary/90">
              <Target className="mr-2 h-4 w-4" />
              Go to Personal Dashboard
            </Link>
          </Button>
        </div>
      </div>

      {/* Team Overview */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Team Overview
          </CardTitle>
          <CardDescription>
            Manage your team members and view their shared insights
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {teamMembers.length > 0 ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="member-select">Select Team Member</Label>
                <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map(member => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.display_name || member.full_name} ({member.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserCheck className="h-4 w-4" />
                  {teamMembers.length} team member{teamMembers.length > 1 ? 's' : ''} under your management
                </div>
                
                {selectedMemberId && (
                  <Button variant="destructive" size="sm" onClick={() => {
                    if (window.confirm(`Are you sure you want to remove this team member? This action cannot be undone.`)) {
                      handleRemoveTeamMember(selectedMemberId);
                    }
                  }}>
                    Remove from Team
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No team members yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Invite team members to start viewing their shared insights
              </p>
            </div>
          )}

          {/* Invite New Member */}
          <div className="border-t pt-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Invite New Team Member
            </h4>
            <div className="flex gap-2">
              <Input placeholder="Enter team member's email" type="email" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleInviteMember()} />
              <Button onClick={handleInviteMember} disabled={isInviting}>
                {isInviting ? 'Creating...' : 'Create Invite Link'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Member Data */}
      {selectedMemberData && (
        <>
          {/* Member Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-primary">
                      {selectedMemberData.stats.totalConversations}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Sessions</p>
                  </div>
                  <MessageCircle className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="shadow-soft">
             
