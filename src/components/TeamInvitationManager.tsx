import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Send, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Users, 
  UserPlus,
  AlertCircle,
  Mail,
  Calendar
} from 'lucide-react';
import { useTeamInvitations } from '@/hooks/useTeamInvitations';
import { useManagerCapabilities } from '@/hooks/useManagerCapabilities';
import { format } from 'date-fns';

const TeamInvitationManager: React.FC = () => {
  const { 
    loading, 
    invitations, 
    sendInvitation, 
    acceptInvitation, 
    declineInvitation 
  } = useTeamInvitations();
  
  const { isManager, canAccessManagerDashboard } = useManagerCapabilities();
  
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sendingType, setSendingType] = useState<'team_join' | 'manager_request'>('manager_request');

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      await sendInvitation(email.trim(), sendingType, message.trim() || undefined);
      setEmail('');
      setMessage('');
    } catch (error) {
      console.error('Error sending invitation:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-orange-600 border-orange-300"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'accepted':
        return <Badge variant="outline" className="text-green-600 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />Accepted</Badge>;
      case 'declined':
        return <Badge variant="outline" className="text-red-600 border-red-300"><XCircle className="w-3 h-3 mr-1" />Declined</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'manager_request' ? <UserPlus className="w-4 h-4" /> : <Users className="w-4 h-4" />;
  };

  const sentInvitations = invitations.filter(inv => inv.inviter);
  const receivedInvitations = invitations.filter(inv => !inv.inviter && inv.status === 'pending');

  if (loading && invitations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Team Invitations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Team Invitations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="send" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="send">Send Invitation</TabsTrigger>
            <TabsTrigger value="received">
              Received ({receivedInvitations.length})
            </TabsTrigger>
            <TabsTrigger value="sent">
              Sent ({sentInvitations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="space-y-4">
            <form onSubmit={handleSendInvitation} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invitation-type">Invitation Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={sendingType === 'manager_request' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSendingType('manager_request')}
                    className="flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Request Manager
                  </Button>
                  {canAccessManagerDashboard && (
                    <Button
                      type="button"
                      variant={sendingType === 'team_join' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSendingType('team_join')}
                      className="flex items-center gap-2"
                    >
                      <Users className="w-4 h-4" />
                      Invite to Team
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {sendingType === 'manager_request' 
                    ? 'Request someone to become your manager'
                    : 'Invite someone to join your team'
                  }
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message (Optional)</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a personal message..."
                  rows={3}
                />
              </div>

              <Button type="submit" disabled={loading || !email.trim()}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Send Invitation
                  </div>
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="received" className="space-y-4">
            {receivedInvitations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No pending invitations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {receivedInvitations.map((invitation) => (
                  <Card key={invitation.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(invitation.invitation_type)}
                          <span className="font-medium">
                            {invitation.invitation_type === 'manager_request' 
                              ? 'Manager Request' 
                              : 'Team Invitation'
                            }
                          </span>
                          {getStatusBadge(invitation.status)}
                        </div>
                        
                        <div className="text-sm text-muted-foreground space-y-1">
                          {invitation.manager && (
                            <p>From: {invitation.manager.display_name || invitation.manager.full_name}</p>
                          )}
                          {invitation.manager?.team_name && (
                            <p>Team: {invitation.manager.team_name}</p>
                          )}
                          {invitation.message && (
                            <p className="italic">"{invitation.message}"</p>
                          )}
                          <div className="flex items-center gap-1 text-xs">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(invitation.invited_at), 'MMM d, yyyy')}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button 
                          size="sm" 
                          onClick={() => acceptInvitation(invitation.token)}
                          disabled={loading}
                        >
                          Accept
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => declineInvitation(invitation.token)}
                          disabled={loading}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sent" className="space-y-4">
            {sentInvitations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No sent invitations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sentInvitations.map((invitation) => (
                  <Card key={invitation.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(invitation.invitation_type)}
                          <span className="font-medium">{invitation.email}</span>
                          {getStatusBadge(invitation.status)}
                        </div>
                        
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            Type: {invitation.invitation_type === 'manager_request' 
                              ? 'Manager Request' 
                              : 'Team Invitation'
                            }
                          </p>
                          {invitation.message && (
                            <p className="italic">"{invitation.message}"</p>
                          )}
                          <div className="flex items-center gap-1 text-xs">
                            <Calendar className="w-3 h-3" />
                            Sent {format(new Date(invitation.invited_at), 'MMM d, yyyy')}
                          </div>
                          {invitation.status === 'pending' && (
                            <div className="flex items-center gap-1 text-xs text-orange-600">
                              <AlertCircle className="w-3 h-3" />
                              Expires {format(new Date(invitation.expires_at), 'MMM d, yyyy')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TeamInvitationManager;