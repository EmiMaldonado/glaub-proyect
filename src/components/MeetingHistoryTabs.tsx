import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar, 
  MessageCircle, 
  TrendingUp, 
  Brain, 
  Target, 
  Clock,
  BarChart3
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, parseISO } from 'date-fns';

interface MeetingHistoryTabsProps {
  userId?: string; // For manager viewing team member data
  showSharedOnly?: boolean; // Only show data that's shared with manager
}

interface Conversation {
  id: string;
  title: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  insights?: any;
  ocean_signals?: any;
  user_id: string;
}

interface KeyInsight {
  id: string;
  conversation_id: string;
  insights: any;
  personality_notes: any;
  next_steps: any;
  created_at: string;
}

interface CumulativeSummary {
  totalSessions: number;
  averageDuration: number;
  totalInsights: number;
  topInsights: string[];
  oceanProgress: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  nextSteps: string[];
  period: string;
}

const MeetingHistoryTabs: React.FC<MeetingHistoryTabsProps> = ({ 
  userId, 
  showSharedOnly = false 
}) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [insights, setInsights] = useState<KeyInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'day' | 'month' | 'quarter'>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [lastMeeting, setLastMeeting] = useState<Conversation | null>(null);

  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) {
      loadMeetingData();
    }
  }, [targetUserId, showSharedOnly]);

  const loadMeetingData = async () => {
    if (!targetUserId) return;

    try {
      setLoading(true);

      // Load conversations
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (conversationsError) throw conversationsError;

      // Load insights
      const conversationIds = conversationsData?.map(c => c.id) || [];
      let insightsData: KeyInsight[] = [];

      if (conversationIds.length > 0) {
        const { data: insightsResponse, error: insightsError } = await supabase
          .from('key_insights')
          .select('*')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false });

        if (insightsError) throw insightsError;
        insightsData = insightsResponse || [];
      }

      // If showing shared only, filter based on sharing preferences
      if (showSharedOnly && userId) {
        // TODO: Filter based on sharing preferences
        // For now, show all data - this should be enhanced with proper sharing logic
      }

      setConversations(conversationsData || []);
      setInsights(insightsData);

      // Set last meeting
      const lastCompleted = conversationsData?.find(c => c.status === 'completed');
      setLastMeeting(lastCompleted || null);

    } catch (error) {
      console.error('Error loading meeting data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    switch (activeFilter) {
      case 'month':
        return {
          start: startOfMonth(selectedDate),
          end: endOfMonth(selectedDate)
        };
      case 'quarter':
        return {
          start: startOfQuarter(selectedDate),
          end: endOfQuarter(selectedDate)
        };
      default:
        return {
          start: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()),
          end: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59)
        };
    }
  };

  const getFilteredConversations = () => {
    if (activeFilter === 'day') {
      // For day filter, show individual conversations
      const { start, end } = getDateRange();
      return conversations.filter(conv => {
        const convDate = parseISO(conv.started_at);
        return convDate >= start && convDate <= end;
      });
    }
    return conversations; // For month/quarter, we'll use all conversations for cumulative summary
  };

  const generateCumulativeSummary = (): CumulativeSummary => {
    const { start, end } = getDateRange();
    
    const periodConversations = conversations.filter(conv => {
      const convDate = parseISO(conv.started_at);
      return convDate >= start && convDate <= end;
    });

    const periodInsights = insights.filter(insight => {
      const insightDate = parseISO(insight.created_at);
      return insightDate >= start && insightDate <= end;
    });

    // Calculate averages and totals
    const totalSessions = periodConversations.length;
    const averageDuration = totalSessions > 0 
      ? Math.round(periodConversations.reduce((sum, conv) => sum + (conv.duration_minutes || 0), 0) / totalSessions)
      : 0;

    const allInsights = periodInsights.flatMap(insight => insight.insights || []);
    const allNextSteps = periodInsights.flatMap(insight => insight.next_steps || []);

    // Calculate OCEAN averages
    const personalityData = periodInsights
      .map(insight => insight.personality_notes)
      .filter(Boolean);

    const oceanProgress = personalityData.length > 0 ? {
      openness: Math.round(personalityData.reduce((sum: number, p: any) => sum + (p?.openness || 0), 0) / personalityData.length),
      conscientiousness: Math.round(personalityData.reduce((sum: number, p: any) => sum + (p?.conscientiousness || 0), 0) / personalityData.length),
      extraversion: Math.round(personalityData.reduce((sum: number, p: any) => sum + (p?.extraversion || 0), 0) / personalityData.length),
      agreeableness: Math.round(personalityData.reduce((sum: number, p: any) => sum + (p?.agreeableness || 0), 0) / personalityData.length),
      neuroticism: Math.round(personalityData.reduce((sum: number, p: any) => sum + (p?.neuroticism || 0), 0) / personalityData.length)
    } : {
      openness: 0,
      conscientiousness: 0,
      extraversion: 0,
      agreeableness: 0,
      neuroticism: 0
    };

    return {
      totalSessions,
      averageDuration,
      totalInsights: allInsights.length,
      topInsights: allInsights.slice(0, 5),
      oceanProgress,
      nextSteps: allNextSteps.slice(0, 5),
      period: activeFilter === 'month' 
        ? format(selectedDate, 'MMMM yyyy')
        : activeFilter === 'quarter'
          ? `Q${Math.floor(selectedDate.getMonth() / 3) + 1} ${selectedDate.getFullYear()}`
          : format(selectedDate, 'MMMM dd, yyyy')
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading meeting history...</p>
        </div>
      </div>
    );
  }

  const filteredConversations = getFilteredConversations();
  const cumulativeSummary = generateCumulativeSummary();

  return (
    <div className="space-y-6">
      <Tabs defaultValue="last-meeting" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="last-meeting">Last Meeting</TabsTrigger>
          <TabsTrigger value="historical">Historical</TabsTrigger>
        </TabsList>

        {/* Tab 1: Last Meeting */}
        <TabsContent value="last-meeting" className="space-y-6">
          {lastMeeting ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  {lastMeeting.title}
                </CardTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(parseISO(lastMeeting.started_at), 'MMM dd, yyyy')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {lastMeeting.duration_minutes} minutes
                  </span>
                  <Badge variant={lastMeeting.status === 'completed' ? 'default' : 'secondary'}>
                    {lastMeeting.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Show insights from the last meeting */}
                {insights.find(i => i.conversation_id === lastMeeting.id) && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Key Insights
                      </h4>
                      <div className="space-y-2">
                        {insights
                          .find(i => i.conversation_id === lastMeeting.id)
                          ?.insights?.slice(0, 3)
                          .map((insight: string, idx: number) => (
                            <p key={idx} className="text-sm text-muted-foreground">
                              • {insight}
                            </p>
                          )) || <p className="text-sm text-muted-foreground">No insights available</p>
                        }
                      </div>
                    </div>

                    {/* OCEAN Profile for last meeting */}
                    {insights.find(i => i.conversation_id === lastMeeting.id)?.personality_notes && (
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Brain className="h-4 w-4" />
                          Personality Insights
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(insights.find(i => i.conversation_id === lastMeeting.id)?.personality_notes || {})
                            .filter(([key]) => key !== 'summary')
                            .map(([trait, value]: [string, any]) => (
                              <div key={trait} className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="capitalize">{trait}</span>
                                  <span>{value}%</span>
                                </div>
                                <Progress value={value} className="h-2" />
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground mt-4">No meetings yet</p>
                <p className="text-sm text-muted-foreground">Start a conversation to see your meeting history</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Historical with Filters */}
        <TabsContent value="historical" className="space-y-6">
          {/* Filter Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Historical Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={activeFilter === 'day' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter('day')}
                >
                  Day View
                </Button>
                <Button
                  variant={activeFilter === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter('month')}
                >
                  Month Summary
                </Button>
                <Button
                  variant={activeFilter === 'quarter' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter('quarter')}
                >
                  Quarter Summary
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results based on filter */}
          {activeFilter === 'day' ? (
            // Individual day view - show specific conversations
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Showing conversations for {format(selectedDate, 'MMMM dd, yyyy')}
              </p>
              
              {filteredConversations.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground mt-4">No conversations on this date</p>
                  </CardContent>
                </Card>
              ) : (
                filteredConversations.map((conversation) => (
                  <Card key={conversation.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{conversation.title}</h4>
                        <Badge variant={conversation.status === 'completed' ? 'default' : 'secondary'}>
                          {conversation.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span>{format(parseISO(conversation.started_at), 'HH:mm')}</span>
                        <span>{conversation.duration_minutes} min</span>
                      </div>

                      {/* Show insights for this conversation */}
                      {insights.find(i => i.conversation_id === conversation.id) && (
                        <div className="space-y-2">
                          {insights
                            .find(i => i.conversation_id === conversation.id)
                            ?.insights?.slice(0, 2)
                            .map((insight: string, idx: number) => (
                              <p key={idx} className="text-sm text-muted-foreground">
                                • {insight}
                              </p>
                            ))
                          }
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ) : (
            // Cumulative summary for month/quarter
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {activeFilter === 'month' ? 'Monthly' : 'Quarterly'} Summary - {cumulativeSummary.period}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Stats Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{cumulativeSummary.totalSessions}</p>
                      <p className="text-sm text-muted-foreground">Total Sessions</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{cumulativeSummary.averageDuration}m</p>
                      <p className="text-sm text-muted-foreground">Avg Duration</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{cumulativeSummary.totalInsights}</p>
                      <p className="text-sm text-muted-foreground">Total Insights</p>
                    </div>
                  </div>

                  {/* OCEAN Progress */}
                  {Object.values(cumulativeSummary.oceanProgress).some(val => val > 0) && (
                    <div>
                      <h4 className="font-medium mb-4 flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        OCEAN Personality Progress
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(cumulativeSummary.oceanProgress).map(([trait, value]) => (
                          <div key={trait} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="capitalize">{trait}</span>
                              <span>{value}%</span>
                            </div>
                            <Progress value={value} className="h-2" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Insights */}
                  {cumulativeSummary.topInsights.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Key Insights This {activeFilter === 'month' ? 'Month' : 'Quarter'}
                      </h4>
                      <div className="space-y-2">
                        {cumulativeSummary.topInsights.map((insight, idx) => (
                          <p key={idx} className="text-sm text-muted-foreground">• {insight}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Next Steps */}
                  {cumulativeSummary.nextSteps.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Action Items
                      </h4>
                      <div className="space-y-2">
                        {cumulativeSummary.nextSteps.map((step, idx) => (
                          <p key={idx} className="text-sm text-muted-foreground">• {step}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MeetingHistoryTabs;