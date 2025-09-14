import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, TrendingUp, Users, Calendar, Plus, History, Settings, Target, Lightbulb, Share2, UserCheck, ChevronRight, Edit2, Save, X } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import TeamManagementModern from "@/components/TeamManagementModern";
import TeamMembersList from "@/components/ui/TeamMembersList";

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string;
  email?: string;
  membershipId: string;
  role: string;
  joinedAt?: string;
}

interface UserProfile {
  id: string;
  role: string;
  full_name: string;
  team_name?: string;
  display_name?: string;
}

const DashboardManagerModern = () => {
  const { user } = useAuth();
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedMemberData, setSelectedMemberData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [memberEmail, setMemberEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [editingTeamName, setEditingTeamName] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

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
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      setUserProfile(profile);
      setNewTeamName(profile?.team_name || `${profile?.display_name || profile?.full_name}'s Team`);

      // Get team members using new team_memberships table
      const { data: memberships } = await supabase
        .from('team_memberships')
        .select(`
          id,
          employee_id,
          joined_at,
          employee:profiles!team_memberships_employee_id_fkey(
            id, user_id, full_name, display_name
          )
        `)
        .eq('manager_id', profile?.id);

      const members = (memberships || []).map(membership => ({
        id: membership.employee.id,
        user_id: membership.employee.user_id,
        full_name: membership.employee.full_name,
        display_name: membership.employee.display_name,
        email: 'Email not accessible',
        membershipId: membership.id,
        role: 'employee',
        joinedAt: membership.joined_at
      }));

      setTeamMembers(members);

      // Auto-select first team member if available
      if (members && members.length > 0) {
        setSelectedMemberId(members[0].id);
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
      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', selectedMember.user_id)
        .order('created_at', { ascending: false });

      // Load insights for the selected team member
      const { data: insights } = await supabase
        .from('key_insights')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter insights that belong to user's conversations
      const userConversationIds = conversations?.map(c => c.id) || [];
      const userInsights = insights?.filter(insight => 
        userConversationIds.includes(insight.conversation_id)
      ) || [];

      // Calculate OCEAN profile
      let oceanProfile = null;
      if (userInsights.length > 0) {
        const personalityData = userInsights
          .map(i => i.personality_notes)
          .filter(Boolean);
          
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
      console.log('Sending invitation for:', memberEmail);
      
      // Call the invite-manager edge function to send email
      const { data, error } = await supabase.functions.invoke('invite-manager', {
        body: { managerEmail: memberEmail.trim() }
      });

      if (error) {
        console.error('Error sending invitation:', error);
        toast({
          title: "Error sending invitation",
          description: error.message || "Failed to send invitation email",
          variant: "destructive"
        });
        return;
      }

      console.log('Invitation sent successfully:', data);

      toast({
        title: "Invitation Sent!",
        description: `Invitation email sent to ${memberEmail}. They will receive instructions to join your team.`
      });
      setMemberEmail('');
      loadManagerData(); // Refresh data
    } catch (error: any) {
      console.error('Error inviting member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create invitation",
        variant: "destructive"
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveTeamMember = async (membershipId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('remove-team-member', {
        body: { membershipId }
      });

      if (error) {
        console.error('Error removing team member:', error);
        toast({
          title: "Error removing team member",
          description: error.message || "Failed to remove team member",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Team Member Removed",
        description: data.message || "Team member has been removed from your team"
      });

      // Update local team members state
      setTeamMembers(data.teamMembers || []);

      // If this was the last member, handle demotion
      if (data.wasLastMember) {
        toast({
          title: "Team Empty",
          description: "Your team is now empty. You have been demoted to employee status.",
          variant: "destructive"
        });

        // Refresh the page to update the user's role
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        // Clear selection if we removed the selected member
        if (selectedMemberId && !data.teamMembers.find((m: any) => m.id === selectedMemberId)) {
          setSelectedMemberId(data.teamMembers.length > 0 ? data.teamMembers[0].id : "");
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

  const updateTeamName = async () => {
    if (!newTeamName.trim()) {
      toast({
        title: "Team name required",
        description: "Please enter a team name",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_name: newTeamName.trim() })
        .eq('id', userProfile?.id);

      if (error) throw error;

      toast({
        title: "Team name updated",
        description: `Team name changed to "${newTeamName.trim()}"`,
      });

      setEditingTeamName(false);
      
      // Update local state
      if (userProfile) {
        userProfile.team_name = newTeamName.trim();
      }
    } catch (error: any) {
      console.error('Error updating team name:', error);
      toast({
        title: "Error updating team name",
        description: error.message || "Failed to update team name",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!userProfile || userProfile.role !== 'manager') {
    return (
      <div className="container mx-auto px-4 py-8">
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
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Welcome Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {userProfile?.team_name || `${userProfile?.display_name || userProfile?.full_name}'s Team`} 🎯
            </h1>
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

      {/* Team Name Management */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Team Settings
          </CardTitle>
          <CardDescription>
            Manage your team configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Label>Team Name:</Label>
            {editingTeamName ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Enter team name"
                />
                <Button size="sm" onClick={updateTeamName}>
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingTeamName(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {userProfile?.team_name || `${userProfile?.display_name || userProfile?.full_name}'s Team`}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setEditingTeamName(true)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => {
                      const selectedMember = teamMembers.find(m => m.id === selectedMemberId);
                      if (selectedMember && window.confirm(`Are you sure you want to remove this team member? This action cannot be undone.`)) {
                        handleRemoveTeamMember(selectedMember.membershipId);
                      }
                    }}
                  >
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
              <Input
                placeholder="Enter team member's email"
                type="email"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleInviteMember()}
              />
              <Button onClick={handleInviteMember} disabled={isInviting}>
                {isInviting ? 'Sending...' : 'Send Invitation'}
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
                      {selectedMemberData.stats.completedConversations}
                    </p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                  <Target className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-primary">
                      {selectedMemberData.stats.totalInsights}
                    </p>
                    <p className="text-sm text-muted-foreground">Insights Generated</p>
                  </div>
                  <Lightbulb className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Member OCEAN Profile */}
          {selectedMemberData.oceanProfile && (
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-secondary" />
                  {selectedMemberData.member.display_name || selectedMemberData.member.full_name}'s OCEAN Profile
                </CardTitle>
                <CardDescription>
                  Personality dimensions based on shared conversation data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {selectedMemberData.oceanProfile.openness || 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">Openness</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {selectedMemberData.oceanProfile.conscientiousness || 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">Conscientiousness</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {selectedMemberData.oceanProfile.extraversion || 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">Extraversion</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {selectedMemberData.oceanProfile.agreeableness || 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">Agreeableness</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {100 - (selectedMemberData.oceanProfile.neuroticism || 0)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Stability</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Insights */}
          {selectedMemberData.insights.length > 0 && (
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-accent" />
                  Recent Insights from {selectedMemberData.member.display_name || selectedMemberData.member.full_name}
                </CardTitle>
                <CardDescription>
                  Latest insights shared by this team member
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {selectedMemberData.insights.slice(0, 5).map((insight: any, index: number) => (
                    <div key={insight.id} className="border-l-4 border-accent pl-4 py-2">
                      <div className="space-y-2">
                        {insight.insights && insight.insights.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm text-accent">Key Insights:</h4>
                            <ul className="list-disc list-inside text-sm text-muted-foreground ml-2">
                              {insight.insights.slice(0, 3).map((item: string, idx: number) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {insight.next_steps && insight.next_steps.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm text-secondary">Recommended Actions:</h4>
                            <ul className="list-disc list-inside text-sm text-muted-foreground ml-2">
                              {insight.next_steps.slice(0, 2).map((step: string, idx: number) => (
                                <li key={idx}>{step}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <p className="text-xs text-muted-foreground">
                          {new Date(insight.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Team Members Management */}
      <TeamMembersList 
        teamMembers={teamMembers}
        teamName={userProfile?.team_name || `${userProfile?.display_name || userProfile?.full_name}'s Team`}
        onRemoveMember={(membershipId, memberName) => {
          const member = teamMembers.find(m => m.membershipId === membershipId);
          if (member) {
            handleRemoveTeamMember(membershipId);
          }
        }}
        loading={loading}
      />

      {/* Team Management Component */}
      <TeamManagementModern userProfile={userProfile} />
    </div>
  );
};

export default DashboardManagerModern;