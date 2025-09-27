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
    <div className="block md:flex items-center gap-1 p-1 bg-background-contrast rounded-lg w-full md:w-auto order-2 md:order-none mt-3 md:mt-0 shadow-md" data-testid="dashboard-view-switch">
      <Button
        variant={isOnPersonalDashboard ? "default" : "ghost"}
        size="sm"
        onClick={() => navigate('/dashboard')}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all border-0",
          isOnPersonalDashboard 
            ? "bg-interactive-primary text-white shadow-md hover:bg-interactive-primary/90" 
            : "text-text-high-contrast bg-transparent hover:bg-interactive-primary/10 hover:text-interactive-primary"
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
          "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all border-0",
          isOnManagerDashboard 
            ? "bg-interactive-primary text-white shadow-md hover:bg-interactive-primary/90"
            : "text-text-high-contrast bg-transparent hover:bg-interactive-primary/10 hover:text-interactive-primary"
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
