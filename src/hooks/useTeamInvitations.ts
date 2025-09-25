import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ExtendedProfile } from '@/types/extended-database';
import { toast } from '@/hooks/use-toast';

export interface TeamInvitation {
  id: string;
  email: string;
  invitation_type: 'team_join' | 'manager_request';
  status: 'pending' | 'accepted' | 'declined';
  token: string;
  manager_id: string;
  invited_by_id?: string;
  message?: string;
  expires_at: string;
  invited_at: string;
  accepted_at?: string;
  created_at: string;
  // Related data
  manager?: ExtendedProfile;
  inviter?: ExtendedProfile;
}

export interface TeamMember {
  id: string;
  team_id: string;
  member_id: string;
  role: 'leader' | 'member';
  joined_at: string;
  profile?: ExtendedProfile;
}

export const useTeamInvitations = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Send invitation
  const sendInvitation = useCallback(async (
    email: string,
    type: 'team_join' | 'manager_request',
    message?: string
  ) => {
    if (!user) throw new Error('User not authenticated');

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('unified-invitation', {
        body: {
          email,
          invitation_type: type,
          message: message || undefined
        }
      });

      if (error) throw error;

      toast({
        title: "Invitation Sent",
        description: `${type === 'manager_request' ? 'Manager request' : 'Team invitation'} sent to ${email}`,
        variant: "default"
      });

      // Reload invitations
      await loadInvitations();
      return data;
    } catch (error: any) {
      toast({
        title: "Error Sending Invitation",
        description: error.message || 'Failed to send invitation',
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load invitations
  const loadInvitations = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Get all invitations (sent and received)
      const { data: allInvitations, error } = await supabase
        .from('invitations')
        .select(`
          *,
          manager:profiles!invitations_manager_id_fkey (
            id, display_name, full_name, email, team_name
          ),
          inviter:profiles!invitations_invited_by_id_fkey (
            id, display_name, full_name, email
          )
        `)
        .or(`invited_by_id.eq.${profile.id},email.eq.${profile.email}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const typedInvitations: TeamInvitation[] = (allInvitations || []).map(inv => ({
        id: inv.id,
        email: inv.email,
        invitation_type: inv.invitation_type,
        status: inv.status,
        token: inv.token,
        manager_id: inv.manager_id,
        invited_by_id: inv.invited_by_id,
        message: inv.message,
        expires_at: inv.expires_at,
        invited_at: inv.invited_at,
        accepted_at: inv.accepted_at,
        created_at: inv.created_at,
        manager: inv.manager as ExtendedProfile | undefined,
        inviter: inv.inviter as ExtendedProfile | undefined
      }));

      setInvitations(typedInvitations);
    } catch (error) {
      console.error('Error loading invitations:', error);
      toast({
        title: "Error Loading Invitations",
        description: "Failed to load invitations",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Accept invitation
  const acceptInvitation = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('unified-accept-invitation', {
        body: { token, action: 'accept' }
      });

      if (error) throw error;

      toast({
        title: "Invitation Accepted",
        description: "Successfully joined the team!",
        variant: "default"
      });

      await loadInvitations();
      return data;
    } catch (error: any) {
      toast({
        title: "Error Accepting Invitation",
        description: error.message || 'Failed to accept invitation',
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadInvitations]);

  // Decline invitation
  const declineInvitation = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('unified-accept-invitation', {
        body: { token, action: 'decline' }
      });

      if (error) throw error;

      toast({
        title: "Invitation Declined",
        description: "Invitation has been declined",
        variant: "default"
      });

      await loadInvitations();
      return data;
    } catch (error: any) {
      toast({
        title: "Error Declining Invitation",
        description: error.message || 'Failed to decline invitation',
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadInvitations]);

  // Get team members
  const getTeamMembers = useCallback(async (teamId?: string) => {
    if (!user) return [];

    try {
      // Get user profile if teamId not provided
      let targetTeamId = teamId;
      if (!targetTeamId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (!profile) return [];
        targetTeamId = profile.id;
      }

      const { data, error } = await supabase
        .from('team_members')
        .select(`
          *,
          profile:profiles!team_members_member_id_fkey (
            id, display_name, full_name, email, avatar_url, role
          )
        `)
        .eq('team_id', targetTeamId)
        .order('joined_at', { ascending: true });

      if (error) throw error;

      const typedMembers: TeamMember[] = (data || []).map(member => ({
        id: member.id,
        team_id: member.team_id,
        member_id: member.member_id,
        role: member.role,
        joined_at: member.joined_at,
        profile: member.profile as ExtendedProfile | undefined
      }));

      setTeamMembers(typedMembers);
      return typedMembers;
    } catch (error) {
      console.error('Error loading team members:', error);
      return [];
    }
  }, [user]);

  // Remove team member
  const removeTeamMember = useCallback(async (teamId: string, memberId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('member_id', memberId);

      if (error) throw error;

      toast({
        title: "Member Removed",
        description: "Team member has been removed successfully",
        variant: "default"
      });

      // Reload team members
      await getTeamMembers(teamId);
    } catch (error: any) {
      toast({
        title: "Error Removing Member",
        description: error.message || 'Failed to remove team member',
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [getTeamMembers]);

  // Load invitations on mount
  useEffect(() => {
    if (user) {
      loadInvitations();
    }
  }, [user, loadInvitations]);

  return {
    loading,
    invitations,
    teamMembers,
    sendInvitation,
    loadInvitations,
    acceptInvitation,
    declineInvitation,
    getTeamMembers,
    removeTeamMember
  };
};