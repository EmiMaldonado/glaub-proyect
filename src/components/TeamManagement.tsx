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
import { Users, Mail, Clock, CheckCircle, XCircle, Plus, UserMinus, Shield } from 'lucide-react';
import { useAutoConfig } from '@/hooks/useAutoConfig';
import TeamLimitsIndicator from './TeamLimitsIndicator';

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
}

interface TeamManagementProps {
  userProfile: any;
}

const TeamManagement: React.FC<TeamManagementProps> = ({ userProfile }) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [fetchingData, setFetchingData] = useState(true);
  const { teamLimits, validateTeamLimits, loadTeamLimits } = useAutoConfig(userProfile?.id);

  const isManager = userProfile?.role === 'manager';

  useEffect(() => {
    if (user && userProfile) {
      fetchInvitations();
      fetchTeamMembers();
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

  const fetchTeamMembers = async () => {
    try {
      setFetchingData(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('manager_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
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

    // Validate team limits before sending invitation
    if (!validateTeamLimits('invite')) {
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
        description: `Invitation email sent to ${email}. They will receive instructions to join your team.`,
      });

      setEmail('');
      fetchInvitations(); // Refresh invitations list
      await loadTeamLimits();
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

  const removeTeamMember = async (memberId: string, memberName: string) => {
    if (!isManager) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ manager_id: null })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: "Team Member Removed",
        description: `${memberName} has been removed from your team`,
      });

      fetchTeamMembers(); // Refresh team members list
      await loadTeamLimits();
    } catch (error: any) {
      console.error('Error removing team member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove team member",
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

  // Show team building section for non-managers with no team
  if (!isManager && teamMembers.length === 0 && invitations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Build Your Team
          </CardTitle>
          <CardDescription>
            Invite team members to unlock management features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-email">Team member email</Label>
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
                {loading ? 'Creating...' : 'Create Invite Link'}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Create a shareable invitation link that will be copied to your clipboard. Share it with the person you want to add to your team.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Unified team management view
  return (
    <div className="space-y-6">
      {/* Team Limits Indicator */}
      <TeamLimitsIndicator
        currentMembers={teamLimits.currentMembers}
        maxMembers={teamLimits.maxMembers}
        currentTeams={teamLimits.currentTeams}
        maxTeams={teamLimits.maxTeams}
        userRole={userProfile?.role}
      />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Management
          </CardTitle>
          <CardDescription>
            Manage your team members and invitations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Team Members */}
          {teamMembers.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <h3 className="text-lg font-semibold">Team Members ({teamMembers.length})</h3>
              </div>
              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{member.display_name || member.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {member.role} • Joined {new Date(member.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {isManager && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeTeamMember(member.id, member.display_name || member.full_name)}
                        className="text-destructive hover:text-destructive"
                      >
                        <UserMinus className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Separator if both sections exist */}
          {teamMembers.length > 0 && invitations.length > 0 && <Separator />}

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <h3 className="text-lg font-semibold">Pending Invitations ({invitations.filter(i => i.status === 'pending').length})</h3>
              </div>
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
            </div>
          )}

          {/* Separator before invite section */}
          {(teamMembers.length > 0 || invitations.length > 0) && <Separator />}

          {/* Invite New Member Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-semibold">Invite New Member</h3>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-member-email">Email address</Label>
              <div className="flex gap-2">
                <Input
                  id="new-member-email"
                  type="email"
                  placeholder="example@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendInvitation()}
                />
                <Button 
                  onClick={sendInvitation} 
                  disabled={loading || !teamLimits.canInviteMore}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {loading ? 'Sending...' : !teamLimits.canInviteMore ? 'Team Full' : 'Send Invitation'}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              An invitation email will be sent with instructions to join your team.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamManagement;