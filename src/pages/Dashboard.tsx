import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  MessageCircle, 
  Brain, 
  TrendingUp, 
  Users, 
  Calendar,
  Plus,
  History,
  Settings,
  Target,
  Lightbulb,
  Share2,
  UserCheck
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

const Dashboard = () => {
  const { user } = useAuth();
  const [lastConversation, setLastConversation] = useState<any>(null);
  const [oceanProfile, setOceanProfile] = useState<any>(null);
  const [allInsights, setAllInsights] = useState<any[]>([]);
  const [personalizedSummary, setPersonalizedSummary] = useState<string>('');
  const [sharingSettings, setSharingSettings] = useState({
    profile: false,
    insights: false,
    strengths: false,
    opportunities: false,
    manager: false,
    team: false
  });
  const [stats, setStats] = useState({
    totalConversations: 0,
    completedConversations: 0,
    sharedInsights: 0,
    teamMembers: 0
  });

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      // Load all conversations for comprehensive analysis
      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Load all insights from all conversations
      const { data: insights } = await supabase
        .from('key_insights')
        .select(`
          *,
          conversation:conversations!inner(
            user_id,
            created_at,
            title
          )
        `)
        .eq('conversation.user_id', user.id)
        .order('created_at', { ascending: false });

      // Set all insights for comprehensive dashboard
      if (insights) {
        setAllInsights(insights);
        
        // Generate personalized summary based on all conversations
        const allPersonalityData = insights.map(i => i.personality_notes).filter(Boolean);
        const allInsightsData = insights.flatMap(i => i.insights || []);
        const allNextSteps = insights.flatMap(i => i.next_steps || []);
        
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
      const { data: lastConv } = await supabase
        .from('conversations')
        .select(`
          *,
          key_insights (
            insights,
            personality_notes,
            next_steps
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastConv) {
        setLastConversation(lastConv);
      }

      setStats({
        totalConversations: conversations?.length || 0,
        completedConversations: conversations?.filter(c => c.status === 'completed').length || 0,
        sharedInsights: 0, // TODO: implement sharing tracking
        teamMembers: 0 // TODO: implement team member count
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const handleSharingToggle = (setting: string) => {
    setSharingSettings(prev => ({
      ...prev,
      [setting]: !prev[setting as keyof typeof prev]
    }));
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Welcome Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          Hello, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}! 👋
        </h1>
        <p className="text-lg text-muted-foreground">
          {personalizedSummary || "Your personal space for self-discovery and professional development."}
        </p>
      </div>

      {/* Section 1: New Conversation - Prominent */}
      <Card className="bg-gradient-primary text-primary-foreground shadow-elegant">
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold">New Conversation</h2>
              <p className="text-primary-foreground/90">
                Start a 10-15 minute session to discover new insights about your personality
              </p>
              <Button 
                variant="secondary" 
                size="lg" 
                className="mt-4"
                asChild
              >
                <Link to="/conversation">
                  <Plus className="mr-2 h-5 w-5" />
                  Start Now
                </Link>
              </Button>
            </div>
            <div className="hidden md:block">
              <MessageCircle className="h-16 w-16 text-primary-foreground/20" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Your Last Meeting */}
      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Your Last Meeting
            </CardTitle>
            <CardDescription>
              {lastConversation ? 
                `Completed on ${new Date(lastConversation.created_at).toLocaleDateString()}` :
                'No conversation data available'
              }
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch 
              checked={sharingSettings.insights}
              onCheckedChange={() => handleSharingToggle('insights')}
            />
            <span className="text-sm text-muted-foreground">Share with Manager</span>
          </div>
        </CardHeader>
        <CardContent>
          {lastConversation ? (
            <div className="space-y-3">
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
                  <p className="font-medium">{lastConversation.key_insights?.insights?.length || 3} generated</p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/history">
                  <History className="mr-1 h-3 w-3" />
                  View Complete History
                </Link>
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No conversation data available</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete your first conversation to see a summary here
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Your OCEAN Profile */}
      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-secondary" />
              Your OCEAN Profile
            </CardTitle>
            <CardDescription>
              Personality dimensions based on your conversations
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch 
              checked={sharingSettings.profile}
              onCheckedChange={() => handleSharingToggle('profile')}
            />
            <span className="text-sm text-muted-foreground">Share with Manager</span>
          </div>
        </CardHeader>
        <CardContent>
          {oceanProfile ? (
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
          ) : (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No personality data available</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete a conversation to generate your personalized OCEAN profile
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Strengths and Growth Opportunities */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                Strengths
              </CardTitle>
              <CardDescription>
                Your main identified strengths
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={sharingSettings.strengths}
                onCheckedChange={() => handleSharingToggle('strengths')}
              />
              <span className="text-sm text-muted-foreground">Share</span>
            </div>
          </CardHeader>
          <CardContent>
            {allInsights.length > 0 ? (
              <ul className="space-y-2">
                {allInsights.flatMap(insight => insight.insights || []).slice(0, 5).map((insight: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-600 mt-2 flex-shrink-0" />
                    <span className="text-sm">{insight}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-6">
                <Target className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm font-medium">No strengths data available</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Complete a conversation to identify your strengths
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-600" />
                Growth Opportunities
              </CardTitle>
              <CardDescription>
                Areas for your professional development
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={sharingSettings.opportunities}
                onCheckedChange={() => handleSharingToggle('opportunities')}
              />
              <span className="text-sm text-muted-foreground">Share</span>
            </div>
          </CardHeader>
          <CardContent>
            {allInsights.length > 0 ? (
              <ul className="space-y-2">
                {allInsights.flatMap(insight => insight.next_steps || []).slice(0, 5).map((step: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-2 flex-shrink-0" />
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-6">
                <Lightbulb className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm font-medium">No growth opportunities available</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended steps will appear after your first conversation
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 5: Work with your Manager and Build your Team */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-600" />
                Work with your Manager
              </CardTitle>
              <CardDescription>
                Improve communication and collaboration
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={sharingSettings.manager}
                onCheckedChange={() => handleSharingToggle('manager')}
              />
              <span className="text-sm text-muted-foreground">Share</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Share selected insights with your manager to improve communication and professional development.
            </p>
            <Button variant="outline" size="sm" disabled>
              <Share2 className="mr-1 h-3 w-3" />
              Send Invitation
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
              Build your Team
              </CardTitle>
              <CardDescription>
                Group insights and team dynamics
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={sharingSettings.team}
                onCheckedChange={() => handleSharingToggle('team')}
              />
              <span className="text-sm text-muted-foreground">Share</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.teamMembers > 0 || stats.sharedInsights > 0 ? (
              <div className="text-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Team members:</span>
                  <span className="font-medium">{stats.teamMembers}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Shared insights:</span>
                  <span className="font-medium">{stats.sharedInsights}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No team data available</p>
              </div>
            )}
            <Button variant="outline" size="sm" disabled>
              <Users className="mr-1 h-3 w-3" />
              Manage Team
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;