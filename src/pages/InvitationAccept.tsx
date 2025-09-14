import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Users, CheckCircle, XCircle, Calendar, User, Building } from 'lucide-react';

interface InvitationDetails {
  id: string;
  email: string;
  status: string;
  invited_at: string;
  expires_at: string;
  manager: {
    full_name: string;
    display_name: string;
    team_name?: string;
  };
}

const InvitationAccept: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token && user) {
      fetchInvitationDetails();
    }
  }, [token, user]);

  const fetchInvitationDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!token) {
        setError('No invitation token provided');
        return;
      }

      // Fetch invitation details
      const { data, error } = await supabase
        .from('invitations')
        .select(`
          *,
          manager:profiles!invitations_manager_id_fkey(
            full_name, display_name, team_name
          )
        `)
        .eq('token', token)
        .single();

      if (error) {
        console.error('Error fetching invitation:', error);
        setError('Invalid or expired invitation');
        return;
      }

      if (!data) {
        setError('Invitation not found');
        return;
      }

      // Check if invitation is still valid
      if (data.status !== 'pending') {
        setError(`This invitation has already been ${data.status}`);
        return;
      }

      // Check if invitation has expired
      if (new Date() > new Date(data.expires_at)) {
        setError('This invitation has expired');
        return;
      }

      setInvitation(data as InvitationDetails);
    } catch (error: any) {
      console.error('Error fetching invitation details:', error);
      setError('Failed to load invitation details');
    } finally {
      setLoading(false);
    }
  };

  const handleInvitationAction = async (action: 'accept' | 'decline') => {
    if (!invitation || !user || !token) return;

    try {
      setProcessing(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('complete-invitation', {
        body: {
          token: token,
          user_id: user.id,
          action: action
        }
      });

      if (error) {
        console.error('Error processing invitation:', error);
        throw new Error(error.message || `Failed to ${action} invitation`);
      }

      if (data?.success) {
        const actionText = action === 'accept' ? 'accepted' : 'declined';
        const description = action === 'accept' 
          ? `You are now part of ${data.manager_name}'s team` 
          : 'You have declined the team invitation';

        toast({
          title: `Invitation ${actionText}!`,
          description: description,
        });

        // Redirect to appropriate page
        setTimeout(() => {
          if (action === 'accept') {
            navigate('/team-overview');
          } else {
            navigate('/dashboard');
          }
        }, 2000);
      } else {
        throw new Error(data?.error || `Failed to ${action} invitation`);
      }
    } catch (error: any) {
      console.error(`Error ${action}ing invitation:`, error);
      setError(error.message || `Failed to ${action} invitation`);
      toast({
        title: `Error ${action}ing invitation`,
        description: error.message || `An error occurred while ${action}ing the invitation`,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  // Redirect to login if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Users className="h-12 w-12 text-primary mx-auto mb-4" />
            <CardTitle>Team Invitation</CardTitle>
            <CardDescription>
              Please log in to view and respond to this team invitation
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate(`/auth?redirect=/invitation/${token}`)}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error || 'This invitation is not valid'}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const teamName = invitation.manager.team_name || 
    `${invitation.manager.display_name || invitation.manager.full_name}'s Team`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <Users className="h-12 w-12 text-primary mx-auto mb-4" />
          <CardTitle>Team Invitation</CardTitle>
          <CardDescription>
            You've been invited to join a team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Building className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Team Name</p>
                <p className="text-sm text-muted-foreground">{teamName}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <User className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Manager</p>
                <p className="text-sm text-muted-foreground">
                  {invitation.manager.display_name || invitation.manager.full_name}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Invitation Date</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(invitation.invited_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge variant="outline" className="text-green-600">
              <CheckCircle className="w-3 h-3 mr-1" />
              Valid Invitation
            </Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => handleInvitationAction('accept')}
              disabled={processing}
            >
              {processing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Accept Invitation
            </Button>
            
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleInvitationAction('decline')}
              disabled={processing}
            >
              {processing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Decline
            </Button>
          </div>

          {/* Additional Info */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              By accepting this invitation, you'll become a member of this team and be able to 
              collaborate with other team members.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvitationAccept;