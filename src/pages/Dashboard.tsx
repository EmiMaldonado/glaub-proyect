import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, TrendingUp, Users, Calendar, Plus, History, Settings, Target, Lightbulb, Share2, UserCheck, Shield, BarChart3, Bot, Clock, Play, Pause } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { usePausedConversations } from "@/hooks/usePausedConversations";
import { useConversationState } from "@/hooks/useConversationState";
import { useDataRecovery } from "@/hooks/useDataRecovery";
import SharingPreferences from "@/components/SharingPreferences";
import SharedDataIndicator from "@/components/SharedDataIndicator";
import PersonalRecommendations from "@/components/PersonalRecommendations";
import ProfileStatusInsights from "@/components/ProfileStatusInsights";
import LoadingSpinner from "@/components/LoadingSpinner";
import DashboardBreadcrumbs from "@/components/DashboardBreadcrumbs";
import DashboardViewSwitch from "@/components/DashboardViewSwitch";
import { requestLimiter } from "@/utils/requestLimiter";
import MyTeams from "@/components/ui/MyTeams";
const Dashboard = () => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Referencias para controlar loops
  const hasLoadedInitialData = useRef(false);
  const lastLoadTime = useRef(0);
  const loadingInProgress = useRef(false);
  const renderCount = useRef(0);

  // Debug: Detectar loops infinitos
  renderCount.current += 1;
  console.log(`🔄 Dashboard render #${renderCount.current}`);
  if (renderCount.current > 20) {
    console.error('❌ INFINITE LOOP DETECTED!');
    return <div className="container mx-auto px-4 pt-8 pb-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-red-800 mb-2">Infinite Loop Detected</h2>
          <p className="text-red-600 mb-4">The dashboard is re-rendering too frequently. Please refresh the page.</p>
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
      </div>;
  }

  // Hooks
  const {
    getPausedConversation,
    clearPausedConversation
  } = usePausedConversations();
  const {
    conversationState,
    isLoading: isConversationLoading,
    getConversationState,
    resumeConversation,
    startNewConversation,
    generateResumeMessage,
    refetchConversationState
  } = useConversationState();
  const {
    recoverAllMissingAnalyses
  } = useDataRecovery();

  // Estados
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
  const [selectedPeriod, setSelectedPeriod] = useState<'last_week' | 'last_month' | 'last_3_months'>('last_week');
  const [historicalData, setHistoricalData] = useState<any>(null);
  const [loadingHistorical, setLoadingHistorical] = useState(false);

  // ✅ EMERGENCY FIXED: Enhanced protection against loops
  const loadDashboardData = useCallback(async () => {
    if (!user?.id || loadingInProgress.current) {
      console.log('⚠️ Skipping loadDashboardData - no user or already loading');
      return;
    }

    // ✅ EMERGENCY: Use requestLimiter to prevent API flood
    if (!requestLimiter.canMakeRequest(`dashboard-${user.id}`)) {
      console.error('🚨 Emergency rate limit hit for dashboard');
      toast({
        title: "System Cooling Down",
        description: "Please wait a moment before refreshing data",
        variant: "destructive"
      });
      return;
    }

    // Rate limiting - no cargar más de una vez cada 5 segundos
    const now = Date.now();
    if (now - lastLoadTime.current < 5000) {
      console.log('⚠️ Rate limiting loadDashboardData');
      return;
    }
    try {
      loadingInProgress.current = true;
      lastLoadTime.current = now;
      console.log('📊 Loading dashboard data for user:', user.id);

      // Load user profile with error handling
      const {
        data: profile,
        error: profileError
      } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (profileError) {
        console.warn('Profile load error:', profileError);
      }
      if (profile) {
        setUserProfile(profile);
      }

      // Load all conversations with error handling
      const {
        data: conversations,
        error: conversationsError
      } = await supabase.from('conversations').select('*').eq('user_id', user.id).order('created_at', {
        ascending: false
      });
      if (conversationsError) {
        console.warn('Conversations load error:', conversationsError);
      }

      // Get conversation IDs for filtering insights
      const userConversationIds = conversations?.map(c => c.id) || [];

      // Load insights only if we have conversations
      let userInsights: any[] = [];
      if (userConversationIds.length > 0) {
        const {
          data: insights,
          error: insightsError
        } = await supabase.from('key_insights').select('*').in('conversation_id', userConversationIds).order('created_at', {
          ascending: false
        });
        if (insightsError) {
          console.warn('Insights load error:', insightsError);
        } else {
          userInsights = insights || [];
        }
      }

      // Set all insights for comprehensive dashboard
      if (userInsights && userInsights.length > 0) {
        setAllInsights(userInsights);

        // Calculate average OCEAN scores across all sessions
        const allPersonalityData = userInsights.map(i => i.personality_notes).filter(Boolean);
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
        const allInsightsData = userInsights.flatMap(i => i.insights || []);
        const allNextSteps = userInsights.flatMap(i => i.next_steps || []);
        setPersonalizedSummary(`Based on your ${conversations?.length || 0} conversations, you've shown consistent growth in self-awareness and professional development. Your journey reflects ${allInsightsData.length} unique insights and ${allNextSteps.length} actionable recommendations.`);
      }

      // Load last conversation for quick reference with error handling
      const {
        data: lastConv,
        error: lastConvError
      } = await supabase.from('conversations').select('*').eq('user_id', user.id).eq('status', 'completed').order('created_at', {
        ascending: false
      }).limit(1).maybeSingle();
      if (lastConvError) {
        console.warn('Last conversation load error:', lastConvError);
      }
      if (lastConv) {
        // Separately load insights for this conversation with error handling
        const {
          data: lastConvInsights,
          error: lastInsightsError
        } = await supabase.from('key_insights').select('insights, personality_notes, next_steps').eq('conversation_id', lastConv.id).maybeSingle();
        if (lastInsightsError) {
          console.warn('Last conversation insights error:', lastInsightsError);
        }
        setLastConversation({
          ...lastConv,
          key_insights: lastConvInsights
        });
      }

      // Load current manager if user is in a team - with error handling
      let teamMembership = null;
      try {
        const {
          data: membership,
          error: membershipError
        } = await supabase.from('team_members').select('team_id, role').eq('member_id', profile?.id).eq('role', 'employee').maybeSingle();
        if (membershipError) {
          console.warn('Team membership load error:', membershipError);
        } else {
          teamMembership = membership;
        }
      } catch (e) {
        console.warn('Team membership query failed:', e);
      }
      if (teamMembership) {
        try {
          const {
            data: manager,
            error: managerError
          } = await supabase.from('profiles').select('*, user_id').eq('id', teamMembership.team_id).maybeSingle();
          if (managerError) {
            console.warn('Manager load error:', managerError);
          } else {
            setCurrentManager(manager);
          }
        } catch (e) {
          console.warn('Manager query failed:', e);
        }
      }

      // Load user team memberships with error handling
      let teamsWithManagers: any[] = [];
      try {
        const {
          data: teamMemberships,
          error: membershipsError
        } = await supabase.from('team_members').select(`
            id,
            team_id,
            member_id,
            role,
            joined_at
          `).eq('member_id', profile?.id).eq('role', 'employee');
        if (membershipsError) {
          console.warn('Team memberships load error:', membershipsError);
        } else if (teamMemberships && teamMemberships.length > 0) {
          teamsWithManagers = await Promise.all(teamMemberships.map(async membership => {
            try {
              const {
                data: manager,
                error: managerError
              } = await supabase.from('profiles').select('id, full_name, display_name, team_name').eq('id', membership.team_id).single();
              if (managerError) {
                console.warn('Manager load error for team:', membership.team_id, managerError);
                return {
                  ...membership,
                  manager: null
                };
              }
              return {
                ...membership,
                manager
              };
            } catch (e) {
              console.warn('Manager query failed for team:', membership.team_id, e);
              return {
                ...membership,
                manager: null
              };
            }
          }));
        }
      } catch (e) {
        console.warn('Team memberships query failed:', e);
      }
      setUserTeams(teamsWithManagers);

      // Load pending invitations with error handling
      try {
        const {
          data: invitations,
          error: invitationsError
        } = await supabase.from('invitations').select(`
            *,
            manager:profiles!invitations_manager_id_fkey(full_name, display_name)
          `).eq('email', user.email).eq('status', 'pending').gt('expires_at', new Date().toISOString());
        if (invitationsError) {
          console.warn('Invitations load error:', invitationsError);
        } else {
          setPendingInvitations(invitations || []);
        }
      } catch (e) {
        console.warn('Invitations query failed:', e);
        setPendingInvitations([]);
      }
      setStats({
        totalConversations: conversations?.length || 0,
        completedConversations: conversations?.filter(c => c.status === 'completed').length || 0,
        sharedInsights: 0,
        teamMembers: 0
      });
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
      if (error?.message && !error.message.includes('refresh_token')) {
        toast({
          title: "Error Loading Dashboard",
          description: "Some data may not be available. Please try refreshing the page.",
          variant: "destructive"
        });
      }
    } finally {
      loadingInProgress.current = false;
    }
  }, [user?.id]);

  // Función para generar descripción OCEAN con cache y protección
  const generateOceanDescription = useCallback(async (oceanProfile: any, userProfile: any, latestConversationId?: string) => {
    if (!oceanProfile || isLoadingDescription) return;
    const cacheKey = `ocean_description_${user?.id}`;

    // Verificar cache primero
    try {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (parsed.conversationId === latestConversationId && parsed.description) {
          setOceanDescription(parsed.description);
          return;
        }
      }
    } catch (e) {
      console.log('Cache error, generating new description');
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
      console.error('❌ Error generating OCEAN description:', error);
      const fallbackDescription = "Your OCEAN profile reveals your unique personality patterns based on conversational analysis. Higher openness indicates creativity and willingness to try new experiences, while conscientiousness reflects your organization and goal-oriented nature. Extraversion measures your social energy and communication style, agreeableness shows your collaborative tendencies, and stability indicates your emotional resilience. These dimensions work together to create your distinctive approach to challenges, relationships, and personal growth opportunities.";
      setOceanDescription(fallbackDescription);
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
  }, [user?.id, isLoadingDescription]);

  // Cargar datos históricos con protección
  const loadHistoricalData = useCallback(async () => {
    if (!user?.id || loadingInProgress.current) return;
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
  }, [user?.id, selectedPeriod]);

  // Funciones de manejo de conversaciones
  const handleStartNewConversation = useCallback(async () => {
    if (user?.id) {
      const success = await startNewConversation(user.id);
      if (success) {
        const cacheKey = `ocean_description_${user.id}`;
        localStorage.removeItem(cacheKey);
        navigate('/conversation');
      }
    }
  }, [user?.id, startNewConversation, navigate]);
  const handleResumeConversation = useCallback(async () => {
    if (user?.id && conversationState.pausedConversationId) {
      const conversation = await resumeConversation(conversationState.pausedConversationId, user.id);
      if (conversation) {
        navigate(`/conversation?resume=${conversation.id}`);
      }
    }
  }, [user?.id, conversationState.pausedConversationId, resumeConversation, navigate]);

  // Funciones de invitación
  const handleInviteManager = useCallback(async () => {
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
      const {
        data,
        error
      } = await supabase.functions.invoke('unified-invitation', {
        body: {
          email: managerEmail.trim(),
          invitationType: 'manager_request'
        }
      });
      if (error) throw error;
      toast({
        title: "Request Sent!",
        description: `Your request to join the team has been sent to ${managerEmail}. They will receive an email with your invitation.`
      });
      setManagerEmail('');
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
  }, [managerEmail]);
  const handleAcceptInvitation = useCallback(async (invitation: any) => {
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
          action: 'accept'
        }
      });
      if (error) throw error;
      if (data?.success) {
        toast({
          title: "Invitation Accepted!",
          description: `You are now part of ${data.manager_name}'s team`
        });
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
  }, [user?.id, loadDashboardData]);
  const handleDeclineInvitation = useCallback(async (invitation: any) => {
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
          action: 'decline'
        }
      });
      if (error) throw error;
      if (data?.success) {
        toast({
          title: "Invitation Declined",
          description: "You have declined the team invitation"
        });
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
  }, [user?.id]);

  // useEffect para carga inicial CONTROLADA con debouncing mejorado
  useEffect(() => {
    if (!user?.id) return;
    if (hasLoadedInitialData.current) {
      console.log('⚠️ Dashboard already loaded, skipping');
      return;
    }
    hasLoadedInitialData.current = true;
    const initializeDashboard = async () => {
      console.log('🚀 Initializing dashboard for user:', user.id);

      // Add longer delay to prevent cascade failures
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadDashboardData();

      // Add delay before conversation state
      await new Promise(resolve => setTimeout(resolve, 500));
      if (getConversationState && !loadingInProgress.current) {
        await getConversationState(user.id);
      }

      // Longer delay before recovery
      setTimeout(() => {
        if (recoverAllMissingAnalyses && !loadingInProgress.current) {
          console.log('🔄 Running recovery process');
          recoverAllMissingAnalyses();
        }
      }, 5000); // Increased to 5 seconds
    };
    initializeDashboard();
  }, [user?.id]);

  // useEffect para navegación CONTROLADA
  useEffect(() => {
    if (!user?.id || location.pathname !== '/dashboard') return;
    const timeSinceLastLoad = Date.now() - lastLoadTime.current;
    if (timeSinceLastLoad < 2000) {
      console.log('⚠️ Skipping navigation refresh - too soon');
      return;
    }
    console.log('🔄 Dashboard navigation detected, refreshing conversation state');
    const refreshTimeout = setTimeout(() => {
      if (refetchConversationState && !loadingInProgress.current) {
        refetchConversationState(user.id);
      }
    }, 1000);
    return () => clearTimeout(refreshTimeout);
  }, [user?.id, location.pathname]);

  // useEffect para datos históricos
  useEffect(() => {
    if (user?.id && activeTab === 'historical') {
      const timeout = setTimeout(() => {
        loadHistoricalData();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [user?.id, activeTab, loadHistoricalData]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      hasLoadedInitialData.current = false;
      loadingInProgress.current = false;
    };
  }, []);
  const handleSharingPreferencesChange = useCallback((preferences: any) => {
    setSharingPreferences(preferences);
  }, []);
  const handleShareWithManager = useCallback(async (type: 'strengths' | 'opportunities') => {
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
      toast({
        title: "Shared Successfully!",
        description: `Your ${type} have been shared with your manager`
      });
    } catch (error: any) {
      console.error('Error sharing with manager:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to share with manager",
        variant: "destructive"
      });
    }
  }, [userProfile?.id, currentManager, allInsights]);
  return <div className="container mx-auto px-4 pt-8 pb-8 space-y-8">
      {/* Welcome Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold leading-tight text-slate-900">
              Hello, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}!
            </h1>
            <p className="text-muted-foreground my-[0px] py-[8px] text-base">
              {stats.completedConversations === 0 ? "Welcome to Gläub. This is where your journey toward greater self-awareness and professional growth begins. I'm here to support you whenever you're ready to start." : `Reflecting on our ${stats.completedConversations} conversation${stats.completedConversations === 1 ? '' : 's'}, your consistent engagement highlights a powerful commitment to your well-being and development.`}
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
              {conversationState.hasPausedConversation ? <div className="space-y-2">
                  <p className="text-primary-foreground/90">
                    You have a paused conversation
                  </p>
                  {conversationState.lastTopic && <p className="text-sm text-primary-foreground/70">
                      Last topic: {conversationState.lastTopic}
                    </p>}
                  {conversationState.pausedAt && <p className="text-xs text-primary-foreground/60">
                      Paused {new Date(conversationState.pausedAt).toLocaleDateString()}
                    </p>}
                </div> : <p className="text-primary-foreground/90">
                  Start a new conversation with your AI therapeutic assistant
                </p>}
              
              <div className="flex gap-3 mt-4">
                {conversationState.hasPausedConversation ? <>
                    <Button variant="secondary" size="lg" onClick={handleResumeConversation} disabled={isConversationLoading}>
                      <Play className="mr-2 h-5 w-5" />
                      Resume Conversation
                    </Button>
                    <Button variant="outline" size="lg" onClick={handleStartNewConversation} disabled={isConversationLoading} className="bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                      <Plus className="mr-2 h-5 w-5" />
                      Start New Conversation
                    </Button>
                  </> : <Button variant="secondary" size="lg" onClick={handleStartNewConversation} disabled={isConversationLoading}>
                    <Plus className="mr-2 h-5 w-5" />
                    Start New Session
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

      {/* Main Content Layout - 70% Profile, 30% Teams */}
      <div className="grid gap-6 lg:grid-cols-10">
        {/* Variables Profile - 70% width on desktop */}
        {oceanProfile && (
          <div className="lg:col-span-7">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-secondary" />
                  Your profile
                </CardTitle>
                <CardDescription>Based on your conversation patterns</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-6">
                  <div className="grid grid-cols-5 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-primary">{oceanProfile.openness || 0}%</div>
                      <div className="text-xs text-muted-foreground">Openness</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">{oceanProfile.conscientiousness || 0}%</div>
                      <div className="text-xs text-muted-foreground">Conscientiousness</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">{oceanProfile.extraversion || 0}%</div>
                      <div className="text-xs text-muted-foreground">Extraversion</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">{oceanProfile.agreeableness || 0}%</div>
                      <div className="text-xs text-muted-foreground">Agreeableness</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">{100 - (oceanProfile.neuroticism || 0)}%</div>
                      <div className="text-xs text-muted-foreground">Stability</div>
                    </div>
                  </div>
                  {/* OCEAN Personality Description */}
                  {oceanDescription && <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                      <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-secondary" />
                        Your Personality Analysis
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {oceanDescription}
                      </p>
                      {isLoadingDescription && <div className="flex items-center gap-2 mt-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          <span className="text-xs text-muted-foreground">Updating analysis...</span>
                        </div>}
                    </div>}
                  
                  {/* Strengths Analysis */}
                  {stats.completedConversations > 0 && (
                    <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                      <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                        <Target className="h-4 w-4 text-secondary" />
                        Your Professional Strengths
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {oceanProfile ? (
                          `Your professional profile shows particular strength in ${
                            Math.max(
                              oceanProfile.openness || 0,
                              oceanProfile.conscientiousness || 0,
                              oceanProfile.extraversion || 0,
                              oceanProfile.agreeableness || 0,
                              100 - (oceanProfile.neuroticism || 0)
                            ) === oceanProfile.openness ? 'creativity and adaptability'
                            : Math.max(
                              oceanProfile.openness || 0,
                              oceanProfile.conscientiousness || 0,
                              oceanProfile.extraversion || 0,
                              oceanProfile.agreeableness || 0,
                              100 - (oceanProfile.neuroticism || 0)
                            ) === oceanProfile.conscientiousness ? 'organization and reliability'
                            : Math.max(
                              oceanProfile.openness || 0,
                              oceanProfile.conscientiousness || 0,
                              oceanProfile.extraversion || 0,
                              oceanProfile.agreeableness || 0,
                              100 - (oceanProfile.neuroticism || 0)
                            ) === oceanProfile.extraversion ? 'communication and leadership'
                            : Math.max(
                              oceanProfile.openness || 0,
                              oceanProfile.conscientiousness || 0,
                              oceanProfile.extraversion || 0,
                              oceanProfile.agreeableness || 0,
                              100 - (oceanProfile.neuroticism || 0)
                            ) === oceanProfile.agreeableness ? 'collaboration and empathy'
                            : 'emotional resilience and stability'
                          }. Through ${stats.completedConversations} conversations, you've demonstrated commitment to self-improvement and reflective thinking.`
                        ) : (
                          `Based on your ${stats.completedConversations} conversations, you demonstrate growing self-awareness and emotional regulation. Your ability to engage in reflective dialogue shows promising professional development foundations.`
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Teams Section - 30% width on desktop */}
        <div className="lg:col-span-3 space-y-6">
          {userProfile && <MyTeams userProfile={userProfile} className="h-fit" />}
          
          {/* Pending Invitations */}
          {pendingInvitations && pendingInvitations.length > 0 && <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-secondary" />
                  Pending Invitations ({pendingInvitations.length})
                </CardTitle>
                <CardDescription>
                  Team invitations waiting for your response
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pendingInvitations.map(invitation => <div key={invitation.id} className="p-4 border rounded-lg space-y-3">
                      <div>
                        <p className="font-medium text-foreground">
                          Join {invitation.manager?.full_name || invitation.manager?.display_name}'s Team
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Invitation expires: {new Date(invitation.expires_at).toLocaleDateString()}
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
              </CardContent>
            </Card>}

          {/* Join Team - Show only if no current manager and no pending invitations */}
          {!currentManager && (!pendingInvitations || pendingInvitations.length === 0) && <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-secondary" />
                  Join a Team
                </CardTitle>
                <CardDescription>
                  Request to join your manager's team
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="manager-email">Manager's Email</Label>
                    <Input id="manager-email" type="email" placeholder="manager@company.com" value={managerEmail} onChange={e => setManagerEmail(e.target.value)} />
                  </div>
                  <Button onClick={handleInviteManager} disabled={isInvitingManager} className="w-full">
                    {isInvitingManager ? "Sending Request..." : "Request to Join"}
                  </Button>
                </div>
              </CardContent>
            </Card>}
        </div>
      </div>

      {/* Profile Status Insights - Only show if we have conversations */}
      {userProfile && stats.completedConversations > 0 && <ProfileStatusInsights profile={userProfile} stats={stats} oceanProfile={oceanProfile} conversations={stats.completedConversations} onStartConversation={handleStartNewConversation} />}

      {/* Sharing & Collaboration */}
      {currentManager && <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-secondary" />
              Sharing & Collaboration
            </CardTitle>
            <CardDescription>
              Control what data you share with your manager
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <SharingPreferences userProfile={userProfile} onPreferencesChange={handleSharingPreferencesChange} />
              
              {/* Quick Share Actions */}
              <div className="flex gap-4 pt-4 border-t">
                <Button variant="outline" size="sm" onClick={() => handleShareWithManager('strengths')} className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Share Strengths
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleShareWithManager('opportunities')} className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Share Growth Areas
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>}
    </div>;
};
export default Dashboard;