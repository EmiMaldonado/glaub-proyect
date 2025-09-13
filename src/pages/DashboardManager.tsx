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
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      setUserProfile(profile);

      // Get team members
      const { data: members } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, display_name')
        .eq('manager_id', profile?.id);

      // Get emails for team members
      const membersWithEmails = await Promise.all((members || []).map(async (member) => {
        const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
        return {
          ...member,
          email: userData.user?.email
        };
      }));

      setTeamMembers(membersWithEmails || []);

      // Auto-select first team member if available
      if (membersWithEmails && membersWithEmails.length > 0) {
        setSelectedMemberId(membersWithEmails[0].id);
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
        const personalityData = userInsights.map(i => i.personality_notes).filter(Boolean);
        if (personalityData.length > 0) {
          oceanProfile = {
            openness: Math.round(personalityData.reduce((sum, p: any) => sum + (p?.openness || 0), 0) / personalityData.length),
            conscientiousness: Math.round(personalityData.reduce((sum, p: any) => sum + (p?.conscientiousness || 0), 0) / personalityData.length),
            extraversion: Math.round(personalityData.reduce((sum, p: any) => sum + (p?.extraversion || 0), 0) / personalityData.length),
            agreeableness: Math.round(personalityData.reduce((sum, p: any) => sum + (p?.agreeableness || 0), 0) / personalityData.length),
            neuroticism: Math.round(personalityData.reduce((sum, p: any) => sum + (p?.neuroticism || 0), 0) / personalityData.length),
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
      // Create invitation directly in database
      const { data: invitation, error } = await supabase
        .from('invitations')
        .insert({
          email: memberEmail.trim(),
          token: crypto.randomUUID(),
          manager_id: userProfile?.id,
          status: 'pending'
        })
        .select('token')
        .single();

      if (error) throw error;

      // Generate invitation URL
      const invitationUrl = `https://bmrifufykczudfxomenr.supabase.co/functions/v1/accept-invitation?token=${invitation.token}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(invitationUrl);

      toast({
        title: "Invitation Created!",
        description: `Invitation link copied to clipboard. Share it with ${memberEmail}`
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
        <h1 className="text-3xl font-bold text-foreground">
          Manager Dashboard 👨‍💼
        </h1>
        <p className="text-lg text-muted-foreground">
          Manage your team and view shared insights from team members.
        </p>
      </div>

      {/* Team Member Selection */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Team Overview
          </CardTitle>
          <CardDescription>
            Select a team member to view their shared insights and progress
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {teamMembers.length > 0 ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="member-select">Select Team Member</Label>
                <Select 
                  value={selectedMemberId} 
                  onValueChange={setSelectedMemberId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.display_name || member.full_name} ({member.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserCheck className="h-4 w-4" />
                {teamMembers.length} team member{teamMembers.length > 1 ? 's' : ''} under your management
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
              <Button 
                onClick={handleInviteMember}
                disabled={isInviting}
              >
                {isInviting ? 'Creating...' : 'Create Invite Link'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Management Component */}
      {userProfile && (
        <TeamManagement userProfile={userProfile} />
      )}

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
                  <Lightbulb className="h-5 w-5 text-primary" />
                  Recent Shared Insights
                </CardTitle>
                <CardDescription>
                  Latest insights from {selectedMemberData.member.display_name || selectedMemberData.member.full_name}'s conversations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedMemberData.insights.slice(0, 3).map((insight: any, index: number) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">
                          {new Date(insight.created_at).toLocaleDateString()}
                        </Badge>
                      </div>
                      {insight.insights && insight.insights.length > 0 && (
                        <ul className="space-y-1">
                          {insight.insights.slice(0, 2).map((item: string, i: number) => (
                            <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                              <ChevronRight className="h-3 w-3 mt-1 text-primary flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Quick Actions */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" asChild>
              <Link to="/dashboard">
                <History className="mr-2 h-4 w-4" />
                View Your Personal Dashboard
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/conversation">
                <MessageCircle className="mr-2 h-4 w-4" />
                Start Your Own Session
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardManager;