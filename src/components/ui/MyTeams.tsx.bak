import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Users, Building } from 'lucide-react';
import TeamCard from './TeamCard';

interface TeamMembership {
  id: string;
  employee_id: string;
  manager_id: string;
  joined_at: string;
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

const MyTeams: React.FC<MyTeamsProps> = ({ userProfile, className = "" }) => {
  const { user } = useAuth();
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
      
      const { data, error } = await supabase
        .from('team_memberships')
        .select(`
          id,
          employee_id,
          manager_id,
          joined_at,
          manager:profiles!team_memberships_manager_id_fkey(
            id, full_name, display_name, team_name
          )
        `)
        .eq('employee_id', userProfile.id)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast({
        title: "Error loading teams",
        description: "Failed to load your team memberships",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveTeam = async (managerId: string, teamName: string) => {
    try {
      const { error } = await supabase.functions.invoke('leave-team', {
        body: { managerId }
      });

      if (error) {
        console.error('Error leaving team:', error);
        toast({
          title: "Error leaving team",
          description: error.message || "Failed to leave team",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Left team",
        description: `You have successfully left ${teamName}`,
      });

      // Refresh teams list
      fetchMyTeams();
    } catch (error: any) {
      console.error('Error leaving team:', error);
      toast({
        title: "Error leaving team",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5 text-primary" />
          My Teams ({teams.length})
        </CardTitle>
        <CardDescription>
          Teams you are a member of
        </CardDescription>
      </CardHeader>
      <CardContent>
        {teams.length === 0 ? (
          <div className="text-center py-8">
            <Building className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No team memberships</p>
            <p className="text-sm text-muted-foreground mt-1">
              You're not part of any teams yet. Ask your manager to send you an invitation.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {teams.map((membership) => {
              const teamName = membership.manager.team_name || 
                `${membership.manager.display_name || membership.manager.full_name}'s Team`;
              
              return (
                <TeamCard
                  key={membership.id}
                  teamName={teamName}
                  managerName={membership.manager.display_name || membership.manager.full_name}
                  isEmployee={true}
                  joinedAt={membership.joined_at}
                  onLeaveTeam={() => handleLeaveTeam(membership.manager_id, teamName)}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MyTeams;