import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, BarChart3, TrendingUp, Users, Target, Clock } from 'lucide-react';

const Phase3Summary: React.FC = () => {
  const completedFeatures = [
    {
      title: 'Team Analytics Dashboard',
      description: 'Real-time team performance metrics, trends, and insights visualization',
      icon: BarChart3,
      status: 'completed'
    },
    {
      title: 'Live Statistics',
      description: 'Dynamic stat cards showing active sessions, shared insights, and team progress',
      icon: TrendingUp,
      status: 'completed'
    },
    {
      title: 'Team Health Metrics',
      description: 'Overall team wellbeing, communication, and development scores',
      icon: Target,
      status: 'completed'
    },
    {
      title: 'Member Activity Tracking',
      description: 'Session distribution, engagement levels, and individual progress tracking',
      icon: Users,
      status: 'completed'
    }
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-6 w-6 text-green-500" />
          Phase 3: Analytics & Team Insights Dashboard - Completed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {completedFeatures.map((feature, index) => (
            <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
              <div className="flex-shrink-0">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm">{feature.title}</h4>
                  <Badge variant="secondary" className="text-xs">
                    {feature.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <h4 className="font-medium text-sm mb-2">Key Implementation Details:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Real-time analytics data generation from team member activity</li>
            <li>• Visual progress tracking with personality distribution (OCEAN profile)</li>
            <li>• Team health scoring based on communication and engagement metrics</li>
            <li>• Session and insight tracking with growth trend analysis</li>
            <li>• Responsive analytics dashboard with interactive date range selection</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default Phase3Summary;