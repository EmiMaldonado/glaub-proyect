import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Users, Building, Plus } from 'lucide-react';
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
  const [managerEmail, setManagerEmail] = useState('');
  const [isInvitingManager, setIsInvitingManager] = useState(false);
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

  const handleSendTeamRequest = async () => {
    if (!managerEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter a manager's email address",
        variant: "destructive"
      });
      return;
    }

    if (managerEmail === user?.email) {
      toast({
        title: "Invalid email",
        description: "You cannot send a team request to yourself",
        variant: "destructive"
      });
      return;
    }

    setIsInvitingManager(true);
    try {
      const { data, error } = await supabase.functions.invoke('unified-invitation', {
        body: {
          email: managerEmail,
          invitationType: 'manager_request'
        }
      });

      if (error) {
        console.error('Error sending team request:', error);
        toast({
          title: "Error sending request",
          description: error.message || "Failed to send team request",
          variant: "destructive"
        });
        return;
      }

      if (data?.success) {
        toast({
          title: "Request sent successfully",
          description: `Team join request sent to ${managerEmail}`
        });
        setManagerEmail('');
      } else {
        toast({
          title: "Error sending request",
          description: data?.error || "Failed to send team request",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Error sending team request:', error);
      toast({
        title: "Error sending request",
        description: error.message || "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsInvitingManager(false);
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
          <Users className="h-5 w-5 text-primary" />
          Your Teams
        </CardTitle>
        <CardDescription>
          Manage your team memberships and invitations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Send a join request to a manager */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-foreground">
            <Plus className="h-4 w-4" />
            <span className="font-medium">Send a join request to a manager</span>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label htmlFor="manager-email" className="text-sm text-muted-foreground">
                Manager's email
              </Label>
              <Input 
                id="manager-email"
                type="email" 
                placeholder="manager@company.com" 
                value={managerEmail} 
                onChange={(e) => setManagerEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button 
              onClick={handleSendTeamRequest} 
              disabled={isInvitingManager} 
              className="w-full"
            >
              {isInvitingManager ? "Sending Request..." : "Send Team Request"}
            </Button>
          </div>
        </div>
        {teams.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Current Team Memberships ({teams.length})</h3>
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
                  <div key={membership.id} className="p-3 bg-blue-50/30 border rounded-lg hover:shadow-sm transition-shadow">
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