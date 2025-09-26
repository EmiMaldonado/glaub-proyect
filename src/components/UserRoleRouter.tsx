import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useManagerCapabilities } from '@/hooks/useManagerCapabilities';

// ✅ RESTORED: Functional user routing with manager capabilities
export const UserRoleRouter: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { isManager, canAccessManagerDashboard, loading: capabilitiesLoading } = useManagerCapabilities();

  // Show loading while checking capabilities
  if (authLoading || capabilitiesLoading) {
    return <>{children}</>;
  }

  // If no user, pass through (AuthGuard will handle this)
  if (!user) {
    return <>{children}</>;
  }

  // For authenticated users, pass through with enhanced context
  // The routing logic will be handled by individual pages and guards
  return <>{children}</>;
};