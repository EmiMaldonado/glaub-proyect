import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TeamLimits {
  currentMembers: number;
  maxMembers: number;
  currentTeams: number;
  maxTeams: number;
  canInviteMore: boolean;
  canJoinMore: boolean;
}

interface AutoConfigState {
  teamLimits: TeamLimits;
  loading: boolean;
  error: string | null;
}

export const useAutoConfig = (profileId?: string) => {
  const [state, setState] = useState<AutoConfigState>({
    teamLimits: {
      currentMembers: 0,
      maxMembers: 10,
      currentTeams: 0,
      maxTeams: 3,
      canInviteMore: true,
      canJoinMore: true,
    },
    loading: false,
    error: null,
  });
  
  const { toast } = useToast();

  const loadTeamLimits = async () => {
    if (!profileId) return;
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Get current team members (as manager)
      const { data: teamMembers, error: teamError } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', profileId);
      
      if (teamError) throw teamError;

      // Get current teams (as employee)
      const { data: employeeTeams, error: employeeError } = await supabase
        .from('team_members')
        .select('*')
        .eq('member_id', profileId)
        .eq('role', 'employee');
      
      if (employeeError) throw employeeError;

      const currentMembers = teamMembers?.length || 0;
      const currentTeams = employeeTeams?.length || 0;
      
      setState(prev => ({
        ...prev,
        teamLimits: {
          currentMembers,
          maxMembers: 10,
          currentTeams,
          maxTeams: 3,
          canInviteMore: currentMembers < 10,
          canJoinMore: currentTeams < 3,
        },
        loading: false,
      }));
    } catch (error) {
      console.error('Error loading team limits:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to load team limits',
        loading: false,
      }));
    }
  };

  const setupDefaultSharingPreferences = async (userId: string, managerId: string) => {
    try {
      const { error } = await supabase.rpc('setup_default_sharing_preferences', {
        target_user_id: userId,
        target_manager_id: managerId,
      });
      
      if (error) throw error;
      
      toast({
        title: "Sharing Preferences Configured",
        description: "All sharing options have been enabled for better collaboration.",
      });
    } catch (error) {
      console.error('Error setting up sharing preferences:', error);
      toast({
        title: "Configuration Warning",
        description: "Some sharing preferences may need manual setup.",
        variant: "destructive",
      });
    }
  };

  const sendWelcomeNotification = async (userId: string, type: 'new_manager' | 'joined_team', teamName?: string) => {
    try {
      const { error } = await supabase.rpc('send_welcome_notification', {
        target_user_id: userId,
        notification_type: type,
        team_name: teamName,
      });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error sending welcome notification:', error);
    }
  };

  const validateTeamLimits = (actionType: 'invite' | 'join') => {
    if (actionType === 'invite' && !state.teamLimits.canInviteMore) {
      toast({
        title: "Team Limit Reached",
        description: `Your team has reached the maximum of ${state.teamLimits.maxMembers} members.`,
        variant: "destructive",
      });
      return false;
    }
    
    if (actionType === 'join' && !state.teamLimits.canJoinMore) {
      toast({
        title: "Team Membership Limit",
        description: `You can only be a member of ${state.teamLimits.maxTeams} teams maximum.`,
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  useEffect(() => {
    if (profileId) {
      loadTeamLimits();
    }
  }, [profileId]);

  return {
    ...state,
    loadTeamLimits,
    setupDefaultSharingPreferences,
    sendWelcomeNotification,
    validateTeamLimits,
  };
};