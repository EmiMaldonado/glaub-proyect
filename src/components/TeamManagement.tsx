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
import { Users, Mail, Clock, CheckCircle, XCircle, Plus } from 'lucide-react';

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

  // Show team building section for employees
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

  // Manager view or employee with team - but remove the team display since it's handled in main dashboard
  return (
    <div className="space-y-6">
      {/* Invitations Status */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sent Invitations</CardTitle>
            <CardDescription>
              Status of invitations you have sent
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

export default TeamManagement;