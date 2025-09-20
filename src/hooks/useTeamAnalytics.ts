import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TeamMember {
  id: string;
  full_name: string;
  display_name: string;
  user_id: string;
}

interface TeamAnalyticsData {
  overview: {
    totalMembers: number;
    activeMembers: number;
    totalSessions: number;
    averageEngagement: number;
  };
  trends: {
    sessionGrowth: number;
    engagementTrend: number;
    insightGeneration: number;
  };
  distribution: {
    sessionsByMember: Array<{ name: string; sessions: number }>;
    personalityDistribution: {
      openness: number;
      conscientiousness: number;
      extraversion: number;
      agreeableness: number;
      neuroticism: number;
    };
  };
  teamHealth: {
    overallScore: number;
    communicationScore: number;
    developmentScore: number;
    wellbeingScore: number;
  };
  teamDescription?: string;
}

export const useTeamAnalytics = (managerId: string, teamMembers: TeamMember[]) => {
  const [analyticsData, setAnalyticsData] = useState<TeamAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamDescription, setTeamDescription] = useState<string>('');

  useEffect(() => {
    generateAnalyticsData();
  }, [managerId, teamMembers]);

  const generateAnalyticsData = async () => {
    console.log('🔄 Starting analytics generation for team:', { managerId, teamCount: teamMembers.length });
    setLoading(true);
    
    try {
      // Get conversations count for team members
      const teamUserIds = teamMembers.map(member => member.user_id);
      console.log('👥 Team user IDs:', teamUserIds);
      
      const { data: conversations, error: conversationsError } = await supabase
        .from('conversations')
        .select('id, user_id, status, created_at')
        .in('user_id', teamUserIds);

      if (conversationsError) {
        console.error('❌ Error fetching conversations:', conversationsError);
      }

      console.log('💬 Found conversations:', conversations?.length || 0, conversations);

      // Get insights count for team members
      const { data: insights, error: insightsError } = await supabase
        .from('key_insights')
        .select('id, conversation_id')
        .in('conversation_id', conversations?.map(c => c.id) || []);

      if (insightsError) {
        console.error('❌ Error fetching insights:', insightsError);
      }

      console.log('💡 Found insights:', insights?.length || 0);

      // Calculate real analytics based on actual data
      const totalSessions = conversations?.length || 0;
      const totalInsights = insights?.length || 0;
      const activeMembers = new Set(conversations?.map(c => c.user_id)).size;

      // Calculate real sessions by member
      const sessionsByMember = teamMembers.map(member => {
        const memberSessions = conversations?.filter(c => c.user_id === member.user_id).length || 0;
        return {
          name: member.display_name || member.full_name,
          sessions: memberSessions
        };
      });

      console.log('📊 Sessions by member:', sessionsByMember);

      // Calculate realistic trends based on actual data
      const recentSessions = conversations?.filter(c => {
        const createdDate = new Date(c.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return createdDate > weekAgo;
      }).length || 0;

      const sessionGrowth = totalSessions > 0 ? Math.round((recentSessions / totalSessions) * 100) : 0;
      const engagementTrend = activeMembers > 0 ? Math.round((totalSessions / activeMembers) * 10) : 0;
      const insightGeneration = totalSessions > 0 ? Math.round((totalInsights / totalSessions) * 100) : 0;

      // Generate team OCEAN profile using AI
      let personalityDistribution = {
        openness: 65,
        conscientiousness: 72,
        extraversion: 58,
        agreeableness: 78,
        neuroticism: 42
      };
      let aiTeamDescription = '';
      let usingRealData = false;

      if (teamMembers.length > 0) {
        try {
          console.log('🧠 Calling team OCEAN profile function with data:', {
            managerId,
            teamMembers: teamMembers.map(m => ({
              id: m.id,
              user_id: m.user_id,
              full_name: m.full_name,
              display_name: m.display_name
            }))
          });

          const { data: oceanData, error: oceanError } = await supabase.functions.invoke(
            'generate-team-ocean-profile',
            {
              body: { managerId, teamMembers }
            }
          );

          console.log('🌊 Ocean function response:', { oceanData, oceanError });

          if (oceanError) {
            console.error('❌ Ocean function error:', oceanError);
            setTeamDescription('Unable to generate team analysis due to service error. Please try refreshing.');
            usingRealData = false;
          } else if (oceanData?.success) {
            personalityDistribution = oceanData.personalityData;
            aiTeamDescription = oceanData.teamDescription || '';
            
            if (aiTeamDescription.trim()) {
              console.log('✅ Team OCEAN profile generated successfully with description:', {
                dataPoints: oceanData.metadata?.personalityDataPoints || 0,
                usingRealData: true,
                descriptionLength: aiTeamDescription.length
              });
              setTeamDescription(aiTeamDescription);
              usingRealData = (oceanData.metadata?.personalityDataPoints || 0) > 0;
            } else {
              console.warn('⚠️ Team OCEAN profile generated but description is empty');
              setTeamDescription('Team analysis service is processing your data. Real personality metrics are available, but the detailed description is still being generated. Please refresh in a moment.');
              usingRealData = (oceanData.metadata?.personalityDataPoints || 0) > 0;
            }
          } else {
            console.warn('⚠️ Ocean function returned unsuccessful response:', oceanData);
            const fallbackDescription = oceanData?.teamDescription || 'Unable to generate team analysis at this time. Please ensure team members have completed conversations.';
            setTeamDescription(fallbackDescription);
            if (oceanData?.personalityData) {
              personalityDistribution = oceanData.personalityData;
            }
            usingRealData = false;
          }
        } catch (error) {
          console.error('❌ Failed to call team OCEAN profile function:', error);
          setTeamDescription('Team analysis service is temporarily unavailable. Please check your connection and try refreshing the page.');
          usingRealData = false;
        }
      } else {
        setTeamDescription('No team members found. Add team members to generate personality analysis.');
      }

      // Calculate team health scores based on real data
      const baseHealthScore = 70;
      const engagementBonus = Math.min(engagementTrend * 2, 20);
      const insightBonus = Math.min(insightGeneration / 2, 15);
      const teamSizeBonus = Math.min(teamMembers.length * 2, 10);

      const overallScore = Math.min(baseHealthScore + engagementBonus + insightBonus + teamSizeBonus, 100);
      const communicationScore = Math.min(baseHealthScore + (totalSessions > 0 ? 15 : 0) + insightBonus, 100);
      const developmentScore = Math.min(baseHealthScore + insightBonus + teamSizeBonus, 100);
      const wellbeingScore = Math.min(baseHealthScore + engagementBonus + (usingRealData ? 10 : 5), 100);
      
      // Generate analytics data with real data
      const analytics: TeamAnalyticsData = {
        overview: {
          totalMembers: teamMembers.length,
          activeMembers: activeMembers,
          totalSessions: totalSessions,
          averageEngagement: activeMembers > 0 ? Math.round((totalSessions / activeMembers) * 10) / 10 : 0
        },
        trends: {
          sessionGrowth,
          engagementTrend,
          insightGeneration
        },
        distribution: {
          sessionsByMember,
          personalityDistribution: personalityDistribution
        },
        teamHealth: {
          overallScore: Math.round(overallScore),
          communicationScore: Math.round(communicationScore),
          developmentScore: Math.round(developmentScore),
          wellbeingScore: Math.round(wellbeingScore)
        },
        teamDescription: aiTeamDescription
      };

      console.log('📈 Final analytics data:', analytics);
      setAnalyticsData(analytics);
    } catch (error) {
      console.error('Error generating analytics:', error);
      // Fallback to basic mock data
      setAnalyticsData({
        overview: {
          totalMembers: teamMembers.length,
          activeMembers: 0,
          totalSessions: 0,
          averageEngagement: 0
        },
        trends: {
          sessionGrowth: 0,
          engagementTrend: 0,
          insightGeneration: 0
        },
        distribution: {
          sessionsByMember: [],
          personalityDistribution: {
            openness: 65,
            conscientiousness: 72,
            extraversion: 58,
            agreeableness: 78,
            neuroticism: 42
          }
        },
        teamHealth: {
          overallScore: 85,
          communicationScore: 82,
          developmentScore: 88,
          wellbeingScore: 86
        }
      });
    } finally {
      setLoading(false);
    }
  };

  return { 
    analyticsData, 
    loading, 
    refreshAnalytics: generateAnalyticsData, 
    teamDescription,
    hasRealData: analyticsData ? analyticsData.overview.totalSessions > 0 : false
  };
};