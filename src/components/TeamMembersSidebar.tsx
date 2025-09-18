import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, User, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string;
  email: string;
  role: string;
  created_at: string;
}

interface TeamMembersSidebarProps {
  teamMembers: TeamMember[];
  onMemberSelect?: (member: TeamMember | null) => void;
  selectedMember?: TeamMember | null;
  onTeamUpdate?: () => void;
  onAddMember?: () => void;
}

const TeamMembersSidebar: React.FC<TeamMembersSidebarProps> = ({
  teamMembers,
  onMemberSelect,
  selectedMember,
  onTeamUpdate,
  onAddMember
}) => {
  const handleRemoveMember = async (member: TeamMember) => {
    try {
      // Remove the member by setting their manager_id to null
      const { error } = await supabase
        .from('profiles')
        .update({ manager_id: null })
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: "Member Removed",
        description: `${member.display_name || member.full_name} has been removed from the team.`,
      });

      // Update the team data
      if (onTeamUpdate) {
        onTeamUpdate();
      }

      // Clear selection if the removed member was selected
      if (selectedMember?.id === member.id && onMemberSelect) {
        onMemberSelect(null);
      }
    } catch (error: any) {
      console.error('Error removing team member:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove team member",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-lg">Your Team</CardTitle>
        <Button onClick={onAddMember} variant="outline" size="sm" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Member
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {teamMembers.length === 0 ? (
          <div className="text-center py-8">
            <User className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground mt-4 mb-4">No team members yet</p>
          </div>
        ) : (
          teamMembers.map((member) => (
            <div 
              key={member.id}
              className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedMember?.id === member.id 
                  ? 'bg-primary/5 border-primary/20' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => onMemberSelect?.(member)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {member.display_name || member.full_name}
                  </p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {member.role}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveMember(member);
                }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 p-1 h-8 w-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default TeamMembersSidebar;