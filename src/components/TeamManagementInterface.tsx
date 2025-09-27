import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { 
  Users, 
  Mail, 
  Plus, 
  UserMinus, 
  Settings2, 
  Clock,
  CheckCircle,
  XCircle,
  Send,
  AlertCircle
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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

interface Invitation {
  id: string;
  email: string;
  status: string;
  invited_at: string;
  expires_at: string;
  invitation_type?: string;
  token?: string;
}

interface TeamManagementInterfaceProps {
  managerProfile: ManagerProfile;
  teamMembers: TeamMember[];
  onTeamUpdate: () => void;
}

const TeamManagementInterface: React.FC<TeamManagementInterfaceProps> = ({
  managerProfile,
  teamMembers,
  onTeamUpdate
}) => {
  const [teamName, setTeamName] = useState(managerProfile.team_name || '');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [receivedInvitations, setReceivedInvitations] = useState<Invitation[]>([]);
  const [teamJoinInvitations, setTeamJoinInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [updatingName, setUpdatingName] = useState(false);

  useEffect(() => {
    loadInvitations();
    loadReceivedInvitations();
    loadTeamJoinInvitations();
  }, [managerProfile.id]);

  const loadInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('manager_id', managerProfile.id)
        .order('invited_at', { ascending: false });

      if (error) throw error;

      setInvitations(data || []);
    } catch (error: any) {
      console.error('Error loading invitations:', error);
    }
  };

  const loadReceivedInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('email', managerProfile.email)
        .eq('status', 'pending')
        .eq('invitation_type', 'manager_request');
      
      if (error) throw error;
      setReceivedInvitations(data || []);
      console.log('Received invitations for', managerProfile.email, ':', data);
    } catch (error: any) {
      console.error('Error loading received invitations:', error);
    }
  };

  const loadTeamJoinInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('email', managerProfile.email)
        .eq('status', 'pending')
        .eq('invitation_type', 'team_join');
      
      if (error) throw error;
      setTeamJoinInvitations(data || []);
      console.log('Team join invitations for', managerProfile.email, ':', data);
    } catch (error: any) {
      console.error('Error loading team join invitations:', error);
    }
  };

  const handleAcceptManagerRequest = async (invitation: Invitation) => {
    try {
      const { data, error } = await supabase.functions.invoke('unified-accept-invitation', {
        body: { 
          token: invitation.token,
          action: 'accept'
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to accept manager request');
      }

      toast({
        title: "Manager request accepted!",
        description: "You are now managing this team member",
      });

      loadReceivedInvitations();
      onTeamUpdate();
    } catch (error: any) {
      console.error('Error accepting manager request:', error);
      toast({
        title: "Error accepting request",
        description: error.message || "Failed to accept manager request",
        variant: "destructive"
      });
    }
  };

  const handleDeclineManagerRequest = async (invitation: Invitation) => {
    try {
      const { data, error } = await supabase.functions.invoke('unified-accept-invitation', {
        body: { 
          token: invitation.token,
          action: 'decline'
        }
      });

      if (error) throw error;

      toast({
        title: "Request declined",
        description: "The manager request has been declined",
      });

      loadReceivedInvitations();
    } catch (error: any) {
      console.error('Error declining manager request:', error);
      toast({
        title: "Error declining request",
        description: error.message || "Failed to decline manager request",
        variant: "destructive"
      });
    }
  };

  const handleAcceptTeamInvitation = async (invitation: Invitation) => {
    try {
      const { data, error } = await supabase.functions.invoke('unified-accept-invitation', {
        body: { token: invitation.token }
      });

      if (error) throw error;

      toast({
        title: "Team invitation accepted!",
        description: "You have joined the team successfully",
      });

      loadTeamJoinInvitations();
      onTeamUpdate();
    } catch (error: any) {
      console.error('Error accepting team invitation:', error);
      toast({
        title: "Error accepting invitation",
        description: error.message || "Failed to accept team invitation",
        variant: "destructive"
      });
    }
  };

  const handleDeclineTeamInvitation = async (invitation: Invitation) => {
    try {
      const { data, error } = await supabase.functions.invoke('unified-accept-invitation', {
        body: { 
          token: invitation.token,
          action: 'decline'
        }
      });

      if (error) throw error;

      toast({
        title: "Invitation declined",
        description: "The team invitation has been declined",
      });

      loadTeamJoinInvitations();
    } catch (error: any) {
      console.error('Error declining team invitation:', error);
      toast({
        title: "Error declining invitation",
        description: error.message || "Failed to decline team invitation",
        variant: "destructive"
      });
    }
  };

  const handleUpdateTeamName = async () => {
    if (!teamName.trim()) {
      toast({
        title: "Team name required",
        description: "Please enter a team name",
        variant: "destructive"
      });
      return;
    }

    setUpdatingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_name: teamName.trim() })
        .eq('id', managerProfile.id);

      if (error) throw error;

      toast({
        title: "Team name updated",
        description: `Team name changed to "${teamName.trim()}"`
      });
      
      onTeamUpdate();
    } catch (error: any) {
      console.error('Error updating team name:', error);
      toast({
        title: "Error updating team name",
        description: error.message || "Failed to update team name",
        variant: "destructive"
      });
    } finally {
      setUpdatingName(false);
    }
  };

  const handleInviteMember = async () => {
    if (!newMemberEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    if (!newMemberEmail.includes('@')) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    setInviteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('unified-invitation', {
        body: {
          email: newMemberEmail.trim(),
          invitationType: 'team_join',
          teamId: managerProfile.id
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      toast({
        title: "Invitation sent",
        description: `Team invitation sent to ${newMemberEmail}`,
      });

      setNewMemberEmail('');
      loadInvitations();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast({
        title: "Error sending invitation",
        description: error.message || "Failed to send invitation",
        variant: "destructive"
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('remove-team-member', {
        body: {
          member_id: memberId,
          manager_id: managerProfile.id
        }
      });

      if (error) throw error;

      toast({
        title: "Member removed",
        description: `${memberName} has been removed from the team`
      });

      onTeamUpdate();
    } catch (error: any) {
      console.error('Error removing team member:', error);
      toast({
        title: "Error removing member",
        description: error.message || "Failed to remove team member",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="text-orange-600">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'accepted':
        return (
          <Badge variant="outline" className="text-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Accepted
          </Badge>
        );
      case 'declined':
        return (
          <Badge variant="outline" className="text-destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Declined
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <XCircle className="w-3 h-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Manager Requests Received */}
      {receivedInvitations.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <AlertCircle className="h-5 w-5" />
              Manager Requests Received ({receivedInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {receivedInvitations.map(invitation => (
              <div key={invitation.id} className="p-4 bg-white border border-blue-100 rounded-lg">
                <p className="text-sm text-gray-600 mb-3">
                  Someone wants you to be their manager
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAcceptManagerRequest(invitation)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Accept & Become Manager
                  </Button>
                  <Button
                    onClick={() => handleDeclineManagerRequest(invitation)}
                    variant="outline"
                    size="sm"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Join a Team */}
      {teamJoinInvitations.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Users className="h-5 w-5" />
              Join a Team ({teamJoinInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-green-700 mb-4">
              You've been invited to join the following teams:
            </p>
            {teamJoinInvitations.map(invitation => (
              <div key={invitation.id} className="p-4 bg-white border border-green-100 rounded-lg">
                <p className="font-medium text-gray-900 mb-1">
                  Team invitation to: <span className="text-green-700">{invitation.email}</span>
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  Invited on {new Date(invitation.invited_at).toLocaleDateString()}
                  {invitation.expires_at && (
                    <> • Expires {new Date(invitation.expires_at).toLocaleDateString()}</>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAcceptTeamInvitation(invitation)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Join Team
                  </Button>
                  <Button
                    onClick={() => handleDeclineTeamInvitation(invitation)}
                    variant="outline"
                    size="sm"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Team Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Team Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Team Name</Label>
            <div className="flex gap-2">
              <Input
                id="team-name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Enter team name"
              />
              <Button 
                onClick={handleUpdateTeamName}
                disabled={updatingName || teamName === managerProfile.team_name}
              >
                {updatingName ? 'Updating...' : 'Update'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members ({teamMembers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground mt-4">No team members yet</p>
              <p className="text-sm text-muted-foreground">Invite team members using the section below</p>
            </div>
          ) : (
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
                        {member.email} • Joined {new Date(member.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={loading}
                      >
                        <UserMinus className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove {member.display_name || member.full_name} from your team? 
                          This action cannot be undone and they will lose access to shared team features.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemoveMember(member.id, member.display_name || member.full_name)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove Member
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite New Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Invite Team Members
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="member-email">Email Address</Label>
            <div className="flex gap-2">
              <Input
                id="member-email"
                type="email"
                placeholder="colleague@company.com"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleInviteMember()}
              />
              <Button 
                onClick={handleInviteMember} 
                disabled={inviteLoading}
              >
                <Send className="h-4 w-4 mr-2" />
                {inviteLoading ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            They'll receive an email invitation to join your team
          </p>
        </CardContent>
      </Card>

      {/* Team Invitations Sent */}
      {invitations.filter(i => i.invitation_type === 'team_join').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Invitations Sent ({invitations.filter(i => i.invitation_type === 'team_join' && i.status === 'pending').length} pending)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              People you've invited to join your team:
            </p>
            <div className="space-y-3">
              {invitations.filter(i => i.invitation_type === 'team_join').map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{invitation.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Sent {new Date(invitation.invited_at).toLocaleDateString()}
                        {invitation.expires_at && (
                          <> • Expires {new Date(invitation.expires_at).toLocaleDateString()}</>
                        )}
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

      {/* Manager Requests Sent */}
      {invitations.filter(i => i.invitation_type === 'manager_request').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Manager Requests Sent ({invitations.filter(i => i.invitation_type === 'manager_request' && i.status === 'pending').length} pending)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              People you've asked to be your manager:
            </p>
            <div className="space-y-3">
              {invitations.filter(i => i.invitation_type === 'manager_request').map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Send className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{invitation.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Sent {new Date(invitation.invited_at).toLocaleDateString()}
                        {invitation.expires_at && (
                          <> • Expires {new Date(invitation.expires_at).toLocaleDateString()}</>
                        )}
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

export default TeamManagementInterface;