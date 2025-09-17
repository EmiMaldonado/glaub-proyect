import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, Users } from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  display_name: string;
  avatar_url: string;
}

interface TeamMemberSelectorProps {
  teamMembers: TeamMember[];
  selectedMemberId: string | null;
  onMemberSelect: (memberId: string | null) => void;
  className?: string;
}

const TeamMemberSelector: React.FC<TeamMemberSelectorProps> = ({
  teamMembers,
  selectedMemberId,
  onMemberSelect,
  className = ""
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium text-foreground">
        Select Team Member
      </label>
      <Select value={selectedMemberId || "all"} onValueChange={(value) => onMemberSelect(value === "all" ? null : value)}>
        <SelectTrigger className="w-full bg-background border border-border">
          <SelectValue placeholder="Choose a team member to analyze">
            {selectedMemberId ? (
              <div className="flex items-center gap-2">
                {(() => {
                  const member = teamMembers.find(m => m.id === selectedMemberId);
                  return member ? (
                    <>
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={member.avatar_url} alt={member.display_name || member.full_name} />
                        <AvatarFallback className="text-xs">
                          {(member.display_name || member.full_name || member.email)?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">
                        {member.display_name || member.full_name || member.email}
                      </span>
                    </>
                  ) : null;
                })()}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>All Team Members</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-background border border-border shadow-lg z-50">
          <SelectItem value="all" className="hover:bg-accent">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>All Team Members</span>
            </div>
          </SelectItem>
          {teamMembers.map((member) => (
            <SelectItem key={member.id} value={member.id} className="hover:bg-accent">
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={member.avatar_url} alt={member.display_name || member.full_name} />
                  <AvatarFallback className="text-xs">
                    {(member.display_name || member.full_name || member.email)?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {member.display_name || member.full_name || 'Unknown'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {member.email}
                  </span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default TeamMemberSelector;