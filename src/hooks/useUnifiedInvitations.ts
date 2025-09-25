import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ExtendedProfile } from '@/types/extended-database';

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
  token?: string;
  manager?: {
    id: string;
    display_name?: string;
    full_name?: string;
    email?: string;
    team_name?: string;
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

  // Check user permissions
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
        canBeManaged: extendedProfile?.can_be_managed ?? true
      };
    } catch (error) {
      console.error('Error checking user permissions:', error);
      return { canManageTeams: false, canBeManaged: false };
    }
  }, [user]);

  // Send invitation
  const sendInvitation = useCallback(async (request: InvitationRequest) => {
    setLoading(true);
    
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Check permissions
      const permissions = await checkUserPermissions();
      
      if (request.invitationType === 'team_join' && !permissions.canManageTeams) {
        throw new Error('You do not have permission to invite team members');
      }

      if (request.invitationType === 'manager_request' && !permissions.canBeManaged) {
        throw new Error('You cannot request a manager at this time');
      }

      // Get current user profile
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('id, email, display_name, full_name')
        .eq('user_id', user.id)
        .single();

      if (!currentProfile) {
        throw new Error('Profile not found');
      }

      // Check for existing pending invitations first
      const { data: existingInvitations, error: checkError } = await supabase
        .from('invitations')
        .select('id, email, status, invitation_type')
        .eq('email', request.email)
        .eq('invitation_type', request.invitationType)
        .eq('status', 'pending');

      // Ignore the error if it's just "no rows found"
      if (checkError && !checkError.message.includes('No rows')) {
        console.warn('Error checking existing invitations:', checkError);
      }

      const existingInvitation = existingInvitations && existingInvitations.length > 0 ? existingInvitations[0] : null;

      if (existingInvitation) {
        throw new Error(`A ${request.invitationType === 'manager_request' ? 'manager request' : 'team invitation'} is already pending for ${request.email}`);
      }

      // Call unified invitation edge function
      const { data, error } = await supabase.functions.invoke('unified-invitation', {
        body: {
          email: request.email,
          invitationType: request.invitationType,
          teamId: request.teamId || currentProfile.id,
          message: request.message
        }
      });

      if (error) {
        // Handle specific edge function errors
        if (error.message && (error.message.includes('already sent') || error.message.includes('already exists'))) {
          throw new Error(`A ${request.invitationType === 'manager_request' ? 'manager request' : 'team invitation'} is already pending for ${request.email}`);
        }
        
        // Handle FunctionsHttpError with event_message
        if (error.event_message && (error.event_message.includes('already exists') || error.event_message.includes('already sent'))) {
          throw new Error(`A ${request.invitationType === 'manager_request' ? 'manager request' : 'team invitation'} is already pending for ${request.email}`);
        }
        
        throw error;
      }

      console.log('✅ Invitation sent successfully:', data);
      
      // Reload invitations to show the new one
      await loadInvitations();
      
      return data;

    } catch (error: any) {
      console.error('❌ Error sending invitation:', error);
      
      // Provide user-friendly error messages
      if (error.message?.includes('already sent') || 
          error.message?.includes('already pending') ||
          error.message?.includes('already exists')) {
        throw new Error(error.message);
      } else if (error.event_message?.includes('already exists') || 
                 error.event_message?.includes('already sent')) {
        throw new Error(`A ${request.invitationType === 'manager_request' ? 'manager request' : 'team invitation'} is already pending for ${request.email}`);
      } else if (error.message?.includes('FunctionsHttpError')) {
        throw new Error('There was an error sending the invitation. Please try again.');
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, checkUserPermissions]);

  // Load invitations for current user - FORCE RELOAD VERSION
  const loadInvitations = useCallback(async () => {
    if (!user) return;
    
    console.log('🔄 Loading invitations with updated hook...');
    setLoading(true);
    
    try {
      // Get current user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        console.log('No profile found for user');
        setInvitations([]);
        return;
      }

      console.log('📧 Loading invitations for email:', profile.email);

      // Get sent invitations (where current user is the inviter)
      const { data: sentInvitations, error: sentError } = await supabase
        .from('invitations')
        .select(`
          *,
          manager:profiles!invitations_manager_id_fkey (
            id, display_name, full_name, email, team_name
          )
        `)
        .eq('invited_by_id', profile.id)
        .order('created_at', { ascending: false });

      if (sentError) {
        console.error('Error loading sent invitations:', sentError);
      }

      // Get received invitations - UPDATED QUERY WITHOUT STATUS FILTER
        // En loadInvitations, cambia esta línea:
        const { data: receivedInvitations, error: receivedError } = await supabase
          .from('invitations')
          .select(`
            *,
            inviter:profiles!invitations_invited_by_id_fkey (
              id, display_name, full_name, email
            ),
            manager:profiles!invitations_manager_id_fkey (
              id, display_name, full_name, email, team_name
            )
          `)
          .eq('email', profile.email)
          .order('created_at', { ascending: false });
          // ↑ Quitar cualquier filtro por status aquí
          *,
          inviter:profiles!invitations_invited_by_id_fkey (
            id, display_name, full_name, email
          ),
          manager:profiles!invitations_manager_id_fkey (
            id, display_name, full_name, email, team_name
          )
        `)
        .eq('email', profile.email)
        .order('created_at', { ascending: false });
                .from('invitations')
        .select(`

      if (receivedError) {
        console.error('Error loading received invitations:', receivedError);
      }

      console.log('📤 Sent invitations loaded:', sentInvitations?.length || 0);
      console.log('📥 Received invitations loaded:', receivedInvitations?.length || 0);

      // Combine and deduplicate invitations
      const allInvitations = [
        ...(sentInvitations || []), 
        ...(receivedInvitations || [])
      ];
      
      const uniqueInvitations = allInvitations.filter((invitation, index, self) => 
        index === self.findIndex(inv => inv.id === invitation.id)
      );

      console.log('✅ Total unique invitations:', uniqueInvitations.length);

      // Type assertion to ensure correct typing
      const typedInvitations: UnifiedInvitation[] = uniqueInvitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        status: inv.status as 'pending' | 'accepted' | 'declined',
        invitation_type: inv.invitation_type,
        invited_at: inv.invited_at || inv.created_at,
        accepted_at: inv.accepted_at || undefined,
        expires_at: inv.expires_at,
        manager_id: inv.manager_id,
        invited_by_id: inv.invited_by_id || undefined,
        token: inv.token || undefined,
        manager: inv.manager || undefined,
        inviter: inv.inviter || undefined
      }));

      setInvitations(typedInvitations);

    } catch (error) {
      console.error('❌ Error loading invitations:', error);
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Accept invitation
  const acceptInvitation = useCallback(async (token: string) => {
    setLoading(true);
    
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get invitation details first
      const { data: invitation } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (!invitation) {
        throw new Error('Invitation not found or already processed');
      }

      console.log('Accepting invitation:', invitation);

      // Get user profile
      const { data: userProfile } = await supabase
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

      console.log('✅ Added to team_members successfully');

      // If manager_request, update can_manage_teams
      if (invitation.invitation_type === 'manager_request') {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ can_manage_teams: true } as any)
          .eq('id', userProfile.id);

        if (updateError) {
          console.error('Error updating manager permissions:', updateError);
        } else {
          console.log('✅ Updated can_manage_teams to true');
        }
      }

      // Mark invitation as accepted
      const { error: updateInvitationError } = await supabase
        .from('invitations')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', invitation.id);

      if (updateInvitationError) {
        console.error('Error updating invitation status:', updateInvitationError);
      }

      console.log('✅ Invitation accepted successfully');
      
      // Reload invitations to reflect changes
      await loadInvitations();
      
      return { success: true, invitation };

    } catch (error: any) {
      console.error('❌ Error accepting invitation:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, loadInvitations]);

  // Decline invitation
  const declineInvitation = useCallback(async (token: string) => {
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('invitations')
        .update({ 
          status: 'declined',
          accepted_at: new Date().toISOString()
        })
        .eq('token', token)
        .eq('status', 'pending');

      if (error) throw error;

      console.log('✅ Invitation declined successfully');
      
      // Reload invitations to reflect changes
      await loadInvitations();

    } catch (error: any) {
      console.error('❌ Error declining invitation:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadInvitations]);

  // Get team members
  const getTeamMembers = useCallback(async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          *,
          profile:profiles!team_members_member_id_fkey (
            id, display_name, full_name, email, avatar_url, job_position, job_level
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

  // Remove team member
  const removeTeamMember = useCallback(async (teamId: string, memberId: string) => {
    try {
      // Prevent removing team leader
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
