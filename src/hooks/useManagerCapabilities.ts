import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ManagerCapabilities {
  isManager: boolean;
  hasTeamMembers: boolean;
  canAccessManagerDashboard: boolean;
  loading: boolean;
}

export const useManagerCapabilities = (): ManagerCapabilities => {
  const { user } = useAuth();
  const [capabilities, setCapabilities] = useState<ManagerCapabilities>({
    isManager: false,
    hasTeamMembers: false,
    canAccessManagerDashboard: false,
    loading: true,
  });

  useEffect(() => {
    const checkManagerCapabilities = async () => {
      if (!user) {
        setCapabilities({
          isManager: false,
          hasTeamMembers: false,
          canAccessManagerDashboard: false,
          loading: false,
        });
        return;
      }

      try {
        // Check if user is a manager
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, role, team_name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profile) {
          // Profile doesn't exist, user is not a manager
          setCapabilities({
            isManager: false,
            hasTeamMembers: false,
            canAccessManagerDashboard: false,
            loading: false,
          });
          return;
        }

        const isManager = profile?.can_manage_teams === true;
        let hasTeamMembers = false;

        if (isManager) {
          // Check if manager has team members using the new team_members table
          const { data: teamMembers, error: teamError } = await supabase
            .from('team_members')
            .select('member_id')
            .eq('team_id', profile.id)
            .neq('member_id', profile.id); // Exclude the manager themselves

          if (!teamError) {
            hasTeamMembers = (teamMembers?.length || 0) > 0;
          }
        }

        setCapabilities({
          isManager,
          hasTeamMembers,
          canAccessManagerDashboard: isManager && hasTeamMembers,
          loading: false,
        });
      } catch (error) {
        console.error('Error checking manager capabilities:', error);
        setCapabilities({
          isManager: false,
          hasTeamMembers: false,
          canAccessManagerDashboard: false,
          loading: false,
        });
      }
    };

    checkManagerCapabilities();
  }, [user]);

  return capabilities;
};