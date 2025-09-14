import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { Users, Mail, Plus, Calendar, Building2, UserMinus, Trash2, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import InviteMemberModal from '@/components/InviteMemberModal';
import TeamCard from '@/components/ui/TeamCard';

interface TeamMember {
  id: string;
  full_name: string;
  display_name: string;
  avatar_url?: string;
  role: string;
  email: string;
  joinedAt: string;
  membershipId: string;
}

interface Team {
  id: string;
  name: string;
  members: TeamMember[];
  managerId: string;
  managerName: string;
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'declined';
  invited_at: string;
  accepted_at?: string;
  manager_id: string;
}

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

const TeamOverview: React.FC = () => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [userTeams, setUserTeams] = useState<TeamMembership[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (userProfile) {
      fetchTeamData();
      fetchInvitations();
    }
  }, [userProfile]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast({
        title: "Error loading profile",
        description: "Failed to load user profile",
        variant: "destructive",
      });
    }
  };

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      
      if (userProfile?.role === 'manager') {
        // Fetch teams managed by this user
        const { data, error } = await supabase
          .from('team_memberships')
          .select(`
            id,
            employee_id,
            joined_at,
            employee:profiles!team_memberships_employee_id_fkey(
              id, full_name, display_name, avatar_url, role, created_at
            )
          `)
          .eq('manager_id', userProfile.id)
          .order('joined_at', { ascending: false });

        if (error) throw error;
        
        const teamMembers: TeamMember[] = (data || []).map(membership => ({
          id: membership.employee.id,
          full_name: membership.employee.full_name,
          display_name: membership.employee.display_name,
          avatar_url: membership.employee.avatar_url,
          role: membership.employee.role,
          email: '',
          joinedAt: membership.joined_at,
          membershipId: membership.id
        }));

        // Create a single team for now (can be extended for multiple teams later)
        if (teamMembers.length > 0 || userProfile?.team_name) {
          setTeams([{
            id: userProfile.id,
            name: userProfile.team_name || `${userProfile.display_name || userProfile.full_name}'s Team`,
            members: teamMembers,
            managerId: userProfile.id,
            managerName: userProfile.display_name || userProfile.full_name,
            createdAt: userProfile.created_at
          }]);
        }
      } else {
        // Fetch teams the user belongs to
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
        setUserTeams(data || []);
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
      toast({
        title: "Error loading teams",
        description: "Failed to load team data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    if (userProfile?.role !== 'manager') return;

    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('manager_id', userProfile.id)
        .order('invited_at', { ascending: false });

      if (error) throw error;
      setInvitations((data || []) as Invitation[]);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    }
  };

  const handleInviteMember = (email: string, message?: string) => {
    // This will be handled by the InviteMemberModal component
    console.log('Inviting member:', email, message);
    setShowInviteModal(false);
    fetchInvitations(); // Refresh invitations
  };

  const handleRemoveMember = async (membershipId: string, memberName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Team Member',
      description: `Are you sure you want to remove ${memberName} from your team? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('team_memberships')
            .delete()
            .eq('id', membershipId);

          if (error) throw error;

          toast({
            title: "Team member removed",
            description: `${memberName} has been removed from your team`,
          });

          fetchTeamData(); // Refresh team data
        } catch (error: any) {
          console.error('Error removing team member:', error);
          toast({
            title: "Error removing team member",
            description: error.message || "Failed to remove team member",
            variant: "destructive",
          });
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Team',
      description: `Are you sure you want to delete "${teamName}"? All team memberships will be removed and this action cannot be undone.`,
      onConfirm: async () => {
        try {
          // Delete all team memberships for this manager
          const { error } = await supabase
            .from('team_memberships')
            .delete()
            .eq('manager_id', userProfile.id);

          if (error) throw error;

          // Update profile to remove manager role if no members left
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ role: 'employee', team_name: null })
            .eq('id', userProfile.id);

          if (profileError) throw profileError;

          toast({
            title: "Team deleted",
            description: `"${teamName}" has been deleted successfully`,
          });

          setUserProfile(prev => ({ ...prev, role: 'employee', team_name: null }));
          fetchTeamData(); // Refresh team data
        } catch (error: any) {
          console.error('Error deleting team:', error);
          toast({
            title: "Error deleting team",
            description: error.message || "Failed to delete team",
            variant: "destructive",
          });
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleLeaveTeam = async (membershipId: string, teamName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Leave Team',
      description: `Are you sure you want to leave "${teamName}"?`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('team_memberships')
            .delete()
            .eq('id', membershipId);

          if (error) throw error;

          toast({
            title: "Left team",
            description: `You have left "${teamName}"`,
          });

          fetchTeamData(); // Refresh team data
        } catch (error: any) {
          console.error('Error leaving team:', error);
          toast({
            title: "Error leaving team",
            description: error.message || "Failed to leave team",
            variant: "destructive",
          });
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600"><Calendar className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'accepted':
        return <Badge variant="outline" className="text-green-600"><UserPlus className="w-3 h-3 mr-1" />Accepted</Badge>;
      case 'declined':
        return <Badge variant="outline" className="text-red-600"><UserMinus className="w-3 h-3 mr-1" />Declined</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  const isManager = userProfile?.role === 'manager';

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Team Overview</h1>
          <p className="text-muted-foreground">
            {isManager ? 'Manage your teams and members' : 'View the teams you belong to'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
          {isManager && (
            <Button onClick={() => setShowInviteModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          )}
        </div>
      </div>

      {isManager ? (
        /* Manager View */
        <div className="space-y-6">
          {/* My Teams */}
          {teams.length > 0 ? (
            <div className="space-y-4">
              {teams.map((team) => (
                <Card key={team.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          {team.name}
                        </CardTitle>
                        <CardDescription>
                          {team.members.length} team member{team.members.length !== 1 ? 's' : ''}
                        </CardDescription>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteTeam(team.id, team.name)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete Team
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {team.members.length > 0 ? (
                      <div className="space-y-3">
                        {team.members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Users className="h-5 w-5 text-primary" />
                              <div>
                                <p className="font-medium">{member.display_name || member.full_name}</p>
                                <p className="text-sm text-muted-foreground">Role: {member.role}</p>
                                <p className="text-xs text-muted-foreground">
                                  Joined: {new Date(member.joinedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveMember(member.membershipId, member.display_name || member.full_name)}
                            >
                              <UserMinus className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-muted-foreground">No team members yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Invite people to join your team
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No team created yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start by inviting people to join your team
                </p>
                <Button onClick={() => setShowInviteModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Invite First Member
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Invitations</CardTitle>
                <CardDescription>
                  People you have invited to join your team
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invitations.map((invitation) => (
                    <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{invitation.email}</p>
                          <p className="text-sm text-muted-foreground">
                            Sent: {new Date(invitation.invited_at).toLocaleDateString()}
                            {invitation.accepted_at && 
                              ` • Accepted: ${new Date(invitation.accepted_at).toLocaleDateString()}`
                            }
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(invitation.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Member View */
        <div className="space-y-6">
          {userTeams.length > 0 ? (
            <div className="space-y-4">
              {userTeams.map((membership) => {
                const teamName = membership.manager.team_name || 
                  `${membership.manager.display_name || membership.manager.full_name}'s Team`;
                
                return (
                  <TeamCard
                    key={membership.id}
                    teamName={teamName}
                    managerName={membership.manager.display_name || membership.manager.full_name}
                    isEmployee={true}
                    joinedAt={membership.joined_at}
                    onLeaveTeam={() => handleLeaveTeam(membership.id, teamName)}
                  />
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Not part of any team</h3>
                <p className="text-muted-foreground mb-4">
                  Ask your manager to send you an invitation to join their team
                </p>
                <Link to="/dashboard">
                  <Button variant="outline">Back to Dashboard</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Modals */}
      <InviteMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInviteMember}
        managerProfile={userProfile}
      />

      <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamOverview;