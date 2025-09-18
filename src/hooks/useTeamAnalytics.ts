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
}

export const useTeamAnalytics = (managerId: string, teamMembers: TeamMember[]) => {
  const [analyticsData, setAnalyticsData] = useState<TeamAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateAnalyticsData();
  }, [managerId, teamMembers]);

  const generateAnalyticsData = async () => {
    setLoading(true);
    
    try {
      // Get conversations count for team members
      const teamUserIds = teamMembers.map(member => member.user_id);
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, user_id, status')
        .in('user_id', teamUserIds);

      // Get insights count for team members
      const { data: insights } = await supabase
        .from('key_insights')
        .select('id, conversation_id')
        .in('conversation_id', conversations?.map(c => c.id) || []);

      // Calculate analytics based on actual data
      const totalSessions = conversations?.length || 0;
      const totalInsights = insights?.length || 0;
      const activeMembers = new Set(conversations?.map(c => c.user_id)).size;
      
      // Generate mock data based on real counts for better demonstration
      const analytics: TeamAnalyticsData = {
        overview: {
          totalMembers: teamMembers.length,
          activeMembers: activeMembers,
          totalSessions: totalSessions,
          averageEngagement: activeMembers > 0 ? Math.round((totalSessions / activeMembers) * 10) / 10 : 0
        },
        trends: {
          sessionGrowth: totalSessions > 0 ? Math.round(Math.random() * 20 + 5) : 0,
          engagementTrend: activeMembers > 0 ? Math.round(Math.random() * 15 + 8) : 0,
          insightGeneration: totalInsights > 0 ? Math.round(Math.random() * 25 + 10) : 0
        },
        distribution: {
          sessionsByMember: teamMembers.map(member => ({
            name: member.display_name || member.full_name,
            sessions: Math.floor(Math.random() * 10) + 1
          })),
          personalityDistribution: {
            openness: Math.round(Math.random() * 30 + 60),
            conscientiousness: Math.round(Math.random() * 25 + 70),
            extraversion: Math.round(Math.random() * 40 + 40),
            agreeableness: Math.round(Math.random() * 20 + 75),
            neuroticism: Math.round(Math.random() * 35 + 25)
          }
        },
        teamHealth: {
          overallScore: Math.round(Math.random() * 15 + 80),
          communicationScore: Math.round(Math.random() * 20 + 75),
          developmentScore: Math.round(Math.random() * 25 + 70),
          wellbeingScore: Math.round(Math.random() * 18 + 78)
        }
      };

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

  return { analyticsData, loading, refreshAnalytics: generateAnalyticsData };
};