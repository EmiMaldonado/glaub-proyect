import { createClient } from '@supabase/supabase-js';
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InvitationRequest {
  email: string;
  invitationType: 'team_join' | 'manager_request'; // Updated type names
  teamId?: string;
  message?: string;
}

interface UnifiedInvitation {
  id: string;
  email: string;
  invitation_type: string;
  status: string;
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

  // Check user permissions using can_manage_teams
  const checkUserPermissions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { canManageTeams: false, canBeManaged: false };

      const { data: profile } = await supabase
        .from('profiles')
        .select('can_manage_teams, can_be_managed')
        .eq('user_id', user.id)
        .single();

      return {
        canManageTeams: profile?.can_manage_teams || false,
        canBeManaged: profile?.can_be_managed || true
      };
    } catch (error) {
      console.error('Error checking user permissions:', error);
      return { canManageTeams: false, canBeManaged: false };
    }
  }, []);

  // Send invitation with permission check
  const sendInvitation = useCallback(async (request: InvitationRequest) => {
    setLoading(true);
    try {
      console.log('Sending unified invitation:', request);
      
      // Check permissions first
      const permissions = await checkUserPermissions();
      if (!permissions.canManageTeams) {
        throw new Error('You do not have permission to send invitations');
      }

      // Get session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be authenticated to send invitations');
      }

      // Call edge function with JWT token
      const { data, error } = await supabase.functions.invoke('unified-invitation', {
        body: request,
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Error sending invitation:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      const invitationType = request.invitationType === 'team_join' ? 'team member' : 'manager';
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
  }, [checkUserPermissions]);

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
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to accept invitations');
      }

      // Get invitation details
      const { data: invitation } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (!invitation) {
        throw new Error('Invitation not found or already processed');
      }

      // Get user profile
      let { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!userProfile) {
        throw new Error('User profile not found');
      }

      // Insert into team_members table
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: invitation.manager_id,
          member_id: userProfile.id,
          role: invitation.invitation_type === 'manager_request' ? 'leader' : 'member'
        });

      if (memberError) {
        console.error('Error adding team member:', memberError);
        throw new Error('Failed to join team');
      }

      // If manager_request, update can_manage_teams
      if (invitation.invitation_type === 'manager_request') {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ can_manage_teams: true })
          .eq('id', userProfile.id);

        if (updateError) {
          console.error('Error updating manager permissions:', updateError);
        }
      }

      // Mark invitation as accepted
      await supabase
        .from('invitations')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', invitation.id);

      toast.success('Invitation accepted successfully!');
      
      // Refresh invitations and reload page to reflect changes
      await loadInvitations();
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
      
      // Mark invitation as declined
      const { error } = await supabase
        .from('invitations')
        .update({ 
          status: 'declined',
          accepted_at: new Date().toISOString()
        })
        .eq('token', token)
        .eq('status', 'pending');

      if (error) {
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
            avatar_url,
            can_manage_teams,
            can_be_managed
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
        .neq('role', 'leader'); // Don't allow removing the team leader

      if (error) {
        console.error('Error removing team member:', error);
        throw error;
      }

      toast.success('Team member removed successfully');
      
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
    removeTeamMember,
    checkUserPermissions
  };
};
