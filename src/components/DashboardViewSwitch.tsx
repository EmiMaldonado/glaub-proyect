import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Users, User } from 'lucide-react';
import { useManagerCapabilities } from '@/hooks/useManagerCapabilities';
import { cn } from '@/lib/utils';
// Al principio del archivo, agregar el import
import InvitationDebugger from './InvitationDebugger';

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
    <div className="flex items-center gap-2 p-1 bg-background-secondary rounded-lg mt-4 md:mt-0" data-testid="dashboard-view-switch">
      <Button
        variant={isOnPersonalDashboard ? "default" : "ghost"}
        size="sm"
        onClick={() => navigate('/dashboard')}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm transition-all",
          isOnPersonalDashboard 
            ? "bg-background shadow-sm" 
            : "text-slate-100 hover:text-slate-600 hover:bg-primary/10"
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
            : "hover:bg-primary/10"
        )}
        style={!isOnManagerDashboard ? { color: '#0D2948' } : undefined}
        data-testid="manager-view-button"
      >
        <Users size={16} />
        Manager
      </Button>
    </div>
  );
};
// Al final del componente, dentro del último </div>
{process.env.NODE_ENV === 'development' && (
  <InvitationDebugger />
)}
export default DashboardViewSwitch;
