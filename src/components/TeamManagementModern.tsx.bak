import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Users, Mail, Clock, CheckCircle, XCircle, Plus, Edit2, Save, X, LogOut } from 'lucide-react';

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

interface Invitation {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'revoked';
  invited_at: string;
  accepted_at?: string;
}

interface TeamMember {
  id: string;
  full_name: string;
  display_name: string;
  avatar_url?: string;
  role: string;
  created_at: string;
  membershipId?: string;
}

interface TeamManagementModernProps {
  userProfile: any;
}

const TeamManagementModern: React.FC<TeamManagementModernProps> = ({ userProfile }) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [userTeams, setUserTeams] = useState<TeamMembership[]>([]);
  const [fetchingData, setFetchingData] = useState(true);
  const [editingTeamName, setEditingTeamName] = useState(false);
  const [newTeamName, setNewTeamName] = useState(userProfile?.team_name || '');

  const isManager = userProfile?.role === 'manager';

  useEffect(() => {
    if (user && userProfile) {
      fetchInvitations();
      fetchTeamData();
    }
  }, [user, userProfile]);

  const fetchInvitations = async () => {
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

  const fetchTeamData = async () => {
    try {
      setFetchingData(true);
      
      if (isManager) {
        // Fetch team members for managers
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
        
        const members = (data || []).map(membership => ({
          id: membership.employee.id,
          full_name: membership.employee.full_name,
          display_name: membership.employee.display_name,
          avatar_url: membership.employee.avatar_url,
          role: membership.employee.role,
          created_at: membership.employee.created_at,
          membershipId: membership.id
        }));
        
        setTeamMembers(members);
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
    } finally {
      setFetchingData(false);
    }
  };

  const sendInvitation = async () => {
    if (!email.trim() || !userProfile) {
      toast({
        title: "Email required",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Sending invitation for:', email);
      
      // Call the invite-manager edge function to send email
      const { data, error } = await supabase.functions.invoke('invite-manager', {
        body: { managerEmail: email.trim() }
      });

      if (error) {
        console.error('Error sending invitation:', error);
        toast({
          title: "Error sending invitation",
          description: error.message || "Failed to send invitation email",
          variant: "destructive",
        });
        return;
      }

      console.log('Invitation sent successfully:', data);

      toast({
        title: "Invitation Sent!",
        description: `Invitation email sent to ${email}. They will receive instructions to join ${userProfile.team_name || 'your team'}.`,
      });

      setEmail('');
      fetchInvitations(); // Refresh invitations list
    } catch (error: any) {
      console.error('Error in sendInvitation:', error);
      toast({
        title: "Error creating invitation",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateTeamName = async () => {
    if (!newTeamName.trim()) {
      toast({
        title: "Team name required",
        description: "Please enter a team name",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_name: newTeamName.trim() })
        .eq('id', userProfile.id);

      if (error) throw error;

      toast({
        title: "Team name updated",
        description: `Team name changed to "${newTeamName.trim()}"`,
      });

      setEditingTeamName(false);
      
      // Update local state
      userProfile.team_name = newTeamName.trim();
    } catch (error: any) {
      console.error('Error updating team name:', error);
      toast({
        title: "Error updating team name",
        description: error.message || "Failed to update team name",
        variant: "destructive",
      });
    }
  };

  const removeTeamMember = async (membershipId: string, memberName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from your team?`)) {
      return;
    }

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
  };

  const leaveTeam = async (membershipId: string, teamName: string) => {
    if (!window.confirm(`Are you sure you want to leave ${teamName}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('team_memberships')
        .delete()
        .eq('id', membershipId);

      if (error) throw error;

      toast({
        title: "Left team",
        description: `You have left ${teamName}`,
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
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-warning"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'accepted':
        return <Badge variant="outline" className="text-success"><CheckCircle className="w-3 h-3 mr-1" />Accepted</Badge>;
      case 'revoked':
        return <Badge variant="outline" className="text-destructive"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Employee view - show teams they belong to
  if (!isManager) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Your Teams
            </CardTitle>
            <CardDescription>
              Teams you are a member of
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fetchingData ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : userTeams.length > 0 ? (
              <div className="space-y-3">
                {userTeams.map((membership) => (
                  <div key={membership.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">
                          {membership.manager.team_name || `${membership.manager.display_name || membership.manager.full_name}'s Team`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Manager: {membership.manager.display_name || membership.manager.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Joined on {new Date(membership.joined_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => leaveTeam(membership.id, membership.manager.team_name || `${membership.manager.display_name || membership.manager.full_name}'s Team`)}
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      Leave Team
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">You're not part of any teams yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ask your manager to send you an invitation
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Manager view
  return (
    <div className="space-y-6">
      {/* Team Name Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {userProfile?.team_name || 'Your Team'}
          </CardTitle>
          <CardDescription>
            Manage your team name and members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label>Team Name:</Label>
              {editingTeamName ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Enter team name"
                  />
                  <Button size="sm" onClick={updateTeamName}>
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingTeamName(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {userProfile?.team_name || `${userProfile?.display_name || userProfile?.full_name}'s Team`}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setEditingTeamName(true)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members ({teamMembers.length})
            </span>
          </CardTitle>
          <CardDescription>
            Current members of your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetchingData ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : teamMembers.length > 0 ? (
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{member.display_name || member.full_name}</p>
                      <p className="text-sm text-muted-foreground">Role: {member.role}</p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeTeamMember(member.membershipId, member.display_name || member.full_name)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No team members yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite New Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Invite New Team Member
          </CardTitle>
          <CardDescription>
            Send an invitation to add someone to your team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-email">Email address</Label>
            <div className="flex gap-2">
              <Input
                id="team-email"
                type="email"
                placeholder="example@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendInvitation()}
              />
              <Button onClick={sendInvitation} disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                {loading ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invitations Status */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Team Member Invitations</CardTitle>
            <CardDescription>
              Invitations sent to join your team as team members
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
                        Sent on {new Date(invitation.invited_at).toLocaleDateString()}
                        {invitation.accepted_at && 
                          ` • Accepted on ${new Date(invitation.accepted_at).toLocaleDateString()}`
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
  );
};

export default TeamManagementModern;