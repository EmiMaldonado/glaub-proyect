import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, TrendingUp, Users, Calendar, Plus, History, Settings, Target, Lightbulb, Share2, UserCheck, Shield, BarChart3, Bot, Clock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { usePausedConversations } from "@/hooks/usePausedConversations";
import SharingPreferences from "@/components/SharingPreferences";
import SharedDataIndicator from "@/components/SharedDataIndicator";
import PersonalRecommendations from "@/components/PersonalRecommendations";
import LoadingSpinner from "@/components/LoadingSpinner";
import DashboardBreadcrumbs from "@/components/DashboardBreadcrumbs";
import DashboardViewSwitch from "@/components/DashboardViewSwitch";
const Dashboard = () => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const {
    getPausedConversation,
    clearPausedConversation
  } = usePausedConversations();
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

  // Historical data state
  const [selectedPeriod, setSelectedPeriod] = useState<'last_week' | 'last_month' | 'last_3_months'>('last_week');
  const [historicalData, setHistoricalData] = useState<any>(null);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  // Load historical data when tab or period changes  
  useEffect(() => {
    if (user && activeTab === 'historical') {
      loadHistoricalData();
    }
  }, [user, activeTab, selectedPeriod]);
  const loadHistoricalData = async () => {
    if (!user) return;
    setLoadingHistorical(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-historical-data', {
        body: {
          period: selectedPeriod,
          userId: user.id
        }
      });
      if (error) {
        console.error('Error loading historical data:', error);
        toast({
          title: "Error",
          description: "Failed to load historical data",
          variant: "destructive"
        });
        return;
      }
      setHistoricalData(data);
    } catch (error) {
      console.error('Unexpected error loading historical data:', error);
      toast({
        title: "Error",
        description: "Failed to load historical data",
        variant: "destructive"
      });
    } finally {
      setLoadingHistorical(false);
    }
  };
  const loadDashboardData = async () => {
    if (!user) return;
    try {
      // Load user profile
      const {
        data: profile
      } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
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
          
          // Generate AI description immediately with the calculated avgOcean data
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
        const {
          data: manager
        } = await supabase.from('profiles').select('*, user_id').eq('id', profile.manager_id).single();
        setCurrentManager(manager);
      }

      // Load user's team memberships using the new team_members table
      const {
        data: teamMemberships
      } = await supabase.from('team_members').select(`
          id,
          team_id,
          member_id,
          role,
          joined_at,
          manager:profiles!team_members_team_id_fkey(id, full_name, display_name, team_name)
        `).eq('member_id', profile?.id).eq('role', 'employee');
      
      if (teamMemberships && teamMemberships.length > 0) {
        setUserTeams(teamMemberships);
      }

      // Load pending invitations for this user's email
      const {
        data: invitations
      } = await supabase.from('invitations').select(`
          *,
          manager:profiles!invitations_manager_id_fkey(full_name, display_name)
        `).eq('email', user.email).eq('status', 'pending').gt('expires_at', new Date().toISOString());
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
  const generateOceanDescription = async (oceanProfile: any, userProfile: any, latestConversationId?: string) => {
    if (!oceanProfile) return;

    // Check cache first - only regenerate if there's a new conversation
    const cacheKey = `ocean_description_${user?.id}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        // If we have cached data for the same conversation, use it
        if (parsed.conversationId === latestConversationId && parsed.description) {
          setOceanDescription(parsed.description);
          return;
        }
      } catch (e) {
        console.log('Cache parse error, regenerating...');
      }
    }
    setIsLoadingDescription(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-ocean-description', {
        body: {
          oceanProfile,
          userProfile
        }
      });
      if (error) throw error;
      if (data?.success && data?.description) {
        setOceanDescription(data.description);

        // Cache the result with conversation ID
        const cacheData = {
          description: data.description,
          conversationId: latestConversationId,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } else {
        throw new Error(data?.error || 'Failed to generate description');
      }
    } catch (error: any) {
      console.error('Error generating OCEAN description:', error);
      // Keep fallback description if AI fails
      const fallbackDescription = "Your OCEAN profile reveals your unique personality patterns based on conversational analysis. Higher openness indicates creativity and willingness to try new experiences, while conscientiousness reflects your organization and goal-oriented nature. Extraversion measures your social energy and communication style, agreeableness shows your collaborative tendencies, and stability indicates your emotional resilience. These dimensions work together to create your distinctive approach to challenges, relationships, and personal growth opportunities.";
      setOceanDescription(fallbackDescription);

      // Cache fallback as well to avoid repeated failures
      const cacheData = {
        description: fallbackDescription,
        conversationId: latestConversationId,
        timestamp: Date.now(),
        isFallback: true
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } finally {
      setIsLoadingDescription(false);
    }
  };

  // Handle starting new conversation (clears paused conversation and cache)
  const handleStartNewConversation = async () => {
    if (user && hasPausedConversation) {
      await clearPausedConversation(user.id);
      setHasPausedConversation(false);
    }

    // Clear OCEAN description cache when starting new conversation
    const cacheKey = `ocean_description_${user?.id}`;
    localStorage.removeItem(cacheKey);
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
      // Use the unified-invitation function to send email
      const { data, error } = await supabase.functions.invoke('unified-invitation', {
        body: {
          email: managerEmail.trim(),
          invitationType: 'manager_request'
        }
      });
      if (error) {
        throw error;
      }
      toast({
        title: "Request Sent!",
        description: `Your request to join the team has been sent to ${managerEmail}. They will receive an email with your invitation.`
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
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      const {
        data,
        error
      } = await supabase.functions.invoke('complete-invitation', {
        body: {
          token: invitation.token,
          user_id: user.id,
          // Use auth user ID for proper validation
          action: 'accept'
        }
      });
      if (error) throw error;
      if (data?.success) {
        toast({
          title: "Invitation Accepted!",
          description: `You are now part of ${data.manager_name}'s team`
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
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      const {
        data,
        error
      } = await supabase.functions.invoke('complete-invitation', {
        body: {
          token: invitation.token,
          user_id: user.id,
          // Use auth user ID for proper validation
          action: 'decline'
        }
      });
      if (error) throw error;
      if (data?.success) {
        toast({
          title: "Invitation Declined",
          description: "You have declined the team invitation"
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
      const dataToShare = type === 'strengths' ? allInsights.flatMap(insight => insight.insights || []).slice(0, 5) : allInsights.flatMap(insight => insight.next_steps || []).slice(0, 5);

      // For now, just show a success message - in a real implementation, 
      // this would send data to the manager via email or notification
      toast({
        title: "Shared Successfully!",
        description: `Your ${type} have been shared with your manager`
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
  return <div className="container mx-auto px-4 pt-8 pb-8 space-y-8">
      {/* Navigation */}
      

      {/* Welcome Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Hello, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}!
            </h1>
            <p className="text-lg text-muted-foreground">
              {personalizedSummary || `You've completed ${stats.completedConversations} sessions with ${allInsights.length} insights generated.`}
            </p>
          </div>
          <DashboardViewSwitch />
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
                {hasPausedConversation ? <Button variant="secondary" size="lg" asChild>
                    <Link to="/conversation?continue=true">
                      <MessageCircle className="mr-2 h-5 w-5" />
                      Resume previous conversation
                    </Link>
                  </Button> : <Button variant="secondary" size="lg" asChild>
                    <Link to="/conversation" onClick={handleStartNewConversation}>
                      <Plus className="mr-2 h-5 w-5" />
                      Start new session
                    </Link>
                  </Button>}
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
          <Card className="shadow-soft h-full">
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
                
              </div>
            </CardHeader>
            <CardContent className="h-full flex flex-col">
              {oceanProfile ? <div className="space-y-8 flex-1">
                  {/* Prominent percentage display */}
                  <div className="flex flex-wrap justify-center gap-6 text-center">
                    <div className="p-4 rounded-lg">
                      <div className="text-4xl font-bold text-primary mb-2">{oceanProfile.openness || 0}%</div>
                      <div className="text-sm text-muted-foreground font-medium">Openness</div>
                    </div>
                    <div className="p-4 rounded-lg">
                      <div className="text-4xl font-bold text-primary mb-2">{oceanProfile.conscientiousness || 0}%</div>
                      <div className="text-sm text-muted-foreground font-medium">Conscientiousness</div>
                    </div>
                    <div className="p-4 rounded-lg">
                      <div className="text-4xl font-bold text-primary mb-2">{oceanProfile.extraversion || 0}%</div>
                      <div className="text-sm text-muted-foreground font-medium">Extraversion</div>
                    </div>
                    <div className="p-4 rounded-lg">
                      <div className="text-4xl font-bold text-primary mb-2">{oceanProfile.agreeableness || 0}%</div>
                      <div className="text-sm text-muted-foreground font-medium">Agreeableness</div>
                    </div>
                    <div className="p-4 rounded-lg">
                      <div className="text-4xl font-bold text-primary mb-2">{100 - (oceanProfile.neuroticism || 0)}%</div>
                      <div className="text-sm text-muted-foreground font-medium">Stability</div>
                    </div>
                  </div>
                  
                  {/* Detailed description */}
                  <div className="bg-muted/50 rounded-lg p-8 flex-1 min-h-[120px] flex items-center">
                    {isLoadingDescription ? <div className="flex items-center gap-2 w-full justify-center">
                        <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full"></div>
                        <p className="text-sm text-muted-foreground">ai thinking...</p>
                       </div> : <p className="text-base text-foreground/90 leading-relaxed">
                         {oceanDescription || oceanProfile.summary || `Based on your ${stats.completedConversations} conversations, your personality profile shows consistent patterns in how you approach challenges and relationships. Your communication style and decision-making preferences have been analyzed to create this personalized summary of your professional strengths and growth areas.`}
                       </p>}
                  </div>
                </div> : <div className="text-center py-8">
                  <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">No personality data available</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete a conversation to generate your personalized profile
                  </p>
                </div>}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - 30% - Your Teams */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Your Teams
              </CardTitle>
              <CardDescription className="text-sm">
                Manage your team memberships and invitations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Teams */}
              {userTeams.length > 0 && <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Active Memberships
                  </h4>
                  <div className="space-y-2">
                    {userTeams.map(team => <div key={team.id} className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                        <p className="font-medium text-sm">
                          {team.manager?.team_name || `${team.manager?.full_name || team.manager?.display_name}'s team`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Manager: {team.manager?.full_name || team.manager?.display_name}
                        </p>
                      </div>)}
                  </div>
                </div>}

              {/* People Who Want to Join Your Team */}
              {pendingInvitations.filter(inv => inv.invitation_type === 'manager_request').length > 0 && <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-green-600" />
                    People Who Want to Join Your Team
                  </h4>
                  <div className="space-y-3">
                    {pendingInvitations.filter(inv => inv.invitation_type === 'manager_request').map(invitation => <div key={invitation.id} className="p-3 border rounded-lg bg-green-50 border-green-200 space-y-3">
                        <div>
                          <p className="font-medium text-sm">
                            From {invitation.manager?.display_name || invitation.manager?.full_name}
                          </p>
                          <p className="text-sm font-medium text-green-700">
                            🏢 They want you to be THEIR MANAGER
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Expires {new Date(invitation.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAcceptInvitation(invitation)} className="flex-1">
                            Accept
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDeclineInvitation(invitation)} className="flex-1">
                            Decline
                          </Button>
                        </div>
                      </div>)}
                  </div>
                </div>}

              {/* Invitations to Join Their Team */}
              {pendingInvitations.filter(inv => inv.invitation_type === 'team_member').length > 0 && <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-blue-600" />
                    Invitations to Join Their Team
                  </h4>
                  <div className="space-y-3">
                    {pendingInvitations.filter(inv => inv.invitation_type === 'team_member').map(invitation => <div key={invitation.id} className="p-3 border rounded-lg bg-blue-50 border-blue-200 space-y-3">
                        <div>
                          <p className="font-medium text-sm">
                            From {invitation.manager?.display_name || invitation.manager?.full_name}
                          </p>
                          <p className="text-sm font-medium text-blue-700">
                            👥 They want you to JOIN THEIR TEAM
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Expires {new Date(invitation.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleAcceptInvitation(invitation)} className="flex-1">
                            {invitation.invitation_type === 'manager_request' ? 'Become Their Manager' : 'Accept'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDeclineInvitation(invitation)} className="flex-1">
                            Decline
                          </Button>
                        </div>
                      </div>)}
                  </div>
                </div>}

              {/* Request to Join Team */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Request to Join Team
                </h4>
                <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    Send a join request to a manager
                  </p>
                  <div className="space-y-2">
                    <Input type="email" placeholder="Manager's email" value={managerEmail} onChange={e => setManagerEmail(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleInviteManager()} />
                  </div>
                  <Button onClick={handleInviteManager} disabled={isInvitingManager} className="w-full" size="sm">
                    {isInvitingManager ? 'Sending...' : 'Send Team Request'}
                  </Button>
                </div>
              </div>

              {/* Show example teams if no actual teams */}
              {userTeams.length === 0 && pendingInvitations.length === 0 && <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Example Teams
                  </h4>
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
                    <p className="text-xs text-center pt-2">Example teams - request to join one above</p>
                  </div>
                </div>}
            </CardContent>
          </Card>
          <SharingPreferences 
            userProfile={userProfile} 
            managerId={currentManager?.id} 
            onPreferencesChange={handleSharingPreferencesChange} 
          />
        </div>
      </div>

      {/* Results, Strengths, and Personal Recommendations Container */}
      <div className="space-y-8">
        {/* Your Results Section */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Your results
            </CardTitle>
            {/* Tab Navigation - Separate Row */}
            <div className="flex gap-4 items-center border-b mt-4 pt-2">
              <button className={`pb-2 px-1 border-b-2 transition-colors ${activeTab === 'last' ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`} onClick={() => setActiveTab('last')}>
                Last session
              </button>
              <button className={`pb-2 px-1 border-b-2 transition-colors ${activeTab === 'historical' ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`} onClick={() => setActiveTab('historical')}>
                Historical
              </button>
            </div>
            {/* Dropdown on its own row */}
            {activeTab === 'historical' && <div className="mt-2">
                <Select value={selectedPeriod} onValueChange={(value: 'last_week' | 'last_month' | 'last_3_months') => setSelectedPeriod(value)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_week">Last week</SelectItem>
                    <SelectItem value="last_month">Last month</SelectItem>
                    <SelectItem value="last_3_months">Last 3 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>}
          </CardHeader>
          <CardContent>
            {activeTab === 'last' ? <div className="space-y-6">
                {/* Your Last Meeting Subsection */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Your Last Meeting</h3>
                    </div>
                  </div>
                  
                  {lastConversation ? <div className="space-y-4">
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
                    </div> : <div className="text-center py-6 bg-muted/30 rounded-lg">
                      <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No meeting data available</p>
                    </div>}
                </div>
                
                {/* Separator */}
                <div className="border-t border-muted my-6"></div>
                
                {/* Personal Recommendations Subsection */}
                <div>
                  <PersonalRecommendations context="last_session" sessionId={lastConversation?.id} recommendations={lastConversation?.key_insights ? {
                development: allInsights.filter(insight => insight.conversation_id === lastConversation.id).flatMap(insight => insight.next_steps || []).slice(0, 3),
                wellness: ["Take regular breaks during work to maintain mental clarity", "Practice mindfulness techniques when feeling overwhelmed", "Establish boundaries to protect your energy"],
                skills: ["Focus on active listening in your next conversations", "Practice emotional regulation during challenging situations", "Develop your communication skills with open-ended questions"],
                goals: ["Set specific, measurable objectives for personal growth", "Create accountability systems for your development plan", "Track progress weekly to maintain momentum"]
              } : undefined} className="border-0 shadow-none p-0" />
                </div>
              </div> :
          // Historical Content
          <div className="space-y-6">
                {loadingHistorical ? <div className="text-center py-8">
                    <LoadingSpinner />
                    <p className="text-muted-foreground text-sm mt-2">Loading historical data...</p>
                  </div> : historicalData ? <div className="space-y-6">
                    {/* Conversation Summary Card */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold">Conversation Summary</h3>
                        </div>
                      </div>
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <p className="text-sm leading-relaxed">{historicalData.conversation_summary}</p>
                        {historicalData.total_conversations > 0 && <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-muted">
                            <div>
                              <span className="text-sm text-muted-foreground">Total Conversations:</span>
                              <p className="font-medium">{historicalData.total_conversations}</p>
                            </div>
                            <div>
                              <span className="text-sm text-muted-foreground">Total Duration:</span>
                              <p className="font-medium">{historicalData.total_duration} min</p>
                            </div>
                            <div>
                              <span className="text-sm text-muted-foreground">Avg Duration:</span>
                              <p className="font-medium">{historicalData.avg_duration} min</p>
                            </div>
                          </div>}
                      </div>
                    </div>
                    
                    {/* Separator */}
                    <div className="border-t border-muted my-6"></div>
                    
                    {/* Personal Recommendations Subsection */}
                    <div>
                      <PersonalRecommendations context="historical" period={selectedPeriod} className="border-0 shadow-none p-0" />
                    </div>
                  </div> : <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">No historical data available</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Complete more conversations to see historical insights
                    </p>
                  </div>}
              </div>}
          </CardContent>
        </Card>

        {/* Strengths Section */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="font-semibold flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastConversation?.key_insights ? allInsights.filter(insight => insight.conversation_id === lastConversation.id).length > 0 ? <ul className="space-y-3">
                  {allInsights.filter(insight => insight.conversation_id === lastConversation.id).flatMap(insight => insight.insights || []).slice(0, 5).map((insight: string, index: number) => <li key={index} className="flex items-start gap-3 p-3 bg-success/5 rounded-lg border border-success/20">
                        <div className="w-2 h-2 rounded-full bg-success mt-2 flex-shrink-0" />
                        <span className="text-sm leading-relaxed">{insight}</span>
                      </li>)}
                </ul> : <div className="text-center py-8">
                  <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">No strengths data from last session</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your most recent session didn't generate strength insights
                  </p>
                </div> : <div className="text-center py-8">
                <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No strengths data available</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete a conversation to identify your strengths
                </p>
              </div>}
          </CardContent>
        </Card>

      </div>

    </div>
};
export default Dashboard;