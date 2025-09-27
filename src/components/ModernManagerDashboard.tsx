import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  Users, 
  MessageCircle, 
  Plus
} from 'lucide-react';
import DashboardBreadcrumbs from "@/components/DashboardBreadcrumbs";
import DashboardViewSwitch from "@/components/DashboardViewSwitch";
import ManageTeamSection from './ManageTeamSection';
import { useTeamAnalytics } from '@/hooks/useTeamAnalytics';
import { useTeamRecommendations } from '@/hooks/useTeamRecommendations';
import { useTeamDataCache } from '@/hooks/useTeamDataCache';
import OceanPersonalitySection from './OceanPersonalitySection';
import TeamResultsSection from './TeamResultsSection';
// Al principio del archivo, agregar el import
import InvitationDebugger from './InvitationDebugger';

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string;
  email: string;
  role: string;
  created_at: string;
}

interface ManagerProfile {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string;
  email: string;
  role: string;
  team_name: string;
}

const ModernManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [managerProfile, setManagerProfile] = useState<ManagerProfile | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  
  // Team analytics hook
  const { analyticsData, loading: analyticsLoading, teamDescription, refreshAnalytics, hasRealData } = useTeamAnalytics(
    managerProfile?.id || '', 
    teamMembers
  );

  // Team recommendations hook
  const { data: recommendationsData, loading: recommendationsLoading, generateRecommendations, clearCache } = useTeamRecommendations();

  // Cache hooks for personality and team results data
  const personalityCacheKey = `personality-${managerProfile?.id || ''}`;
  const teamResultsCacheKey = `team-results-${managerProfile?.id || ''}`;
  
  const {
    cachedData: personalityCache,
    isStale: personalityCacheStale,
    setCacheData: setPersonalityCache,
    invalidateCache: invalidatePersonalityCache,
    isCacheValid: isPersonalityCacheValid
  } = useTeamDataCache({
    managerId: managerProfile?.id || '',
    teamMembers,
    cacheKey: personalityCacheKey,
    ttl: 30 * 60 * 1000 // 30 minutes
  });

  const {
    cachedData: teamResultsCache,
    isStale: teamResultsCacheStale,
    setCacheData: setTeamResultsCache,
    invalidateCache: invalidateTeamResultsCache,
    isCacheValid: isTeamResultsCacheValid
  } = useTeamDataCache({
    managerId: managerProfile?.id || '',
    teamMembers,
    cacheKey: teamResultsCacheKey,
    ttl: 30 * 60 * 1000 // 30 minutes
  });

  useEffect(() => {
    if (user) {
      loadManagerData();
    }
  }, [user]);

  useEffect(() => {
    if (managerProfile && teamMembers.length > 0) {
      generateRecommendations(managerProfile.id, teamMembers);
    }
  }, [managerProfile, teamMembers, generateRecommendations]);

  // Cache personality data when analytics data changes
  useEffect(() => {
    if (analyticsData && teamDescription && managerProfile && !isPersonalityCacheValid) {
      setPersonalityCache(personalityCacheKey, {
        personalityData: analyticsData.distribution.personalityDistribution,
        teamDescription,
        teamStrengths: getPersonalizedTeamStrengths(),
        recommendations: getPersonalizedRecommendations(),
        analyticsData
      });
    }
  }, [analyticsData, teamDescription, managerProfile, isPersonalityCacheValid, personalityCacheKey, setPersonalityCache]);

  // Cache team results data when recommendations data changes
  useEffect(() => {
    if (recommendationsData && analyticsData && managerProfile && !isTeamResultsCacheValid) {
      setTeamResultsCache(teamResultsCacheKey, {
        personalityData: analyticsData.distribution.personalityDistribution,
        teamDescription: teamDescription || '',
        teamStrengths: getPersonalizedTeamStrengths(),
        recommendations: recommendationsData.recommendations || getPersonalizedRecommendations(),
        analyticsData
      });
    }
  }, [recommendationsData, analyticsData, teamDescription, managerProfile, isTeamResultsCacheValid, teamResultsCacheKey, setTeamResultsCache]);

  const loadManagerData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load manager profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      if (profile.role !== 'manager') {
        toast({
          title: "Access Denied",
          description: "Only managers can access this dashboard",
          variant: "destructive"
        });
        return;
      }

      setManagerProfile(profile);

      // Load team members using the team_members table
      const { data: teamMemberData, error: membersError } = await supabase
        .from('team_members')
        .select(`
          *,
          member:profiles!team_members_member_id_fkey(
            id,
            user_id,
            full_name,
            display_name,
            email,
            role,
            created_at
          )
        `)
        .eq('team_id', profile.id)
        .eq('role', 'employee')
        .order('joined_at', { ascending: false });

      if (membersError) throw membersError;

      // Extract member profiles from the join
      const members = (teamMemberData || [])
        .map(tm => tm.member)
        .filter(member => member !== null);

      setTeamMembers(members || []);

    } catch (error: any) {
      console.error('Error loading manager data:', error);
      toast({
        title: "Error Loading Dashboard",
        description: error.message || "Failed to load manager dashboard",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTeamUpdate = () => {
    // Invalidate caches when team changes
    invalidatePersonalityCache();
    invalidateTeamResultsCache();
    loadManagerData();
  };

  const handleRefreshRecommendations = () => {
    if (managerProfile) {
      // Clear recommendation cache and invalidate team results cache
      clearCache(managerProfile.id).then(() => {
        invalidateTeamResultsCache();
        generateRecommendations(managerProfile.id, teamMembers);
      });
    }
  };

  const handleRefreshAnalytics = () => {
    // Invalidate personality cache and refresh analytics
    invalidatePersonalityCache();
    refreshAnalytics();
  };

  const getTeamDescription = () => {
    // Use cached data if available and valid
    if (isPersonalityCacheValid && personalityCache?.teamDescription) {
      return personalityCache.teamDescription;
    }
    
    // No team members case
    if (teamMembers.length === 0) {
      return "Add team members to generate personality insights and team analysis.";
    }
    
    // Team members exist but no analytics data (no conversations yet)
    if (!analyticsData) {
      return "None of your team members has any information yet. Please ask for start conversations.";
    }
    
    // Use AI-generated team description from analytics hook (primary source)
    if (teamDescription && teamDescription.trim()) {
      return teamDescription;
    }
    
    // Secondary: Use AI-generated team description from recommendations if available
    if (recommendationsData?.oceanDescription) {
      return recommendationsData.oceanDescription;
    }
    
    // Fallback to basic description while AI generates content
    return `Your team shows a balanced personality profile with strong ${
      analyticsData.distribution.personalityDistribution.conscientiousness > 70 ? 'conscientiousness' : 
      analyticsData.distribution.personalityDistribution.openness > 70 ? 'openness' : 
      analyticsData.distribution.personalityDistribution.agreeableness > 70 ? 'collaboration' : 'diversity'
    }. The team has completed ${analyticsData.overview.totalSessions} sessions with ${analyticsData.overview.activeMembers} active members.`;
  };

  const getPersonalizedTeamStrengths = () => {
    // Use cached data if available and valid
    if (isTeamResultsCacheValid && teamResultsCache?.teamStrengths) {
      return teamResultsCache.teamStrengths;
    }
    
    if (!analyticsData) return [];

    const strengths = [];
    const personality = analyticsData.distribution.personalityDistribution;
    const sessions = analyticsData.overview.totalSessions;
    const teamHealth = analyticsData.teamHealth;

    // Based on OCEAN personality data
    if (personality.conscientiousness > 65) {
      strengths.push({
        title: "High Conscientiousness",
        description: `Team shows strong organizational skills and reliability with ${personality.conscientiousness}% conscientiousness score`
      });
    }

    if (personality.agreeableness > 70) {
      strengths.push({
        title: "Collaborative Team Spirit", 
        description: `Excellent teamwork and cooperation with ${personality.agreeableness}% agreeableness rating`
      });
    }

    if (personality.openness > 60) {
      strengths.push({
        title: "Innovation & Adaptability",
        description: `Team demonstrates creative thinking and openness to new ideas (${personality.openness}% openness)`
      });
    }

    // Based on activity data
    if (sessions > 20) {
      strengths.push({
        title: "Active Engagement",
        description: `Strong participation with ${sessions} completed sessions showing consistent involvement`
      });
    }

    if (teamHealth.communicationScore > 85) {
      strengths.push({
        title: "Effective Communication",
        description: `Excellent communication patterns with ${teamHealth.communicationScore}% health score`
      });
    }

    // Fallback strengths
    if (strengths.length === 0) {
      strengths.push(
        { title: "Growing Team", description: "Team is actively building foundation and establishing collaboration patterns" },
        { title: "Learning-Oriented", description: "Focus on development and skill building through ongoing sessions" }
      );
    }

    return strengths.slice(0, 4); // Limit to 4 strengths
  };

  const getPersonalizedRecommendations = () => {
    // Use cached data if available and valid
    if (isTeamResultsCacheValid && teamResultsCache?.recommendations) {
      return teamResultsCache.recommendations;
    }
    
    if (!analyticsData) return [];

    const recommendations = [];
    const personality = analyticsData.distribution.personalityDistribution;
    const sessions = analyticsData.overview.totalSessions;

    if (personality.extraversion < 50) {
      recommendations.push({
        title: "Foster Team Interaction",
        description: "Consider organizing structured team activities to encourage more social interaction and collaboration",
        priority: 'medium' as const,
        category: 'communication'
      });
    }

    if (personality.neuroticism > 60) {
      recommendations.push({
        title: "Stress Management Support",
        description: "Implement wellness initiatives and provide support for managing work-related stress",
        priority: 'high' as const,
        category: 'wellbeing'
      });
    }

    if (sessions < 10) {
      recommendations.push({
        title: "Increase Team Engagement",
        description: "Encourage more frequent team sessions to build stronger collaboration patterns",
        priority: 'high' as const,
        category: 'productivity'
      });
    }

    if (personality.conscientiousness < 60) {
      recommendations.push({
        title: "Structure & Organization",
        description: "Implement clearer processes and frameworks to support team organization and accountability",
        priority: 'medium' as const,
        category: 'productivity'
      });
    }

    return recommendations.slice(0, 3); // Limit to 3 recommendations
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading manager dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!managerProfile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">Manager profile not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <DashboardBreadcrumbs />
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Welcome to {managerProfile.team_name || `${managerProfile.display_name || managerProfile.full_name}'s Team`} Dashboard
              </h1>
              <p className="text-lg text-muted-foreground">
                Team usage: {analyticsData?.overview.totalSessions || 0} sessions • {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DashboardViewSwitch />
          </div>
        </div>
      </div>

      {/* Main Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Left Column - OCEAN Personality (70%) */}
        <div className="lg:col-span-7">
          <OceanPersonalitySection
            personalityData={
              isPersonalityCacheValid && personalityCache?.personalityData 
                ? personalityCache.personalityData
                : analyticsData?.distribution.personalityDistribution || {
                    openness: 0,
                    conscientiousness: 0,
                    extraversion: 0,
                    agreeableness: 0,
                    neuroticism: 0,
                  }
            }
            teamDescription={getTeamDescription()}
            loading={analyticsLoading && !isPersonalityCacheValid}
            onRefresh={handleRefreshAnalytics}
            hasRealData={hasRealData}
            cacheStatus={isPersonalityCacheValid ? 'cached' : 'fresh'}
          />
        </div>

        {/* Right Column - Manage Team (30%) */}
        <div className="lg:col-span-3">
          <ManageTeamSection
            managerProfile={managerProfile}
            teamMembers={teamMembers}
            onTeamUpdate={handleTeamUpdate}
          />
        </div>
      </div>

      {/* Team Results Section */}
      <TeamResultsSection
        teamMembers={teamMembers}
        selectedMember={selectedMember}
        teamStrengths={getPersonalizedTeamStrengths()}
        recommendations={
          isTeamResultsCacheValid && teamResultsCache?.recommendations 
            ? teamResultsCache.recommendations 
            : recommendationsData?.recommendations || getPersonalizedRecommendations()
        }
        onMemberSelect={setSelectedMember}
        loading={recommendationsLoading && !isTeamResultsCacheValid}
        onRefresh={handleRefreshRecommendations}
        analyticsData={
          isTeamResultsCacheValid && teamResultsCache?.analyticsData 
            ? teamResultsCache.analyticsData 
            : analyticsData
        }
        teamDescription={teamDescription}
        cacheStatus={isTeamResultsCacheValid ? 'cached' : 'fresh'}
      />

      {/* Development debugging removed for now */}
    </div>
  );
};

export default ModernManagerDashboard;
