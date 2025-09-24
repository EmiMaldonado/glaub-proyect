import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ExtendedProfile } from '@/types/extended-database';

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
    loading: true
  });

  useEffect(() => {
    if (!user) {
      setCapabilities({
        isManager: false,
        hasTeamMembers: false,
        canAccessManagerDashboard: false,
        loading: false
      });
      return;
    }

    const checkManagerCapabilities = async () => {
      try {
        setCapabilities(prev => ({ ...prev, loading: true }));

        // Get user profile with extended fields
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          console.error('Error fetching user profile:', profileError);
          setCapabilities({
            isManager: false,
            hasTeamMembers: false,
            canAccessManagerDashboard: false,
            loading: false
          });
          return;
        }

        const extendedProfile = profile as any as ExtendedProfile;
        const isManager = extendedProfile?.can_manage_teams === true;
        let hasTeamMembers = false;

        if (isManager) {
          // Check if manager has team members using the new team_members table
          const { data: teamMembers, error: teamError } = await supabase
            .from('team_members')
            .select('id')
            .eq('team_id', profile.id)
            .eq('role', 'member');

          if (teamError) {
            console.error('Error checking team members:', teamError);
          } else {
            hasTeamMembers = (teamMembers?.length || 0) > 0;
          }
        }

        setCapabilities({
          isManager,
          hasTeamMembers,
          canAccessManagerDashboard: isManager,
          loading: false
        });

      } catch (error) {
        console.error('Error checking manager capabilities:', error);
        setCapabilities({
          isManager: false,
          hasTeamMembers: false,
          canAccessManagerDashboard: false,
          loading: false
        });
      }
    };

    checkManagerCapabilities();
  }, [user]);

  return capabilities;
};