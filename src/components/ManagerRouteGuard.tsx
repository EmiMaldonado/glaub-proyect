import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useManagerCapabilities } from '@/hooks/useManagerCapabilities';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from './LoadingSpinner';

interface ManagerRouteGuardProps {
  children: React.ReactNode;
}

const ManagerRouteGuard: React.FC<ManagerRouteGuardProps> = ({ children }) => {
  const { canAccessManagerDashboard, loading } = useManagerCapabilities();
  const { toast } = useToast();
  const location = useLocation();

  useEffect(() => {
    // Show notification when user loses manager access and gets redirected
    if (!loading && !canAccessManagerDashboard && location.pathname.includes('/dashboard/manager')) {
      toast({
        title: "Access Updated",
        description: "You've been redirected to your personal dashboard.",
        variant: "default"
      });
    }
  }, [loading, canAccessManagerDashboard, location.pathname, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!canAccessManagerDashboard) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ManagerRouteGuard;