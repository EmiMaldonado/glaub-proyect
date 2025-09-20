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
import OceanPersonalitySection from './OceanPersonalitySection';
import TeamResultsSection from './TeamResultsSection';

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
  const { analyticsData, loading: analyticsLoading, teamDescription } = useTeamAnalytics(
    managerProfile?.id || '', 
    teamMembers
  );

  // Team recommendations hook
  const { data: recommendationsData, loading: recommendationsLoading, generateRecommendations, clearCache } = useTeamRecommendations();

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
    loadManagerData();
  };

  const handleRefreshRecommendations = () => {
    if (managerProfile) {
      clearCache(managerProfile.id).then(() => {
        generateRecommendations(managerProfile.id, teamMembers);
      });
    }
  };

  const getTeamDescription = () => {
    if (!analyticsData || teamMembers.length === 0) {
      return "Add team members to generate personality insights and team analysis.";
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
              analyticsData?.distribution.personalityDistribution || {
                openness: 0,
                conscientiousness: 0,
                extraversion: 0,
                agreeableness: 0,
                neuroticism: 0,
              }
            }
            teamDescription={getTeamDescription()}
            loading={analyticsLoading}
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
        teamStrengths={
          recommendationsData?.teamAnalysis.strengths.map(strength => ({
            title: strength,
            description: "Team demonstrates consistent performance in this area"
          })) || [
            { title: "Collaborative Communication", description: "Team members effectively share ideas and feedback" },
            { title: "Goal-Oriented Focus", description: "Strong alignment on objectives and deliverables" },
            { title: "Adaptability", description: "Flexible approach to changing requirements" }
          ]
        }
        recommendations={recommendationsData?.recommendations || []}
        onMemberSelect={setSelectedMember}
        loading={recommendationsLoading}
        onRefresh={handleRefreshRecommendations}
      />
    </div>
  );
};

export default ModernManagerDashboard;