import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  UserMinus, 
  Crown,
  User,
  Calendar,
  AlertTriangle,
  Edit2,
  Save,
  X
} from 'lucide-react';
import { useTeamInvitations } from '@/hooks/useTeamInvitations';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const TeamManagementPanel: React.FC = () => {
  const { user } = useAuth();
  const { teamMembers, getTeamMembers, removeTeamMember, loading } = useTeamInvitations();
  const [teamName, setTeamName] = useState('');
  const [editingTeamName, setEditingTeamName] = useState(false);
  const [tempTeamName, setTempTeamName] = useState('');

  useEffect(() => {
    if (user) {
      loadTeamData();
    }
  }, [user]);

  const loadTeamData = async () => {
    if (!user) return;

    try {
      // Get user profile and team name
      const { data: profile } = await supabase
        .from('profiles')
        .select('team_name')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setTeamName(profile.team_name || 'My Team');
        setTempTeamName(profile.team_name || 'My Team');
      }

      // Load team members
      await getTeamMembers();
    } catch (error) {
      console.error('Error loading team data:', error);
    }
  };

  const handleSaveTeamName = async () => {
    if (!user || !tempTeamName.trim()) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_name: tempTeamName.trim() })
        .eq('user_id', user.id);

      if (error) throw error;

      setTeamName(tempTeamName.trim());
      setEditingTeamName(false);
      
      toast({
        title: "Team Name Updated",
        description: "Your team name has been updated successfully",
        variant: "default"
      });
    } catch (error: any) {
      toast({
        title: "Error Updating Team Name",
        description: error.message || 'Failed to update team name',
        variant: "destructive"
      });
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!user) return;

    // Get user profile to use as team_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) return;

    try {
      await removeTeamMember(profile.id, memberId);
      toast({
        title: "Member Removed",
        description: `${memberName} has been removed from the team`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role: string) => {
    return role === 'leader' ? (
      <Badge variant="outline" className="text-amber-600 border-amber-300">
        <Crown className="w-3 h-3 mr-1" />
        Leader
      </Badge>
    ) : (
      <Badge variant="outline" className="text-blue-600 border-blue-300">
        <User className="w-3 h-3 mr-1" />
        Member
      </Badge>
    );
  };

  const members = teamMembers.filter(member => member.role === 'member');
  const leaders = teamMembers.filter(member => member.role === 'leader');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Management
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{teamMembers.length} members</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Team Name Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Team Name</h3>
            {!editingTeamName && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setEditingTeamName(true)}
                className="flex items-center gap-1"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </Button>
            )}
          </div>
          
          {editingTeamName ? (
            <div className="flex items-center gap-2">
              <Input
                value={tempTeamName}
                onChange={(e) => setTempTeamName(e.target.value)}
                placeholder="Enter team name"
                className="flex-1"
              />
              <Button 
                size="sm" 
                onClick={handleSaveTeamName}
                disabled={!tempTeamName.trim()}
              >
                <Save className="w-4 h-4" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => {
                  setTempTeamName(teamName);
                  setEditingTeamName(false);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <p className="text-2xl font-semibold text-primary">{teamName}</p>
          )}
        </div>

        {/* Team Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{leaders.length}</div>
              <div className="text-sm text-muted-foreground">Leaders</div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{members.length}</div>
              <div className="text-sm text-muted-foreground">Members</div>
            </div>
          </Card>
        </div>

        {/* Team Members List */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Team Members</h3>
          
          {teamMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No team members yet</p>
              <p className="text-sm mt-1">Send invitations to build your team</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teamMembers.map((member) => {
                const profile = member.profile;
                if (!profile) return null;

                const displayName = profile.display_name || profile.full_name || profile.email;
                const canRemove = member.role !== 'leader';

                return (
                  <Card key={member.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={profile.avatar_url || undefined} />
                          <AvatarFallback>
                            {getInitials(displayName)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{displayName}</span>
                            {getRoleBadge(member.role)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {profile.email}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            Joined {format(new Date(member.joined_at), 'MMM d, yyyy')}
                          </div>
                        </div>
                      </div>

                      {canRemove && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.member_id, displayName)}
                          disabled={loading}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Team Limits Warning */}
        {teamMembers.length >= 8 && (
          <Card className="p-4 border-orange-200 bg-orange-50">
            <div className="flex items-center gap-2 text-orange-700">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <p className="font-medium">Team Size Limit</p>
                <p className="text-sm">Your team is approaching the maximum size of 10 members.</p>
              </div>
            </div>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamManagementPanel;