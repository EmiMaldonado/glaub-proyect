import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ExtendedProfile, ExtendedProfileUpdate } from '@/types/extended-database';

export interface InvitationRequest {
  email: string;
  invitationType: 'team_join' | 'manager_request';
  teamId?: string;
  message?: string;
}

export interface UnifiedInvitation {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'declined';
  invitation_type: string;
  invited_at: string;
  accepted_at?: string;
  expires_at: string;
  manager_id: string;
  invited_by_id?: string;
  manager?: {
    id: string;
    display_name?: string;
    full_name?: string;
    email?: string;
  };
  inviter?: {
    id: string;
    display_name?: string;
    full_name?: string;
    email?: string;
  };
}

export const useUnifiedInvitations = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<UnifiedInvitation[]>([]);

  // Check user permissions - REMOVED from dependencies
  const checkUserPermissions = useCallback(async () => {
    try {
      if (!user) return { canManageTeams: false, canBeManaged: false };

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const extendedProfile = profile as any as ExtendedProfile;
      
      return {
        canManageTeams: extendedProfile?.can_manage_teams || false,
        canBeManaged: extendedProfile?.can_be_managed || true
      };
    } catch (error) {
      console.error('Error checking user permissions:', error);
      return { canManageTeams: false, canBeManaged: false };
    }
  }, []); // FIXED: Empty dependencies

  // Load invitations - STANDALONE function
  const loadInvitations = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Get sent invitations
      const { data: sentInvitations, error: sentError } = await supabase
        .from('invitations')
        .select(`
          *,
          manager:profiles!invitations_manager_id_fkey (
            id, display_name, full_name, email
          )
        `)
        .eq('invited_by_id', profile.id);

      if (sentError) throw sentError;

      // Get received invitations
      const { data: receivedInvitations, error: receivedError } = await supabase
        .from('invitations')
        .select(`
          *,
          inviter:profiles!invitations_invited_by_id_fkey (
            id, display_name, full_name, email
          )
        `)
        .eq('email', profile.email);

      if (receivedError) throw receivedError;

      // Combine and deduplicate
      const allInvitations = [...(sentInvitations || []), ...(receivedInvitations || [])];
      const uniqueInvitations = allInvitations.filter((invitation, index, self) => 
        index === self.findIndex(inv => inv.id === invitation.id)
      );

      setInvitations(uniqueInvitations as UnifiedInvitation[]);

    } catch (error) {
      console.error('Error loading invitations:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // FIXED: Only user.id dependency

  // Send invitation - NO loadInvitations call
  const sendInvitation = useCallback(async (request: InvitationRequest) => {
    setLoading(true);
    
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Inline permission check - no dependency
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const extendedProfile = profile as any as ExtendedProfile;
      const canManageTeams = extendedProfile?.can_manage_teams || false;
      const canBeManaged = extendedProfile?.can_be_managed || true;
      
      if (request.invitationType === 'team_join' && !canManageTeams) {
        throw new Error('You do not have permission to invite team members');
      }

      if (request.invitationType === 'manager_request' && !canBeManaged) {
        throw new Error('You cannot request a manager at this time');
      }

      // Call unified invitation edge function
      const { data, error } = await supabase.functions.invoke('unified-invitation', {
        body: {
          email: request.email,
          invitationType: request.invitationType,
          teamId: request.teamId,
          message: request.message
        }
      });

      if (error) throw error;

      console.log('✅ Invitation sent successfully:', data);
      
      // DON'T auto-reload - let component handle it manually
      
      return data;

    } catch (error: any) {
      console.error('❌ Error sending invitation:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // FIXED: Only user.id dependency

  // Accept invitation - NO loadInvitations call
  const acceptInvitation = useCallback(async (token: string) => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('unified-accept-invitation', {
        body: { token }
      });

      if (error) throw error;

      console.log('✅ Invitation accepted successfully:', data);
      
      // Update profile with manager permissions if needed
      if (data.invitation?.invitation_type === 'manager_request') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user?.id)
          .single();

        if (profile) {
          await supabase
            .from('profiles')
            .update({ can_manage_teams: true } as any)
            .eq('id', profile.id);
        }
      }
      
      // DON'T auto-reload - let component handle it manually
      
      return data;

    } catch (error: any) {
      console.error('❌ Error accepting invitation:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // FIXED: Only user.id dependency

  // Decline invitation - NO loadInvitations call
  const declineInvitation = useCallback(async (invitationId: string) => {
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);

      if (error) throw error;

      console.log('✅ Invitation declined successfully');
      
      // DON'T auto-reload - let component handle it manually

    } catch (error: any) {
      console.error('❌ Error declining invitation:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []); // FIXED: No dependencies

  // Get team members - STANDALONE
  const getTeamMembers = useCallback(async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          *,
          profile:profiles!team_members_member_id_fkey (
            id, display_name, full_name, email, avatar_url, job_position, job_level, role
          )
        `)
        .eq('team_id', teamId);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error getting team members:', error);
      return [];
    }
  }, []);

  // Remove team member - STANDALONE
  const removeTeamMember = useCallback(async (teamId: string, memberId: string) => {
    try {
      const { data: member } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('member_id', memberId)
        .single();

      if (member?.role === 'leader') {
        throw new Error('Cannot remove team leader');
      }

      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('member_id', memberId);

      if (error) throw error;

      console.log('✅ Team member removed successfully');

    } catch (error: any) {
      console.error('❌ Error removing team member:', error);
      throw error;
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
