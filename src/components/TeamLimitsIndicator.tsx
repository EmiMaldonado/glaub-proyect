import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Users, UserCheck } from 'lucide-react';

interface TeamLimitsIndicatorProps {
  currentMembers: number;
  maxMembers: number;
  currentTeams: number;
  maxTeams: number;
  userRole?: string;
}

const TeamLimitsIndicator: React.FC<TeamLimitsIndicatorProps> = ({
  currentMembers,
  maxMembers,
  currentTeams,
  maxTeams,
  userRole = 'employee',
}) => {
  const memberProgress = (currentMembers / maxMembers) * 100;
  const teamProgress = (currentTeams / maxTeams) * 100;
  
  const getMemberStatusColor = () => {
    if (memberProgress >= 90) return 'destructive';
    if (memberProgress >= 70) return 'secondary';
    return 'default';
  };
  
  const getTeamStatusColor = () => {
    if (teamProgress >= 90) return 'destructive';
    if (teamProgress >= 70) return 'secondary';
    return 'default';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4" />
          Team Limits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {userRole === 'manager' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Team Members</span>
              <Badge variant={getMemberStatusColor()}>
                {currentMembers}/{maxMembers}
              </Badge>
            </div>
            <Progress value={memberProgress} className="h-2" />
            {currentMembers >= maxMembers && (
              <p className="text-xs text-muted-foreground">
                Team is at maximum capacity. Remove members to invite new ones.
              </p>
            )}
            {currentMembers >= maxMembers * 0.8 && currentMembers < maxMembers && (
              <p className="text-xs text-muted-foreground">
                Team is almost full. {maxMembers - currentMembers} spots remaining.
              </p>
            )}
          </div>
        )}
        
        {userRole === 'employee' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Team Memberships</span>
              <Badge variant={getTeamStatusColor()}>
                {currentTeams}/{maxTeams}
              </Badge>
            </div>
            <Progress value={teamProgress} className="h-2" />
            {currentTeams >= maxTeams && (
              <p className="text-xs text-muted-foreground">
                You've reached the maximum number of teams you can join.
              </p>
            )}
            {currentTeams >= maxTeams * 0.8 && currentTeams < maxTeams && (
              <p className="text-xs text-muted-foreground">
                You can join {maxTeams - currentTeams} more team(s).
              </p>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-2 pt-2 border-t">
          <UserCheck className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Limits help maintain effective team sizes and collaboration
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamLimitsIndicator;