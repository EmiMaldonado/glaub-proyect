import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Settings, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Zap,
  Shield,
  Users,
  Sparkles
} from 'lucide-react';

interface ConfigItem {
  name: string;
  status: 'enabled' | 'configured' | 'pending' | 'attention';
  description: string;
  isAutomatic?: boolean;
}

interface AutoConfigSummaryProps {
  userRole: string;
  configItems?: ConfigItem[];
  onConfigureManually?: () => void;
}

const AutoConfigSummary: React.FC<AutoConfigSummaryProps> = ({
  userRole,
  configItems,
  onConfigureManually,
}) => {
  const defaultConfigItems: ConfigItem[] = userRole === 'manager' ? [
    {
      name: 'Team Name',
      status: 'configured',
      description: 'Automatically set based on your name',
      isAutomatic: true,
    },
    {
      name: 'Sharing Preferences',
      status: 'enabled',
      description: 'Intelligent defaults enabled for new team members',
      isAutomatic: true,
    },
    {
      name: 'Team Limits',
      status: 'configured',
      description: 'Maximum 10 members per team enforced',
      isAutomatic: true,
    },
    {
      name: 'AI Recommendations',
      status: 'enabled',
      description: 'Team and individual insights automatically generated',
      isAutomatic: true,
    },
    {
      name: 'Welcome Notifications',
      status: 'enabled',
      description: 'New members receive onboarding guidance',
      isAutomatic: true,
    },
  ] : [
    {
      name: 'Sharing Preferences',
      status: 'enabled',
      description: 'All sharing options enabled for collaboration',
      isAutomatic: true,
    },
    {
      name: 'Team Membership',
      status: 'configured',
      description: 'Maximum 3 teams per employee enforced',
      isAutomatic: true,
    },
    {
      name: 'Personal Insights',
      status: 'enabled',
      description: 'Conversation analysis automatically enabled',
      isAutomatic: true,
    },
  ];

  const items = configItems || defaultConfigItems;

  const getStatusIcon = (status: ConfigItem['status']) => {
    switch (status) {
      case 'enabled':
      case 'configured':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'attention':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Settings className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: ConfigItem['status'], isAutomatic?: boolean) => {
    const variants = {
      enabled: 'default',
      configured: 'secondary',
      pending: 'outline',
      attention: 'destructive',
    } as const;

    return (
      <div className="flex items-center gap-1">
        {isAutomatic && <Zap className="h-3 w-3 text-primary" />}
        <Badge variant={variants[status]}>
          {status === 'enabled' ? 'Active' : 
           status === 'configured' ? 'Set' :
           status === 'pending' ? 'Pending' : 'Needs Attention'}
        </Badge>
      </div>
    );
  };

  const enabledCount = items.filter(item => 
    item.status === 'enabled' || item.status === 'configured'
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Auto-Configuration Summary
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            {enabledCount}/{items.length} Configured
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              {getStatusIcon(item.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{item.name}</span>
                  {getStatusBadge(item.status, item.isAutomatic)}
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {enabledCount === items.length ? (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium text-sm">All systems configured!</span>
            </div>
            <p className="text-xs text-green-700 mt-1">
              Your {userRole === 'manager' ? 'management dashboard' : 'team collaboration'} is ready to use with intelligent defaults.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-200">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium text-sm">Some items need attention</span>
            </div>
            {onConfigureManually && (
              <Button variant="outline" size="sm" onClick={onConfigureManually}>
                <Settings className="h-3 w-3 mr-1" />
                Configure
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t text-xs text-muted-foreground">
          <Zap className="h-3 w-3 text-primary" />
          <span>Items marked with lightning are automatically configured</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default AutoConfigSummary;