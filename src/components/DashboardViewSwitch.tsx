import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Users, User } from 'lucide-react';
import { useManagerCapabilities } from '@/hooks/useManagerCapabilities';
import { cn } from '@/lib/utils';

const DashboardViewSwitch: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { canAccessManagerDashboard, loading } = useManagerCapabilities();

  // Don't show the switch if user can't access manager dashboard
  if (loading || !canAccessManagerDashboard) {
    return null;
  }

  const isOnManagerDashboard = location.pathname.includes('/dashboard/manager');
  const isOnPersonalDashboard = location.pathname === '/dashboard';

  const handleSwitchView = () => {
    if (isOnManagerDashboard) {
      navigate('/dashboard');
    } else {
      navigate('/dashboard/manager');
    }
  };

  return (
    <div className="flex items-center gap-2 p-1 bg-background-secondary border border-border-strong rounded-lg" data-testid="dashboard-view-switch">
      <Button
        variant={isOnPersonalDashboard ? "default" : "ghost"}
        size="sm"
        onClick={() => navigate('/dashboard')}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm transition-all",
          isOnPersonalDashboard 
            ? "bg-background shadow-sm" 
            : "text-primary hover:text-primary/80 hover:bg-primary/10"
        )}
        data-testid="personal-view-button"
      >
        <User size={16} />
        Personal
      </Button>
      
      <Button
        variant={isOnManagerDashboard ? "default" : "ghost"}
        size="sm"
        onClick={() => navigate('/dashboard/manager')}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm transition-all",
          isOnManagerDashboard 
            ? "bg-background shadow-sm"
            : "text-primary hover:text-primary/80 hover:bg-primary/10"
        )}
        data-testid="manager-view-button"
      >
        <Users size={16} />
        Manager
      </Button>
    </div>
  );
};

export default DashboardViewSwitch;