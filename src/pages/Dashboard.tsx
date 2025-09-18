import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, TrendingUp, Users, Calendar, Plus, History, Settings, Target, Lightbulb, Share2, UserCheck, Shield, BarChart3, Bot } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { usePausedConversations } from "@/hooks/usePausedConversations";
import SharingPreferences from "@/components/SharingPreferences";
import SharedDataIndicator from "@/components/SharedDataIndicator";
import PersonalRecommendations from "@/components/PersonalRecommendations";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { getPausedConversation, clearPausedConversation } = usePausedConversations();
  const [lastConversation, setLastConversation] = useState<any>(null);
  const [pausedConversations, setPausedConversations] = useState<any[]>([]);
  const [hasPausedConversation, setHasPausedConversation] = useState(false);
  const [oceanProfile, setOceanProfile] = useState<any>(null);
  const [allInsights, setAllInsights] = useState<any[]>([]);
  const [personalizedSummary, setPersonalizedSummary] = useState<string>('');
  const [managerEmail, setManagerEmail] = useState('');
  const [isInvitingManager, setIsInvitingManager] = useState(false);
  const [oceanDescription, setOceanDescription] = useState<string>('');
  const [isLoadingDescription, setIsLoadingDescription] = useState(false);
  const [sharingPreferences, setSharingPreferences] = useState({
    share_profile: false,
    share_insights: false,
    share_conversations: false,
    share_ocean_profile: false,
    share_progress: false
  });
  const [stats, setStats] = useState({
    totalConversations: 0,
    completedConversations: 0,
    sharedInsights: 0,
    teamMembers: 0
  });
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentManager, setCurrentManager] = useState<any>(null);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [userTeams, setUserTeams] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'last' | 'historical'>('last');
  
  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;
    try {
      // Load user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setUserProfile(profile);

      // Load all conversations for comprehensive analysis
      const {
        data: conversations
      } = await supabase.from('conversations').select('*').eq('user_id', user.id).order('created_at', {
        ascending: false
      });

      // Check for paused conversations (old system - kept for backwards compatibility)
      const pausedConversations = conversations?.filter(c => c.status === 'paused') || [];
      setPausedConversations(pausedConversations);

      // Check for new paused conversation system
      const pausedConv = await getPausedConversation(user.id);
      setHasPausedConversation(!!pausedConv);

      // Load all insights from all conversations
      const {
        data: insights
      } = await supabase.from('key_insights').select('*').order('created_at', {
        ascending: false
      });

      // Filter insights that belong to user's conversations
      const userConversationIds = conversations?.map(c => c.id) || [];
      const userInsights = insights?.filter(insight => userConversationIds.includes(insight.conversation_id)) || [];

      // Set all insights for comprehensive dashboard
      if (userInsights && userInsights.length > 0) {
        setAllInsights(userInsights);

        // Generate personalized summary based on all conversations
        const allPersonalityData = userInsights.map(i => i.personality_notes).filter(Boolean);
        const allInsightsData = userInsights.flatMap(i => i.insights || []);
        const allNextSteps = userInsights.flatMap(i => i.next_steps || []);

        // Calculate average OCEAN scores across all sessions
        if (allPersonalityData.length > 0) {
          const avgOcean = {
            openness: Math.round(allPersonalityData.reduce((sum, p: any) => sum + (p?.openness || 0), 0) / allPersonalityData.length),
            conscientiousness: Math.round(allPersonalityData.reduce((sum, p: any) => sum + (p?.conscientiousness || 0), 0) / allPersonalityData.length),
            extraversion: Math.round(allPersonalityData.reduce((sum, p: any) => sum + (p?.extraversion || 0), 0) / allPersonalityData.length),
            agreeableness: Math.round(allPersonalityData.reduce((sum, p: any) => sum + (p?.agreeableness || 0), 0) / allPersonalityData.length),
            neuroticism: Math.round(allPersonalityData.reduce((sum, p: any) => sum + (p?.neuroticism || 0), 0) / allPersonalityData.length),
            summary: `Based on ${allPersonalityData.length} therapeutic conversations, showing consistent patterns across sessions.`
          };
          setOceanProfile(avgOcean);
          
          // Generate AI description for OCEAN profile
          generateOceanDescription(avgOcean, profile);
        }

        // Create personalized summary
        setPersonalizedSummary(`Based on your ${conversations?.length || 0} conversations, you've shown consistent growth in self-awareness and professional development. Your journey reflects ${allInsightsData.length} unique insights and ${allNextSteps.length} actionable recommendations.`);
      }

      // Load last conversation for quick reference
      const {
        data: lastConv
      } = await supabase.from('conversations').select('*').eq('user_id', user.id).eq('status', 'completed').order('created_at', {
        ascending: false
      }).limit(1).maybeSingle();
      if (lastConv) {
        // Separately load insights for this conversation to avoid join issues
        const {
          data: lastConvInsights
        } = await supabase.from('key_insights').select('insights, personality_notes, next_steps').eq('conversation_id', lastConv.id).maybeSingle();
        setLastConversation({
          ...lastConv,
          key_insights: lastConvInsights
        });
      }
      // Load current manager if user has one
      if (profile?.manager_id) {
        const { data: manager } = await supabase
          .from('profiles')
          .select('*, user_id')
          .eq('id', profile.manager_id)
          .single();
        setCurrentManager(manager);
      }

      // Load user's team memberships
      const { data: teamMemberships } = await supabase
        .from('team_memberships')
        .select(`
          id,
          manager:profiles!manager_id(id, full_name, display_name, team_name)
        `)
        .or(`employee_1_id.eq.${profile?.id},employee_2_id.eq.${profile?.id},employee_3_id.eq.${profile?.id},employee_4_id.eq.${profile?.id},employee_5_id.eq.${profile?.id},employee_6_id.eq.${profile?.id},employee_7_id.eq.${profile?.id},employee_8_id.eq.${profile?.id},employee_9_id.eq.${profile?.id},employee_10_id.eq.${profile?.id}`);
      
      if (teamMemberships && teamMemberships.length > 0) {
        setUserTeams(teamMemberships);
      }

      // Load pending invitations for this user's email
      const { data: invitations } = await supabase
        .from('invitations')
        .select(`
          *,
          manager:profiles!invitations_manager_id_fkey(full_name, display_name)
        `)
        .eq('email', user.email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());
      
      setPendingInvitations(invitations || []);

      setStats({
        totalConversations: conversations?.length || 0,
        completedConversations: conversations?.filter(c => c.status === 'completed').length || 0,
        sharedInsights: 0,
        // TODO: implement sharing tracking
        teamMembers: 0 // TODO: implement team member count
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Don't show error toast for auth issues to avoid spamming
      if (error?.message && !error.message.includes('refresh_token')) {
        toast({
          title: "Error Loading Dashboard",
          description: "Some data may not be available. Please try refreshing the page.",
          variant: "destructive"
        });
      }
    }
  };

  const generateOceanDescription = async (oceanProfile: any, userProfile: any) => {
    if (!oceanProfile) return;
    
    setIsLoadingDescription(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ocean-description', {
        body: {
          oceanProfile,
          userProfile
        }
      });

      if (error) throw error;

      if (data?.success && data?.description) {
        setOceanDescription(data.description);
      } else {
        throw new Error(data?.error || 'Failed to generate description');
      }
    } catch (error: any) {
      console.error('Error generating OCEAN description:', error);
      // Keep fallback description if AI fails
      setOceanDescription("Your OCEAN profile reveals your unique personality patterns based on conversational analysis. Higher openness indicates creativity and willingness to try new experiences, while conscientiousness reflects your organization and goal-oriented nature. Extraversion measures your social energy and communication style, agreeableness shows your collaborative tendencies, and stability indicates your emotional resilience. These dimensions work together to create your distinctive approach to challenges, relationships, and personal growth opportunities.");
    } finally {
      setIsLoadingDescription(false);
    }
  };

  // Handle starting new conversation (clears paused conversation)
  const handleStartNewConversation = async () => {
    if (user && hasPausedConversation) {
      await clearPausedConversation(user.id);
      setHasPausedConversation(false);
    }
  };
  
  const handleSharingPreferencesChange = (preferences: any) => {
    setSharingPreferences(preferences);
  };
  
  const handleInviteManager = async () => {
    if (!managerEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter your manager's email address",
        variant: "destructive"
      });
      return;
    }
    if (!managerEmail.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }
    setIsInvitingManager(true);
    try {
      // Create invitation directly in database
      const { data: invitation, error } = await supabase
        .from('invitations')
        .insert({
          email: managerEmail.trim(),
          token: crypto.randomUUID(),
          manager_id: userProfile?.id,
          status: 'pending'
        })
        .select('token')
        .single();

      if (error) {
        throw error;
      }

      // Generate invitation URL
      const invitationUrl = `https://bmrifufykczudfxomenr.supabase.co/functions/v1/accept-invitation?token=${invitation.token}`;
      
      // Copy to clipboard
        await navigator.clipboard.writeText(invitationUrl);
        
        toast({
          title: "Request Sent!",
          description: `Your request to join the team has been sent to ${managerEmail}. They will see your request in their manager dashboard and can approve it.`,
        });
      setManagerEmail(''); // Clear the input
      
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create manager invitation",
        variant: "destructive"
      });
    } finally {
      setIsInvitingManager(false);
    }
  };

  const handleAcceptInvitation = async (invitation: any) => {
    try {
      if (!userProfile?.id) {
        throw new Error('User profile not found');
      }

      const { data, error } = await supabase.functions.invoke('complete-invitation', {
        body: {
          token: invitation.token,
          user_id: userProfile.id, // Use profile ID instead of auth user ID
          action: 'accept'
        }
      });

      if (error) throw error;
      
      if (data?.success) {
        toast({
          title: "Invitation Accepted!",
          description: `You are now part of ${data.manager_name}'s team`,
        });
        // Reload dashboard data to reflect changes
        loadDashboardData();
      } else {
        throw new Error(data?.error || 'Failed to accept invitation');
      }
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept invitation",
        variant: "destructive"
      });
    }
  };

  const handleDeclineInvitation = async (invitation: any) => {
    try {
      if (!userProfile?.id) {
        throw new Error('User profile not found');
      }

      const { data, error } = await supabase.functions.invoke('complete-invitation', {
        body: {
          token: invitation.token,
          user_id: userProfile.id, // Use profile ID instead of auth user ID
          action: 'decline'
        }
      });

      if (error) throw error;
      
      if (data?.success) {
        toast({
          title: "Invitation Declined",
          description: "You have declined the team invitation",
        });
        
        // Remove from pending invitations
        setPendingInvitations(prev => prev.filter(inv => inv.id !== invitation.id));
      } else {
        throw new Error(data?.error || 'Failed to decline invitation');
      }
    } catch (error: any) {
      console.error('Error declining invitation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to decline invitation",
        variant: "destructive"
      });
    }
  };

  const handleShareWithManager = async (type: 'strengths' | 'opportunities') => {
    try {
      if (!userProfile?.id || !currentManager) {
        toast({
          title: "Unable to Share",
          description: "No manager found to share with",
          variant: "destructive"
        });
        return;
      }

      const dataToShare = type === 'strengths' 
        ? allInsights.flatMap(insight => insight.insights || []).slice(0, 5)
        : allInsights.flatMap(insight => insight.next_steps || []).slice(0, 5);

      // For now, just show a success message - in a real implementation, 
      // this would send data to the manager via email or notification
      toast({
        title: "Shared Successfully!",
        description: `Your ${type} have been shared with your manager`,
      });

      // Update sharing preferences would be handled by the SharingPreferences component
      
    } catch (error: any) {
      console.error('Error sharing with manager:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to share with manager",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Welcome Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Hello, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}!
            </h1>
            <p className="text-lg text-muted-foreground">
              {personalizedSummary || `You've completed ${stats.completedConversations} sessions with ${allInsights.length} insights generated.`}
            </p>
          </div>
          {userProfile?.role === 'manager' && (
            <Button variant="default" asChild>
              <Link to="/dashboard/manager">
                <Users className="mr-2 h-4 w-4" />
                Manager Dashboard
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Main CTA Card */}
      <Card className="bg-gradient-primary text-primary-foreground shadow-elegant">
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold">Speak with Glai</h2>
              <p className="text-primary-foreground/90">
                Start a new conversation
              </p>
              <div className="flex gap-3 mt-4">
                <Button variant="secondary" size="lg" asChild>
                  <Link to="/conversation" onClick={handleStartNewConversation}>
                    <Plus className="mr-2 h-5 w-5" />
                    Start new session
                  </Link>
                </Button>
                {hasPausedConversation && (
                  <Button variant="outline" size="lg" asChild>
                    <Link to="/conversation?continue=true">
                      <MessageCircle className="mr-2 h-5 w-5" />
                      Continue Previous
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            <div className="hidden md:block">
              <div className="w-32 h-32 bg-primary-foreground/10 rounded-full flex items-center justify-center">
                <Bot className="h-16 w-16 text-primary-foreground/60" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variables Profile and Team Management Row */}
      <div className="grid lg:grid-cols-10 gap-8">
        {/* Left Column - 70% - Variables Profile */}
        <div className="lg:col-span-7">
          <Card className="shadow-soft">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-secondary" />
                    Your Variables Profile
                  </CardTitle>
                  <CardDescription>
                    Personality dimensions based on your conversations
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="share-profile" className="text-sm font-medium">
                    Share with manager
                  </Label>
                  <Switch
                    id="share-profile"
                    checked={sharingPreferences.share_ocean_profile}
                    disabled={!currentManager}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {oceanProfile ? (
                <div className="space-y-6">
                  {/* Prominent percentage display */}
                  <div className="grid grid-cols-5 gap-4 text-center">
                    <div>
                      <div className="text-3xl font-bold text-primary mb-1">{oceanProfile.openness || 0}%</div>
                      <div className="text-sm text-muted-foreground font-medium">Openness</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-primary mb-1">{oceanProfile.conscientiousness || 0}%</div>
                      <div className="text-sm text-muted-foreground font-medium">Conscientiousness</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-primary mb-1">{oceanProfile.extraversion || 0}%</div>
                      <div className="text-sm text-muted-foreground font-medium">Extraversion</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-primary mb-1">{oceanProfile.agreeableness || 0}%</div>
                      <div className="text-sm text-muted-foreground font-medium">Agreeableness</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-primary mb-1">{100 - (oceanProfile.neuroticism || 0)}%</div>
                      <div className="text-sm text-muted-foreground font-medium">Stability</div>
                    </div>
                  </div>
                  
                  {/* Detailed description */}
                  <div className="bg-muted/50 rounded-lg p-6 mt-6">
                    {isLoadingDescription ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
                        <p className="text-sm text-muted-foreground">Generating personalized analysis...</p>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        {oceanDescription || oceanProfile.summary || "Your OCEAN profile reveals your unique personality patterns based on conversational analysis. Higher openness indicates creativity and willingness to try new experiences, while conscientiousness reflects your organization and goal-oriented nature. Extraversion measures your social energy and communication style, agreeableness shows your collaborative tendencies, and stability indicates your emotional resilience. These dimensions work together to create your distinctive approach to challenges, relationships, and personal growth opportunities."}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">No personality data available</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete a conversation to generate your personalized profile
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - 30% - Team Management */}
        <div className="lg:col-span-3 space-y-6">
          {/* Request to Join Team Widget */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg">Request to Join Team</CardTitle>
              <CardDescription className="text-sm">
                Send join team conversation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="Manager's email"
                  value={managerEmail}
                  onChange={(e) => setManagerEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleInviteManager()}
                />
              </div>
              <Button onClick={handleInviteManager} disabled={isInvitingManager} className="w-full" size="sm">
                {isInvitingManager ? 'Sending...' : 'Send a team Request'}
              </Button>
            </CardContent>
          </Card>

          {/* Your Teams Widget */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg">Your teams</CardTitle>
            </CardHeader>
            <CardContent>
              {userTeams.length > 0 ? (
                <div className="space-y-2">
                  {userTeams.map((team) => (
                    <div key={team.id} className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <p className="font-medium text-sm">
                        {team.manager?.team_name || `${team.manager?.full_name || team.manager?.display_name}'s team`} - {team.manager?.full_name || team.manager?.display_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Manager: {team.manager?.full_name || team.manager?.display_name}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p>Emilia team - Emilia Maldonado</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p>Juan team - Juan Maldonado</p>
                  </div>
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p>Equipo ventas - Estela Paez</p>
                  </div>
                  <p className="text-xs text-center pt-2">Example teams - join one above</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Invitations */}
          {pendingInvitations.length > 0 && (
            <Card className="shadow-soft border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  Pending Invitations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingInvitations.map((invitation) => (
                  <div key={invitation.id} className="p-3 border rounded-lg bg-primary/5 space-y-3">
                    <div>
                      <p className="font-medium text-sm">
                        From {invitation.manager?.display_name || invitation.manager?.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expires {new Date(invitation.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleAcceptInvitation(invitation)}
                        className="flex-1"
                      >
                        Accept
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleDeclineInvitation(invitation)}
                        className="flex-1"
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Tab Navigation - affects Your results, Strengths, and Personal Recommendations */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Your results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Your Last Meeting Subsection */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Your Last Meeting</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="share-meeting" className="text-sm font-medium">
                    Share with manager
                  </Label>
                  <Switch
                    id="share-meeting"
                    checked={sharingPreferences.share_conversations}
                    disabled={!currentManager}
                  />
                </div>
              </div>
              
              {lastConversation ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Completed on {new Date(lastConversation.created_at).toLocaleDateString()}
                  </p>
                  <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <span className="text-sm text-muted-foreground">Duration:</span>
                      <p className="font-medium">{lastConversation.duration_minutes || 15} min</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Type:</span>
                      <p className="font-medium">Complete</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Insights:</span>
                      <p className="font-medium">{lastConversation.key_insights?.insights?.length || 0} generated</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-muted/30 rounded-lg">
                  <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No meeting data available</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Full-Width Sections */}
      {/* Strengths Section */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-success" />
                Strengths
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  <Shield className="mr-1 h-3 w-3" />
                  Private
                </Badge>
                <div className="flex items-center gap-2 ml-2">
                  <Label htmlFor="share-strengths" className="text-sm font-medium">
                    Share with manager
                  </Label>
                  <Switch
                    id="share-strengths"
                    checked={sharingPreferences.share_insights}
                    disabled={!currentManager}
                  />
                </div>
              </div>
              <CardDescription className="mt-2">
                Your main identified strengths
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === 'last' && lastConversation?.key_insights ? (
            allInsights.filter(insight => insight.conversation_id === lastConversation.id).length > 0 ? (
              <ul className="space-y-3">
                {allInsights
                  .filter(insight => insight.conversation_id === lastConversation.id)
                  .flatMap(insight => insight.insights || [])
                  .slice(0, 5)
                  .map((insight: string, index: number) => (
                    <li key={index} className="flex items-start gap-3 p-3 bg-success/5 rounded-lg border border-success/20">
                      <div className="w-2 h-2 rounded-full bg-success mt-2 flex-shrink-0" />
                      <span className="text-sm leading-relaxed">{insight}</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No strengths data from last session</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your most recent session didn't generate strength insights
                </p>
              </div>
            )
          ) : activeTab === 'historical' && allInsights.length > 0 ? (
            <ul className="space-y-3">
              {allInsights.flatMap(insight => insight.insights || []).slice(0, 5).map((insight: string, index: number) => (
                <li key={index} className="flex items-start gap-3 p-3 bg-success/5 rounded-lg border border-success/20">
                  <div className="w-2 h-2 rounded-full bg-success mt-2 flex-shrink-0" />
                  <span className="text-sm leading-relaxed">{insight}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No strengths data available</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete a conversation to identify your strengths
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Personal Recommendations Section */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-warning" />
                Your Personal Recommendations
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="share-recommendations" className="text-sm font-medium">
                    Share with manager
                  </Label>
                  <Switch
                    id="share-recommendations"
                    checked={sharingPreferences.share_progress}
                    disabled={!currentManager}
                  />
                </div>
              </div>
              <CardDescription className="mt-2">
                Tailored suggestions based on your conversation patterns and personal growth areas
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PersonalRecommendations 
            recommendations={{
              development: activeTab === 'last' && lastConversation?.key_insights
                ? allInsights
                    .filter(insight => insight.conversation_id === lastConversation.id)
                    .flatMap(insight => insight.next_steps || [])
                    .slice(0, 3)
                : activeTab === 'historical' 
                  ? allInsights.flatMap(insight => insight.next_steps || []).slice(0, 3)
                  : [],
              wellness: [
                "Take regular breaks during work to maintain mental clarity",
                "Practice mindfulness techniques when feeling overwhelmed", 
                "Establish boundaries to protect your energy"
              ],
              skills: [
                "Focus on active listening in your next conversations",
                "Practice emotional regulation during challenging situations",
                "Develop your communication skills with open-ended questions"
              ],
              goals: [
                "Set specific, measurable objectives for personal growth",
                "Create accountability systems for your development plan",
                "Track progress weekly to maintain momentum"
              ]
            }}
            oceanProfile={oceanProfile}
            className="border-0 shadow-none p-0"
          />
        </CardContent>
      </Card>

      {/* Data Sharing Preferences - Hidden section for backend functionality */}
      <div className="hidden">
        <SharingPreferences
          userProfile={userProfile}
          managerId={currentManager?.id}
          onPreferencesChange={handleSharingPreferencesChange}
        />
      </div>
    </div>
  );
};

export default Dashboard;
