import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Home, Users } from 'lucide-react';

const DashboardBreadcrumbs: React.FC = () => {
  const location = useLocation();
  
  const getBreadcrumbs = () => {
    const path = location.pathname;
    
    if (path === '/dashboard') {
      return [
        { label: 'Dashboard', icon: Home, isCurrentPage: true }
      ];
    }
    
    if (path.includes('/dashboard/manager')) {
      return [
        { label: 'Dashboard', icon: Home, href: '/dashboard' },
        { label: 'Manager', icon: Users, isCurrentPage: true }
      ];
    }
    
    // Default fallback
    return [
      { label: 'Dashboard', icon: Home, isCurrentPage: true }
    ];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <Breadcrumb data-testid="dashboard-breadcrumbs">
      <BreadcrumbList>
        {breadcrumbs.map((item, index) => (
          <React.Fragment key={item.label}>
            <BreadcrumbItem>
              {item.isCurrentPage ? (
                <BreadcrumbPage className="flex items-center gap-2">
                  <item.icon size={16} />
                  {item.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={item.href!} className="flex items-center gap-2 hover:text-primary">
                    <item.icon size={16} />
                    {item.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default DashboardBreadcrumbs;