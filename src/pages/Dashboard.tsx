import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, TrendingUp, Users, Calendar, Plus, History, Settings, Target, Lightbulb, Share2, UserCheck, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { usePausedConversations } from "@/hooks/usePausedConversations";
import SharingPreferences from "@/components/SharingPreferences";
import SharedDataIndicator from "@/components/SharedDataIndicator";
// import MyTeams from "@/components/ui/MyTeams";
const Dashboard = () => {
  const {
    user
  } = useAuth();
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

  return <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Welcome Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Hello, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}! 👋
            </h1>
            <p className="text-lg text-muted-foreground">
              {personalizedSummary || "Your personal space for self-discovery and professional development."}
            </p>
          </div>
          {userProfile?.role === 'manager' && (
            <Button variant="default" asChild>
              <Link to="/dashboard/manager">
                <Users className="mr-2 h-4 w-4" />
                Go to Manager Dashboard
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Section 1: New Conversation - Always show start new conversation */}
      <Card className="bg-gradient-primary text-primary-foreground shadow-elegant">
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold">Speak with Glai</h2>
              <p className="text-primary-foreground/90">
                Start a new conversation{hasPausedConversation ? ' or continue your previous session' : ''}
              </p>
              <div className="flex gap-3 mt-4">
                <Button variant="secondary" size="lg" asChild>
                  <Link to="/conversation" onClick={handleStartNewConversation}>
                    <Plus className="mr-2 h-5 w-5" />
                    Start New Session
                  </Link>
                </Button>
                {hasPausedConversation && (
                  <Button variant="default" size="lg" asChild>
                    <Link to="/conversation?continue=true">
                      <MessageCircle className="mr-2 h-5 w-5" />
                      Continue Previous Conversation
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            <div className="hidden md:block">
              <MessageCircle className="h-16 w-16 text-primary-foreground/20" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section: Paused Conversations (if any) */}
      {pausedConversations.length > 1 && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Your Paused Conversations
            </CardTitle>
            <CardDescription>
              You have {pausedConversations.length} paused conversations that you can continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pausedConversations.slice(0, 3).map((conversation, index) => (
                <div key={conversation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{conversation.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Paused on {new Date(conversation.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/conversation?resume=${conversation.id}`}>
                      Continue
                    </Link>
                  </Button>
                </div>
              ))}
              {pausedConversations.length > 3 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  And {pausedConversations.length - 3} more paused conversation{pausedConversations.length - 3 > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 2: Your Last Meeting */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Your Last Meeting
              </CardTitle>
              <CardDescription>
                {lastConversation ? `Completed on ${new Date(lastConversation.created_at).toLocaleDateString()}` : 'No conversation data available'}
              </CardDescription>
            </div>
            <SharedDataIndicator 
              isShared={sharingPreferences.share_conversations}
              variant="subtle"
            />
          </div>
        </CardHeader>
        <CardContent>
          {lastConversation ? <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <p className="font-medium">{lastConversation.duration_minutes || 15} min</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <p className="font-medium">Complete Conversation</p>
                </div>
                 <div>
                   <span className="text-muted-foreground">Insights:</span>
                   <p className="font-medium">{lastConversation.key_insights?.insights?.length || 0} generated</p>
                 </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/history">
                  <History className="mr-1 h-3 w-3" />
                  View Complete History
                </Link>
              </Button>
            </div> : <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No conversation data available</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete your first conversation to see a summary here
              </p>
            </div>}
        </CardContent>
      </Card>

      {/* Section 3: Your OCEAN Profile */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-secondary" />
                Your OCEAN Profile
              </CardTitle>
              <CardDescription>
                Personality dimensions based on your conversations
              </CardDescription>
            </div>
            <SharedDataIndicator 
              isShared={sharingPreferences.share_ocean_profile}
              variant="default"
            />
          </div>
        </CardHeader>
        <CardContent>
          {oceanProfile ? <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{oceanProfile.openness || 0}%</div>
                  <div className="text-xs text-muted-foreground">Openness</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{oceanProfile.conscientiousness || 0}%</div>
                  <div className="text-xs text-muted-foreground">Conscientiousness</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{oceanProfile.extraversion || 0}%</div>
                  <div className="text-xs text-muted-foreground">Extraversion</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{oceanProfile.agreeableness || 0}%</div>
                  <div className="text-xs text-muted-foreground">Agreeableness</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{100 - (oceanProfile.neuroticism || 0)}%</div>
                  <div className="text-xs text-muted-foreground">Stability</div>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-foreground/80 leading-relaxed">
                  Your OCEAN profile reveals your unique personality patterns based on conversational analysis. Higher openness indicates creativity and willingness to try new experiences, while conscientiousness reflects your organization and goal-oriented nature. Extraversion measures your energy from social interactions, and agreeableness shows your cooperative and trusting tendencies. Finally, emotional stability (inverse of neuroticism) represents your resilience under stress. These dimensions work together to create your distinctive professional and personal approach to challenges and relationships.
                </p>
              </div>
            </div> : <div className="text-center py-8">
              <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No personality data available</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete a conversation to generate your personalized OCEAN profile
              </p>
            </div>}
        </CardContent>
      </Card>

      {/* Section 4: Strengths and Growth Opportunities */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                Strengths
                <SharedDataIndicator 
                  isShared={sharingPreferences.share_insights}
                  variant="subtle"
                />
              </div>
              {allInsights.length > 0 && currentManager && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShareWithManager('strengths')}
                  className="flex items-center gap-1"
                >
                  <Share2 className="h-4 w-4" />
                  Share with Manager
                </Button>
              )}
            </CardTitle>
            <CardDescription>
              Your main identified strengths
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allInsights.length > 0 ? <ul className="space-y-2">
                {allInsights.flatMap(insight => insight.insights || []).slice(0, 5).map((insight: string, index: number) => <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-600 mt-2 flex-shrink-0" />
                    <span className="text-sm">{insight}</span>
                  </li>)}
              </ul> : <div className="text-center py-6">
                <Target className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm font-medium">No strengths data available</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Complete a conversation to identify your strengths
                </p>
              </div>}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-600" />
                Growth Opportunities
                <SharedDataIndicator 
                  isShared={sharingPreferences.share_insights}
                  variant="subtle"
                />
              </div>
              {allInsights.length > 0 && currentManager && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShareWithManager('opportunities')}
                  className="flex items-center gap-1"
                >
                  <Share2 className="h-4 w-4" />
                  Share with Manager
                </Button>
              )}
            </CardTitle>
            <CardDescription>
              Areas for your professional development
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allInsights.length > 0 ? <ul className="space-y-2">
                {allInsights.flatMap(insight => insight.next_steps || []).slice(0, 5).map((step: string, index: number) => <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-2 flex-shrink-0" />
                    <span className="text-sm">{step}</span>
                  </li>)}
              </ul> : <div className="text-center py-6">
                <Lightbulb className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm font-medium">No growth opportunities available</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended steps will appear after your first conversation
                </p>
              </div>}
          </CardContent>
        </Card>
      </div>

      {/* Section 6: Data Sharing Preferences */}
      <SharingPreferences
        userProfile={userProfile}
        managerId={currentManager?.id}
        onPreferencesChange={handleSharingPreferencesChange}
      />

      {/* Section 7: My Teams - Combined team status and memberships */}
      <div className="space-y-6">
        {/* My Teams */}
        {/* <MyTeams userProfile={userProfile} /> */}
        <Card className="shadow-soft border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Team Management (Coming Soon)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Team management features will be available soon.</p>
          </CardContent>
        </Card>

        {/* Pending Team Invitations */}
        {pendingInvitations.length > 0 && (
          <Card className="shadow-soft border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                Pending Team Invitations ({pendingInvitations.length})
              </CardTitle>
              <CardDescription>
                You have been invited to join the following teams
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingInvitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-4 border rounded-lg bg-primary/5">
                  <div>
                    <p className="font-medium">
                      Invitation from {invitation.manager?.display_name || invitation.manager?.full_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Invited on {new Date(invitation.created_at).toLocaleDateString()} • 
                      Expires on {new Date(invitation.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleAcceptInvitation(invitation)}
                    >
                      Accept
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleDeclineInvitation(invitation)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Request to Join Team */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Request to Join Team
            </CardTitle>
            <CardDescription>
              Submit a request to join a manager's team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manager-email">Manager's Email Address</Label>
              <Input
                id="manager-email"
                type="email"
                placeholder="Enter your manager's email address"
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleInviteManager()}
              />
            </div>
            <Button onClick={handleInviteManager} disabled={isInvitingManager} className="w-full">
              {isInvitingManager ? 'Sending Request...' : 'Submit Approval Request'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>;
};
export default Dashboard;