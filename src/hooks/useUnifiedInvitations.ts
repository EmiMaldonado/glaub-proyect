import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
  token: string; // ✅ Added missing token property
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

// ✅ HOOK REPARADO CON DEPENDENCIAS CORRECTAS
export const useUnifiedInvitations = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<UnifiedInvitation[]>([]);
  const [requestInProgress, setRequestInProgress] = useState(false);

  // ✅ FUNCIÓN SIN DEPENDENCIAS CIRCULARES
  const checkUserPermissions = useCallback(async () => {
    if (!user) return { canManageTeams: false, canBeManaged: false };

    try {
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
  }, [user?.id]); // ✅ Solo depende de user.id

  // ✅ FUNCIÓN SIN DEPENDENCIAS CIRCULARES
  const loadInvitations = useCallback(async () => {
    if (!user || requestInProgress) return;
    
    try {
      setRequestInProgress(true);
      setLoading(true);

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
        .eq('invited_by_id', profile.id)
        .limit(50); // Limitar resultados

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
        .eq('email', profile.email)
        .limit(50); // Limitar resultados

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
      setRequestInProgress(false);
    }
  }, [user?.id]); // ✅ Solo depende de user.id

  // ✅ FUNCIÓN SIN DEPENDENCIAS CIRCULARES
  const sendInvitation = useCallback(async (request: InvitationRequest) => {
    if (!user || loading) return;

    try {
      setLoading(true);

      // Check permissions
      const permissions = await checkUserPermissions();
      
      if (request.invitationType === 'team_join' && !permissions.canManageTeams) {
        throw new Error('You do not have permission to invite team members');
      }

      if (request.invitationType === 'manager_request' && !permissions.canBeManaged) {
        throw new Error('You cannot request a manager at this time');
      }

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
      
      // ✅ FIXED: Use setTimeout to break potential loops
      setTimeout(() => {
        loadInvitations();
      }, 100);
      
      return data;

    } catch (error: any) {
      console.error('❌ Error sending invitation:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user?.id, checkUserPermissions]); // ✅ Removed loadInvitations dependency

  // ✅ OTRAS FUNCIONES SIN DEPENDENCIAS CIRCULARES
  const acceptInvitation = useCallback(async (token: string) => {
    if (!user || loading) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('complete-invitation', {
        body: { 
          token,
          user_id: user.id,
          action: 'accept'
        }
      });

      if (error) throw error;

      console.log('✅ Invitation accepted successfully:', data);
      
      // ✅ FIXED: Use setTimeout to break potential loops
      setTimeout(() => {
        loadInvitations();
      }, 100);
      
      return data;

    } catch (error: any) {
      console.error('❌ Error accepting invitation:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // ✅ Removed loadInvitations dependency

  const declineInvitation = useCallback(async (invitationId: string) => {
    if (!user || loading) return;

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);

      if (error) throw error;

      console.log('✅ Invitation declined successfully');
      
      // ✅ FIXED: Use setTimeout to break potential loops
      setTimeout(() => {
        loadInvitations();
      }, 100);

    } catch (error: any) {
      console.error('❌ Error declining invitation:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // ✅ Removed loadInvitations dependency

  // ✅ CARGAR INVITACIONES SOLO UNA VEZ
  useEffect(() => {
    if (user?.id) {
      loadInvitations();
    }
  }, [user?.id]); // Solo cuando cambia el user.id

  return {
    loading,
    invitations,
    sendInvitation,
    loadInvitations,
    acceptInvitation,
    declineInvitation,
    checkUserPermissions
  };
};