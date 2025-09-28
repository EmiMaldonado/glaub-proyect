import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Users, Building } from 'lucide-react';
import TeamCard from './TeamCard';
import SharingPreferences from '@/components/SharingPreferences';
interface TeamMembership {
  id: string;
  team_id: string;
  member_id: string;
  role: string;
  joined_at: string;
  memberCount: number;
  manager: {
    id: string;
    full_name: string;
    display_name: string;
    team_name?: string;
  };
}
interface MyTeamsProps {
  userProfile: any;
  className?: string;
}
const MyTeams: React.FC<MyTeamsProps> = ({
  userProfile,
  className = ""
}) => {
  const {
    user
  } = useAuth();
  const [teams, setTeams] = useState<TeamMembership[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (user && userProfile) {
      fetchMyTeams();
    }
  }, [user, userProfile]);
  const fetchMyTeams = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching teams for user profile:', userProfile.id);
      
      const {
        data,
        error
      } = await supabase.from('team_members').select(`
          id,
          team_id,
          member_id,
          role,
          joined_at
        `).eq('member_id', userProfile.id).eq('role', 'employee').order('joined_at', {
        ascending: false
      });
      
      if (error) {
        console.error('❌ Error fetching team memberships:', error);
        throw error;
      }

      console.log('✅ Found team memberships:', data?.length || 0, data);

      // Get manager details and team member count separately
      const teamsWithManagers = await Promise.all((data || []).map(async membership => {
        console.log('🔍 Processing membership:', membership.id, 'for team:', membership.team_id);
        
        const [managerResult, memberCountResult] = await Promise.all([
          supabase.from('profiles').select('id, full_name, display_name, team_name').eq('id', membership.team_id).maybeSingle(),
          supabase.from('team_members').select('id', { count: 'exact' }).eq('team_id', membership.team_id)
        ]);
        
        if (managerResult.error) {
          console.error('❌ Error fetching manager:', managerResult.error);
        }
        if (memberCountResult.error) {
          console.error('❌ Error fetching member count:', memberCountResult.error);
        }

        console.log('👤 Manager data:', managerResult.data);
        console.log('📊 Member count:', memberCountResult.count);
        
        return {
          ...membership,
          manager: managerResult.data,
          memberCount: memberCountResult.count || 0
        };
      }));
      
      console.log('✅ Final teams with managers:', teamsWithManagers);
      setTeams(teamsWithManagers);
    } catch (error) {
      console.error('💥 Error fetching teams:', error);
      toast({
        title: "Error loading teams",
        description: "Failed to load your team memberships",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleLeaveTeam = async (managerId: string, teamName: string) => {
    try {
      const {
        error
      } = await supabase.functions.invoke('leave-team', {
        body: {
          managerId
        }
      });
      if (error) {
        console.error('Error leaving team:', error);
        toast({
          title: "Error leaving team",
          description: error.message || "Failed to leave team",
          variant: "destructive"
        });
        return;
      }
      toast({
        title: "Left team",
        description: `You have successfully left ${teamName}`
      });

      // Refresh teams list
      fetchMyTeams();
    } catch (error: any) {
      console.error('Error leaving team:', error);
      toast({
        title: "Error leaving team",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };
  if (loading) {
    return <Card className={className}>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>;
  }
  return <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5 text-primary" />
          Teams you are member ({teams.length})
        </CardTitle>
        
      </CardHeader>
      <CardContent className="space-y-6">
        {teams.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Your Teams</h3>
            <div className="space-y-3">
              {teams.map(membership => {
                // Handle null manager (orphaned team membership)
                if (!membership.manager) {
                  console.warn('⚠️ Orphaned team membership found:', membership.id, 'for team:', membership.team_id);
                  return (
                    <div key={membership.id} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-800">Unknown Team</span>
                      </div>
                      <p className="text-xs text-yellow-700 mb-3">
                        This team membership exists but the manager profile is missing.
                      </p>
                      <button
                        onClick={() => handleLeaveTeam(membership.team_id, "Unknown Team")}
                        className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-1 rounded transition-colors"
                      >
                        Remove Membership
                      </button>
                    </div>
                  );
                }
                
                const teamName = membership.manager.team_name || `${membership.manager.display_name || membership.manager.full_name}'s Team`;
                const managerName = membership.manager.display_name || membership.manager.full_name;
                const memberCount = membership.memberCount;
                
                return (
                  <div key={membership.id} className="p-3 bg-card border rounded-lg hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">
                            {teamName} - {managerName} - {memberCount} team member{memberCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleLeaveTeam(membership.team_id, teamName)}
                        className="ml-4 px-2 py-1 text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 rounded transition-colors"
                      >
                        Leave Team
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Privacy & Sharing Settings</h3>
          <SharingPreferences userProfile={userProfile} />
        </div>
      </CardContent>
    </Card>;
};
export default MyTeams;