import { createClient } from '@supabase/supabase-js';
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InvitationRequest {
  email: string;
  invitationType: 'team_member' | 'manager_request';
  teamId?: string;
  message?: string;
}

interface UnifiedInvitation {
  id: string;
  email: string;
  invitation_type: string; // Changed to string to match database response
  status: string; // Changed to string to match database response
  invited_at: string;
  expires_at: string;
  invited_by?: {
    display_name?: string;
    full_name?: string;
  };
  manager?: {
    display_name?: string;
    full_name?: string;
    team_name?: string;
  };
  token?: string;
}

export const useUnifiedInvitations = () => {
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<UnifiedInvitation[]>([]);

  // Send invitation (both team member and manager request)
  const sendInvitation = useCallback(async (request: InvitationRequest) => {
    setLoading(true);
    try {
      console.log('Sending unified invitation:', request);
      
// Obtener sesión del usuario actual
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  throw new Error('Debes estar autenticado para enviar invitaciones');
}

// Crear cliente con token del usuario
const userSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    }
  }
);

const { data, error } = await userSupabase.functions.invoke('unified-invitation', {
  body: request
});

      if (error) {
        console.error('Error sending invitation:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      const invitationType = request.invitationType === 'team_member' ? 'team member' : 'manager';
      toast.success(`${invitationType} invitation sent successfully to ${request.email}`);
      
      // Refresh invitations list
      await loadInvitations();
      
      return data.invitation;
    } catch (error: any) {
      console.error('Send invitation error:', error);
      const errorMessage = error.message || 'Failed to send invitation';
      toast.error(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Load invitations (sent and received)
  const loadInvitations = useCallback(async () => {
    try {
      console.log('Loading invitations...');
      
      // Get current user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Get sent invitations
      const { data: sentInvitations, error: sentError } = await supabase
        .from('invitations')
        .select(`
          *,
          manager:profiles!invitations_manager_id_fkey(display_name, full_name, team_name)
        `)
        .eq('invited_by_id', profile.id)
        .order('created_at', { ascending: false });

      if (sentError) {
        console.error('Error loading sent invitations:', sentError);
      }

      // Get received invitations (where user is the target)
      const { data: receivedInvitations, error: receivedError } = await supabase
        .from('invitations')
        .select(`
          *,
          invited_by:profiles!invitations_invited_by_id_fkey(display_name, full_name),
          manager:profiles!invitations_manager_id_fkey(display_name, full_name, team_name)
        `)
        .eq('email', user.email)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (receivedError) {
        console.error('Error loading received invitations:', receivedError);
      }

      // Combine and deduplicate
      const allInvitations = [
        ...(sentInvitations || []),
        ...(receivedInvitations || [])
      ];

      // Remove duplicates by ID
      const uniqueInvitations = allInvitations.filter(
        (invitation, index, self) => 
          index === self.findIndex(i => i.id === invitation.id)
      );

      setInvitations(uniqueInvitations);
      console.log('Loaded invitations:', uniqueInvitations.length);
      
    } catch (error) {
      console.error('Error loading invitations:', error);
      toast.error('Failed to load invitations');
    }
  }, []);

  // Accept invitation (for received invitations)
  const acceptInvitation = useCallback(async (token: string) => {
    setLoading(true);
    try {
      console.log('Accepting invitation with token:', token);
      
      // Call the accept endpoint directly
      const acceptUrl = `https://bmrifufykczudfxomenr.supabase.co/functions/v1/unified-accept-invitation?token=${token}&action=accept`;
      
      const response = await fetch(acceptUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to accept invitation');
      }

      toast.success('Invitation accepted successfully!');
      
      // Refresh invitations
      await loadInvitations();
      
      // Optionally redirect or refresh page data
      window.location.reload();
      
    } catch (error: any) {
      console.error('Accept invitation error:', error);
      toast.error(error.message || 'Failed to accept invitation');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Decline invitation
  const declineInvitation = useCallback(async (token: string) => {
    setLoading(true);
    try {
      console.log('Declining invitation with token:', token);
      
      // Call the decline endpoint directly
      const declineUrl = `https://bmrifufykczudfxomenr.supabase.co/functions/v1/unified-accept-invitation?token=${token}&action=decline`;
      
      const response = await fetch(declineUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to decline invitation');
      }

      toast.success('Invitation declined');
      
      // Refresh invitations
      await loadInvitations();
      
    } catch (error: any) {
      console.error('Decline invitation error:', error);
      toast.error(error.message || 'Failed to decline invitation');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get team members using new scalable system
  const getTeamMembers = useCallback(async (teamId: string) => {
    try {
      console.log('Loading team members for team:', teamId);
      
      const { data: members, error } = await supabase
        .from('team_members')
        .select(`
          *,
          member:profiles!team_members_member_id_fkey(
            id,
            user_id,
            display_name,
            full_name,
            email,
            role,
            avatar_url
          )
        `)
        .eq('team_id', teamId)
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('Error loading team members:', error);
        throw error;
      }

      return members || [];
    } catch (error) {
      console.error('Error getting team members:', error);
      toast.error('Failed to load team members');
      return [];
    }
  }, []);

  // Remove team member
  const removeTeamMember = useCallback(async (teamId: string, memberId: string) => {
    setLoading(true);
    try {
      console.log('Removing team member:', { teamId, memberId });
      
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('member_id', memberId)
        .neq('role', 'manager'); // Don't allow removing the manager

      if (error) {
        console.error('Error removing team member:', error);
        throw error;
      }

      toast.success('Team member removed successfully');
      
      // The trigger will handle manager demotion if needed
      
    } catch (error: any) {
      console.error('Remove team member error:', error);
      toast.error(error.message || 'Failed to remove team member');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    invitations,
    sendInvitation,
    loadInvitations,
    acceptInvitation,
    declineInvitation,
    getTeamMembers,
    removeTeamMember
  };
};
