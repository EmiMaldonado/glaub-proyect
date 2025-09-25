import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  CheckCircle, 
  XCircle, 
  Users, 
  UserPlus, 
  Calendar,
  Mail,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface InvitationDetails {
  id: string;
  email: string;
  invitation_type: 'team_join' | 'manager_request';
  status: string;
  message?: string;
  expires_at: string;
  invited_at: string;
  manager?: {
    id: string;
    display_name?: string;
    full_name?: string;
    email: string;
    team_name?: string;
    avatar_url?: string;
  };
  inviter?: {
    id: string;
    display_name?: string;
    full_name?: string;
    email: string;
    avatar_url?: string;
  };
}

const InvitationAcceptPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchInvitationDetails();
    }
  }, [token, user]);

  const fetchInvitationDetails = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch invitation details
      const { data, error: fetchError } = await supabase
        .from('invitations')
        .select(`
          *,
          manager:profiles!invitations_manager_id_fkey (
            id, display_name, full_name, email, team_name, avatar_url
          ),
          inviter:profiles!invitations_invited_by_id_fkey (
            id, display_name, full_name, email, avatar_url
          )
        `)
        .eq('token', token)
        .single();

      if (fetchError || !data) {
        throw new Error('Invitation not found or has expired');
      }

      // Check if invitation has expired
      if (new Date(data.expires_at) < new Date()) {
        throw new Error('This invitation has expired');
      }

      // Check if invitation is still pending
      if (data.status !== 'pending') {
        throw new Error(`This invitation has already been ${data.status}`);
      }

      setInvitation(data as InvitationDetails);
    } catch (err: any) {
      console.error('Error fetching invitation:', err);
      setError(err.message || 'Failed to load invitation details');
    } finally {
      setLoading(false);
    }
  };

  const handleInvitationAction = async (action: 'accept' | 'decline') => {
    if (!token || !user) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('unified-accept-invitation', {
        body: { 
          token, 
          action,
          user_id: user.id 
        }
      });

      if (error) throw error;

      // Show success message
      toast({
        title: action === 'accept' ? "Invitation Accepted!" : "Invitation Declined",
        description: action === 'accept' 
          ? "You have successfully joined the team" 
          : "The invitation has been declined",
        variant: "default"
      });

      // Redirect to appropriate page
      setTimeout(() => {
        if (action === 'accept') {
          navigate('/dashboard');
        } else {
          navigate('/');
        }
      }, 2000);

    } catch (err: any) {
      console.error('Error processing invitation:', err);
      toast({
        title: "Error Processing Invitation",
        description: err.message || 'Failed to process invitation',
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getInvitationTypeInfo = (type: string) => {
    if (type === 'manager_request') {
      return {
        icon: <UserPlus className="w-6 h-6 text-blue-600" />,
        title: 'Manager Request',
        description: 'You have been requested to become a manager'
      };
    } else {
      return {
        icon: <Users className="w-6 h-6 text-green-600" />,
        title: 'Team Invitation',
        description: 'You have been invited to join a team'
      };
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Loading invitation...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-6 h-6" />
              Invalid Invitation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => navigate('/')} className="w-full">
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-6 h-6" />
              Sign In Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Please sign in to accept this invitation.
            </p>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) return null;

  const typeInfo = getInvitationTypeInfo(invitation.invitation_type);
  const senderInfo = invitation.inviter || invitation.manager;
  const senderName = senderInfo?.display_name || senderInfo?.full_name || senderInfo?.email || 'Unknown';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {typeInfo.icon}
            <div>
              <h1 className="text-2xl font-bold">{typeInfo.title}</h1>
              <p className="text-muted-foreground font-normal">{typeInfo.description}</p>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Sender Information */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <Avatar className="h-12 w-12">
              <AvatarImage src={senderInfo?.avatar_url || undefined} />
              <AvatarFallback>
                {getInitials(senderName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium">{senderName}</p>
              <p className="text-sm text-muted-foreground">{senderInfo?.email}</p>
              {invitation.manager?.team_name && (
                <Badge variant="outline" className="mt-1">
                  {invitation.manager.team_name}
                </Badge>
              )}
            </div>
          </div>

          {/* Invitation Details */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Invitation Type</p>
                <p className="font-medium">
                  {invitation.invitation_type === 'manager_request' ? 'Manager Request' : 'Team Invitation'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  Pending
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sent Date</p>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{format(new Date(invitation.invited_at), 'MMM d, yyyy')}</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expires</p>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{format(new Date(invitation.expires_at), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </div>

            {invitation.message && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Message</p>
                <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                  <p className="italic">"{invitation.message}"</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => handleInvitationAction('accept')}
              disabled={processing}
              className="flex-1"
            >
              {processing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Accept Invitation
                </div>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleInvitationAction('decline')}
              disabled={processing}
              className="flex-1"
            >
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Decline
              </div>
            </Button>
          </div>

          {/* Additional Information */}
          <div className="text-sm text-muted-foreground space-y-2">
            {invitation.invitation_type === 'manager_request' ? (
              <div>
                <p><strong>What happens if you accept:</strong></p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>You will become a team manager</li>
                  <li>You will be able to manage team members</li>
                  <li>You will have access to team analytics and insights</li>
                  <li>The requester will join your team as a member</li>
                </ul>
              </div>
            ) : (
              <div>
                <p><strong>What happens if you accept:</strong></p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>You will join {invitation.manager?.team_name || "the team"} as a member</li>
                  <li>Your manager will be able to view your shared data</li>
                  <li>You can adjust sharing preferences anytime</li>
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvitationAcceptPage;