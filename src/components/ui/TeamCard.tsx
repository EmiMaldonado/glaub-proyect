import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Crown, LogOut, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TeamCardProps {
  teamName: string;
  managerName: string;
  memberCount?: number;
  isManager?: boolean;
  isEmployee?: boolean;
  joinedAt?: string;
  onLeaveTeam?: () => void;
  onRemoveTeam?: () => void;
  className?: string;
}

const TeamCard: React.FC<TeamCardProps> = ({
  teamName,
  managerName,
  memberCount,
  isManager = false,
  isEmployee = false,
  joinedAt,
  onLeaveTeam,
  onRemoveTeam,
  className = ""
}) => {
  return (
    <Card className={`shadow-soft hover:shadow-md transition-shadow ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {teamName}
          </span>
          {isManager && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Crown className="h-3 w-3" />
              Manager
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {isManager ? (
            <>
              You manage this team
              {memberCount !== undefined && ` • ${memberCount} member${memberCount !== 1 ? 's' : ''}`}
            </>
          ) : (
            <>
              Managed by {managerName}
              {joinedAt && ` • Joined ${new Date(joinedAt).toLocaleDateString()}`}
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {isManager ? (
              <span>Team management</span>
            ) : (
              <span>Team member</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {isEmployee && onLeaveTeam && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <LogOut className="h-4 w-4 mr-1" />
                    Leave Team
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave Team</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to leave "{teamName}"? You will no longer have access to this team's resources and insights.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={onLeaveTeam}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Leave Team
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {isManager && onRemoveTeam && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Team
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Team</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{teamName}"? All team members will be removed and this action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={onRemoveTeam}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Team
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamCard;