import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { useUnifiedInvitations } from '@/hooks/useUnifiedInvitations';
import { 
  UserPlus, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Send,
  ArrowRight,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface InvitationManagerProps {
  userProfile: any;
  onUpdate?: () => void;
}

const InvitationManager: React.FC<InvitationManagerProps> = ({ userProfile, onUpdate }) => {
  const { user } = useAuth();
  const [managerEmail, setManagerEmail] = useState('');
  const [teamMemberEmail, setTeamMemberEmail] = useState('');
  const [showManagerDialog, setShowManagerDialog] = useState(false);
  
  // Use the unified invitations hook
  const {
    invitations,
    loading,
    sendInvitation,
    loadInvitations,
    acceptInvitation,
    declineInvitation
  } = useUnifiedInvitations();

  // Load invitations when component mounts
  useEffect(() => {
    if (user) {
      loadInvitations();
    }
  }, [user, loadInvitations]);

  // Separate invitations by type
  const receivedInvitations = invitations.filter(inv => 
    inv.invitation_type === 'manager_request' && inv.email === user?.email
  );
  
  const sentInvitations = invitations.filter(inv => 
    inv.invited_by || inv.manager // Invitations sent by current user
  );

  // Step 1: Employee requests someone to be their manager
  const handleRequestManager = async () => {
    if (!managerEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter your potential manager's email address",
        variant: "destructive"
      });
      return;
    }

    if (!managerEmail.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    try {
      await sendInvitation({
        email: managerEmail.trim(),
        invitationType: 'manager_request'
      });

      toast({
        title: "Manager Request Sent! 📧",
        description: `Your request has been sent to ${managerEmail}. They can accept it to become your manager.`,
      });

      setManagerEmail('');
      setShowManagerDialog(false);
    } catch (error: any) {
      console.error('Error requesting manager:', error);
      toast({
        title: "Error Sending Request",
        description: error.message || "Failed to send manager request",
        variant: "destructive"
      });
    }
  };

  // Manager adds team members (only available if user is already a manager)
  const handleInviteTeamMember = async () => {
    if (!teamMemberEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter the team member's email address",
        variant: "destructive"
      });
      return;
    }

    try {
      await sendInvitation({
        email: teamMemberEmail.trim(),
        invitationType: 'team_join',
        teamId: userProfile?.id
      });

      toast({
        title: "Team Invitation Sent! 👥",
        description: `Invitation sent to ${teamMemberEmail} to join your team`,
      });

      setTeamMemberEmail('');
    } catch (error: any) {
      console.error('Error inviting team member:', error);
      toast({
        title: "Error Sending Invitation",
        description: error.message || "Failed to send team invitation",
        variant: "destructive"
      });
    }
  };

  // Handle accepting manager request (Step 2)
  const handleAcceptManagerRequest = async (invitation: any) => {
    try {
      await acceptInvitation(invitation.token);
      
      toast({
        title: "Manager Role Accepted! 🎉",
        description: "You are now a manager and they have been added to your team",
      });

      onUpdate?.();
    } catch (error: any) {
      console.error('Error accepting manager request:', error);
      toast({
        title: "Error Accepting Request",
        description: error.message || "Failed to accept manager request",
        variant: "destructive"
      });
    }
  };

  // Handle declining manager request
  const handleDeclineManagerRequest = async (invitation: any) => {
    try {
      await declineInvitation(invitation.token);

      toast({
        title: "Request Declined",
        description: "The manager request has been declined",
      });
    } catch (error: any) {
      console.error('Error declining manager request:', error);
      toast({
        title: "Error Declining Request",
        description: error.message || "Failed to decline manager request",
        variant: "destructive"
      });
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
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInvitationTypeDisplay = (type: string) => {
    switch (type) {
      case 'manager_request':
        return {
          label: 'Manager Request',
          icon: <UserCheck className="h-4 w-4" />,
          description: 'Request for someone to become your manager'
        };
      case 'team_join':
        return {
          label: 'Team Member',
          icon: <Users className="h-4 w-4" />,
          description: 'Invitation to join your team'
        };
      default:
        return {
          label: type,
          icon: <UserPlus className="h-4 w-4" />,
          description: 'Invitation'
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Received Invitations (Manager Requests to Accept) */}
      {receivedInvitations.length > 0 ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <AlertCircle className="h-5 w-5" />
              Manager Requests Received ({receivedInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {receivedInvitations.map((invitation) => {
              const typeInfo = getInvitationTypeDisplay(invitation.invitation_type);
              
              return (
                <div key={invitation.id} className="p-4 border rounded-lg bg-background shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {typeInfo.icon}
                      <span className="font-medium">{typeInfo.label}</span>
                      {getStatusBadge(invitation.status)}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(invitation.invited_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3">
                    {invitation.invited_by?.full_name || 'Someone'} wants you to be their manager
                  </p>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAcceptManagerRequest(invitation)}
                      disabled={loading}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Accept & Become Manager
                    </Button>
                    <Button
                      onClick={() => handleDeclineManagerRequest(invitation)}
                      disabled={loading}
                      variant="outline"
                      size="sm"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        /* Info Card - only show when no invitations */
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                How It Works
              </h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Step 1:</strong> Employee requests someone to be their manager</p>
                <p><strong>Step 2:</strong> Person accepts request and becomes manager</p>
                <p><strong>Step 3:</strong> Manager can add more team members</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Step 1: Request Manager (For Employees) */}
        {!userProfile?.can_manage_teams && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Step 1: Request Manager
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Ask someone to become your manager
              </p>
              <Dialog open={showManagerDialog} onOpenChange={setShowManagerDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Request Manager
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Someone to Be Your Manager</DialogTitle>
                    <DialogDescription>
                      Enter the email of the person you'd like to be your manager. 
                      They'll receive a request that they can accept or decline.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="manager-email">Manager's Email Address</Label>
                      <Input
                        id="manager-email"
                        type="email"
                        placeholder="manager@company.com"
                        value={managerEmail}
                        onChange={(e) => setManagerEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleRequestManager}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Sending...' : 'Send Manager Request'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Add Team Members (For Managers) */}
        {userProfile?.can_manage_teams === true && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Add Team Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Invite people to join your team
              </p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="team-member-email">Team Member Email</Label>
                  <Input
                    id="team-member-email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={teamMemberEmail}
                    onChange={(e) => setTeamMemberEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleInviteTeamMember()}
                  />
                </div>
                <Button
                  onClick={handleInviteTeamMember}
                  disabled={loading}
                  className="w-full"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {loading ? 'Sending...' : 'Send Team Invitation'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sent Invitations */}
      {sentInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Sent Invitations ({sentInvitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sentInvitations.map((invitation) => {
              const typeInfo = getInvitationTypeDisplay(invitation.invitation_type);
              
              return (
                <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {typeInfo.icon}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{invitation.email}</p>
                        <span className="text-sm text-muted-foreground">({typeInfo.label})</span>
                      </div>
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
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InvitationManager;