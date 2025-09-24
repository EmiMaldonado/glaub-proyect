import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, TrendingUp, Users, Calendar, Plus, History, Settings, Target, Lightbulb, Share2, UserCheck, ChevronRight, Star } from "lucide-react";
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

      // Get team members using the new team_members table
      const { data: teamMemberData, error: teamError } = await supabase
        .from('team_members')
        .select(`
          *,
          member:profiles!team_members_member_id_fkey(
            id, 
            user_id, 
            full_name, 
            display_name, 
            email,
            role,
            created_at
          )
        `)
        .eq('team_id', profile?.id)
        .eq('role', 'employee')
        .order('joined_at', { ascending: false });

      if (teamError) {
        console.error('Error loading team members:', teamError);
        // Fallback to profiles table for backward compatibility
        const { data: fallbackMembers } = await supabase
          .from('profiles')
          .select('*')
          .eq('manager_id', profile?.id)
          .order('created_at', { ascending: false });
        
        setTeamMembers(fallbackMembers?.map(member => ({
          ...member,
          email: member.email || 'Email not accessible'
        })) || []);
      } else {
        // Extract member profiles from the join
        const members = (teamMemberData || [])
          .map(tm => tm.member)
          .filter(member => member !== null)
          .map(member => ({
            ...member,
            email: member.email || 'Email not accessible'
          }));
        
        setTeamMembers(members);
      }

      // Auto-select first team member if available
      if (teamMembers && teamMembers.length > 0) {
        setSelectedMemberId(teamMembers[0].id);
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

  // Update invite member to use team_members table
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
      // Use the unified invitation system
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Debes estar autenticado para enviar invitaciones');
        }
        
        // Usar token del usuario
        const { data, error } = await supabase.functions.invoke('unified-invitation', {
          body: {
            email: memberEmail.trim().toLowerCase(),
            invitationType: 'team_member',
            teamId: userProfile?.id
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      toast({
        title: "Invitation Sent!",
        description: `Team invitation sent to ${memberEmail}`
      });

      setMemberEmail('');
      loadManagerData(); // Refresh data
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive"
      });
    } finally {
      setIsInviting(false);
    }
  };

  // Remove member using the team_members table and remove-team-member function
  const handleRemoveTeamMember = async (memberId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('remove-team-member', {
        body: {
          member_id: memberId,
          manager_id: userProfile?.id
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to remove team member');
      }

      toast({
        title: "Team Member Removed",
        description: data.message || "Team member has been removed from your team"
      });

      // Reload manager data
      await loadManagerData();

      // Check if the manager was demoted (no more team members)
      if (data.wasLastMember) {
        toast({
          title: "Role Updated",
          description: "You've been moved back to employee status as you have no team members"
        });
        // Redirect to regular dashboard after a short delay
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
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
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-primary">
                      {Math.round(selectedMemberData.stats.averageSessionLength)}
                    </p>
                    <p className="text-sm text-muted-foreground">Avg Session (min)</p>
                  </div>
                  <Star className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardManager;
