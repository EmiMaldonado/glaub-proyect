import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Crown, 
  Users, 
  Settings, 
  Lightbulb, 
  CheckCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface WelcomeMessagesProps {
  userRole: string;
  teamName?: string;
  isNewManager?: boolean;
  hasTeamMembers?: boolean;
  onStartInviting?: () => void;
  onConfigureSettings?: () => void;
}

const WelcomeMessages: React.FC<WelcomeMessagesProps> = ({
  userRole,
  teamName,
  isNewManager = false,
  hasTeamMembers = false,
  onStartInviting,
  onConfigureSettings,
}) => {
  if (userRole === 'manager' && isNewManager) {
    return (
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Crown className="h-5 w-5" />
            Welcome to Management!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              Congratulations! You're now managing <strong>{teamName || 'your team'}</strong>. 
              Here's how to get started with your management dashboard.
            </AlertDescription>
          </Alert>
          
          <div className="grid gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Build Your Team</p>
                <p className="text-xs text-muted-foreground">
                  Invite up to 10 team members to collaborate
                </p>
              </div>
              {!hasTeamMembers && (
                <Button size="sm" onClick={onStartInviting}>
                  Start <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
              {hasTeamMembers && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                <Settings className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Configure Sharing</p>
                <p className="text-xs text-muted-foreground">
                  Smart defaults are enabled for better collaboration
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={onConfigureSettings}>
                Review
              </Button>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                <Lightbulb className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">AI-Powered Insights</p>
                <p className="text-xs text-muted-foreground">
                  Get personalized recommendations and team analytics
                </p>
              </div>
              <Badge variant="secondary">Auto-enabled</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (userRole === 'manager' && hasTeamMembers) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>{teamName || 'Your team'}</strong> is active! Check the Team Insights and 
          Recommendations tabs for AI-powered management guidance.
        </AlertDescription>
      </Alert>
    );
  }

  if (userRole === 'employee') {
    return (
      <Alert className="border-blue-200 bg-blue-50">
        <Users className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Welcome to the team! All sharing preferences are enabled by default to help your 
          manager provide better support. You can adjust these anytime in your settings.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

export default WelcomeMessages;