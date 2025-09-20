import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Users, Mail, Plus, UserMinus, Settings2, Clock, CheckCircle, XCircle, Send, User, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
}
interface ManageTeamSectionProps {
  managerProfile: ManagerProfile;
  teamMembers: TeamMember[];
  onTeamUpdate: () => void;
}
const ManageTeamSection: React.FC<ManageTeamSectionProps> = ({
  managerProfile,
  teamMembers,
  onTeamUpdate
}) => {
  const [teamName, setTeamName] = useState(managerProfile.team_name || '');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [updatingName, setUpdatingName] = useState(false);
  useEffect(() => {
    loadInvitations();
  }, [managerProfile.id]);
  const loadInvitations = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('invitations').select('*').eq('manager_id', managerProfile.id).order('invited_at', {
        ascending: false
      });
      if (error) throw error;
      setInvitations(data || []);
    } catch (error: any) {
      console.error('Error loading invitations:', error);
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
      const {
        error
      } = await supabase.from('profiles').update({
        team_name: teamName.trim()
      }).eq('id', managerProfile.id);
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
      const {
        data,
        error
      } = await supabase.functions.invoke('unified-invitation', {
        body: {
          email: newMemberEmail.trim(),
          invitationType: 'team_member',
          teamId: managerProfile.id
        }
      });
      if (error) throw error;
      if (!data.success) {
        throw new Error(data.error || 'Failed to send invitation');
      }
      toast({
        title: "Invitation sent",
        description: `Team invitation sent to ${newMemberEmail}`
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
    try {
      const {
        error
      } = await supabase.functions.invoke('remove-team-member', {
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
    }
  };
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-orange-600 text-xs">
            <Clock className="w-2 h-2 mr-1" />
            Pending
          </Badge>;
      case 'accepted':
        return <Badge variant="outline" className="text-green-600 text-xs">
            <CheckCircle className="w-2 h-2 mr-1" />
            Accepted
          </Badge>;
      case 'declined':
        return <Badge variant="outline" className="text-destructive text-xs">
            <XCircle className="w-2 h-2 mr-1" />
            Declined
          </Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };
  const pendingInvitations = invitations.filter(i => i.status === 'pending');
  return <Card className="h-fit">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Manage your team
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team Overview */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Team Overview</label>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-lg font-semibold text-primary">{teamMembers.length}</div>
              <div className="text-xs text-muted-foreground">Members</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-lg font-semibold text-primary">{pendingInvitations.length}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-lg font-semibold text-primary">{teamMembers.length + pendingInvitations.length}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>
        </div>

        {/* Team Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Team Name</label>
          <div className="flex gap-1">
            <Input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Enter team name" className="text-sm" />
            <Button onClick={handleUpdateTeamName} disabled={updatingName || teamName === managerProfile.team_name} size="sm">
              Save
            </Button>
          </div>
        </div>

        {/* Team Members */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Team Members ({teamMembers.length})</label>
          {teamMembers.length === 0 ? <div className="text-center py-4 text-muted-foreground text-sm">
              No team members yet
            </div> : <div className="space-y-2 max-h-40 overflow-y-auto">
              {teamMembers.map(member => <div key={member.id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate text-xs">{member.display_name || member.full_name}</span>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-6 w-6 p-0">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove {member.display_name || member.full_name} from your team?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRemoveMember(member.id, member.display_name || member.full_name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>)}
            </div>}
        </div>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && <div className="space-y-2">
            <label className="text-sm font-medium">Pending Invitations ({pendingInvitations.length})</label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {pendingInvitations.map(invitation => <div key={invitation.id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate text-xs">{invitation.email}</span>
                  </div>
                  {getStatusBadge(invitation.status)}
                </div>)}
            </div>
          </div>}

        {/* Invite Members */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Invite New Members</label>
          <div className="flex gap-1">
            <Input type="email" placeholder="email@company.com" value={newMemberEmail} onChange={e => setNewMemberEmail(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleInviteMember()} className="text-sm" />
            <Button onClick={handleInviteMember} disabled={inviteLoading} size="sm">
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        

        {/* Team Health Indicator */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Team Health</label>
          <div className="p-3 border rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Team Status</span>
              <Badge variant={teamMembers.length > 0 ? "default" : "secondary"} className="text-xs">
                {teamMembers.length > 0 ? "Active" : "Building"}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {teamMembers.length === 0 ? "Start building your team by inviting members" : `Your team has ${teamMembers.length} member${teamMembers.length > 1 ? 's' : ''} ready to collaborate`}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>;
};
export default ManageTeamSection;