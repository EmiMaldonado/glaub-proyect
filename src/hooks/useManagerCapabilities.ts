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

        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, can_manage_teams, role')
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

        // Use the new enhanced capabilities check function
        const { data: capabilitiesData, error: capabilitiesError } = await supabase
          .rpc('check_manager_capabilities', { profile_id: profile.id });

        if (capabilitiesError) {
          console.error('Error checking manager capabilities:', capabilitiesError);
          // Fallback to basic checks
          const isManager = profile?.can_manage_teams === true;
          const { data: employeeRelations } = await supabase
            .from('manager_employee_relationships')
            .select('id')
            .eq('manager_id', profile.id)
            .limit(1);

          const hasTeamMembers = (employeeRelations?.length || 0) > 0;
          
          setCapabilities({
            isManager,
            hasTeamMembers,
            canAccessManagerDashboard: isManager && hasTeamMembers,
            loading: false
          });
        } else {
          // Use enhanced capabilities data from database function
          const capabilities = capabilitiesData[0];
          setCapabilities({
            isManager: capabilities.is_manager,
            hasTeamMembers: capabilities.has_employees,
            canAccessManagerDashboard: capabilities.can_access_dashboard,
            loading: false
          });
        }

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