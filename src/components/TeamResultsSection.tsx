import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CheckCircle2, 
  Lightbulb, 
  Users, 
  User,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  ChevronDown
} from 'lucide-react';

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string;
  email: string;
  role: string;
  created_at: string;
}

interface TeamStrength {
  title: string;
  description: string;
}

interface Recommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
}

interface TeamResultsSectionProps {
  teamMembers: TeamMember[];
  selectedMember: TeamMember | null;
  teamStrengths: TeamStrength[];
  recommendations: Recommendation[];
  onMemberSelect: (member: TeamMember) => void;
  loading?: boolean;
  onRefresh?: () => void;
  analyticsData?: any;
  teamDescription?: string;
  cacheStatus?: 'cached' | 'fresh';
}

const TeamResultsSection: React.FC<TeamResultsSectionProps> = ({
  teamMembers,
  selectedMember,
  teamStrengths,
  recommendations,
  onMemberSelect,
  loading = false,
  onRefresh,
  analyticsData,
  teamDescription,
  cacheStatus = 'fresh'
}) => {
  const [activeTab, setActiveTab] = useState('overview');

  // Auto-select first member if none is selected and members exist
  useEffect(() => {
    if (!selectedMember && teamMembers.length > 0) {
      onMemberSelect(teamMembers[0]);
    }
  }, [teamMembers, selectedMember, onMemberSelect]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'communication': return <Users className="h-4 w-4" />;
      case 'productivity': return <TrendingUp className="h-4 w-4" />;
      case 'development': return <Lightbulb className="h-4 w-4" />;
      case 'wellbeing': return <CheckCircle2 className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl">Team Results</CardTitle>
            {cacheStatus === 'cached' && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                📋 Cached
              </span>
            )}
          </div>
          {onRefresh && (
            <Button onClick={onRefresh} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex gap-8 border-b border-border mb-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-2 text-base font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-[#BCD2C8] text-[#BCD2C8]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Team overview
            </button>
            <button
              onClick={() => setActiveTab('individual')}
              className={`pb-2 text-base font-medium border-b-2 transition-colors ${
                activeTab === 'individual'
                  ? 'border-[#BCD2C8] text-[#BCD2C8]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Individual member review
            </button>
          </div>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Team Strengths */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <h3 className="text-lg font-semibold">Team Strengths</h3>
              </div>
              
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-muted rounded mb-2"></div>
                      <div className="h-3 bg-muted rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="space-y-3">
                  {teamStrengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{strength.title}</p>
                        <p className="text-sm text-muted-foreground">{strength.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="individual" className="space-y-6 mt-6">
            {/* Member Selection Dropdown */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Select Team Member</h3>
              <Select
                value={selectedMember?.id || ''}
                onValueChange={(value) => {
                  const member = teamMembers.find(m => m.id === value);
                  if (member) onMemberSelect(member);
                }}
              >
                <SelectTrigger className="w-full bg-background border border-input z-50">
                  <SelectValue placeholder="Choose a team member">
                    {selectedMember && (
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="h-3 w-3 text-primary" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {selectedMember.display_name || selectedMember.full_name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {selectedMember.role}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-background border border-input shadow-lg z-50">
                  {teamMembers.map((member) => (
                    <SelectItem 
                      key={member.id} 
                      value={member.id}
                      className="cursor-pointer hover:bg-muted focus:bg-muted"
                    >
                      <div className="flex items-center gap-3 py-1">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="h-3 w-3 text-primary" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {member.display_name || member.full_name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {member.role}
                          </Badge>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected Member Details */}
            {selectedMember && (
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-3">
                  Individual Analysis: {selectedMember.display_name || selectedMember.full_name}
                </h4>
                
                {analyticsData ? (
                  <div className="space-y-4">
                    {/* Member Activity Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <div className="text-lg font-semibold text-primary">
                          {analyticsData.distribution.sessionsByMember.find(
                            m => m.name === (selectedMember.display_name || selectedMember.full_name)
                          )?.sessions || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Sessions Completed</div>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <div className="text-lg font-semibold text-primary">
                          {selectedMember.can_manage_teams === true ? 'Manager' : 'Team Member'}
                        </div>
                        <div className="text-xs text-muted-foreground">Role</div>
                      </div>
                    </div>

                    {/* Member OCEAN Profile Contribution */}
                    <div className="p-4 border rounded-lg">
                      <h5 className="font-medium mb-2">Personality Contribution to Team</h5>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>• Contributing to team's {analyticsData.distribution.personalityDistribution.conscientiousness > 70 ? 'organized and structured approach' : 'flexible working style'}</p>
                        <p>• Supports team's {analyticsData.distribution.personalityDistribution.agreeableness > 65 ? 'collaborative environment' : 'direct communication style'}</p>
                        <p>• Enhances team's {analyticsData.distribution.personalityDistribution.openness > 60 ? 'innovative thinking' : 'practical problem-solving'}</p>
                      </div>
                    </div>

                    {/* Individual Recommendations */}
                    <div className="p-4 border rounded-lg">
                      <h5 className="font-medium mb-2">Development Opportunities</h5>
                      <div className="text-sm text-muted-foreground">
                        {(() => {
                          const memberSessions = analyticsData.distribution.sessionsByMember.find(
                            m => m.name === (selectedMember.display_name || selectedMember.full_name)
                          )?.sessions || 0;
                          
                          if (memberSessions === 0) {
                            return "Encourage to start participating in team sessions to build engagement and contribute to team dynamics.";
                          } else if (memberSessions < 5) {
                            return "Continue building momentum with regular session participation to maximize personal and team growth.";
                          } else {
                            return "Excellent engagement! Consider mentoring other team members or taking on leadership opportunities.";
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>Loading individual member analysis...</p>
                    <p className="text-sm mt-2">Team data is being processed</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Leadership Recommendations Section */}
        <div className="mt-8 pt-6 border-t space-y-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Recommendations for you as Leadership</h3>
          </div>
          
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse p-4 border rounded-lg">
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-3 bg-muted rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(rec.category)}
                      <h4 className="font-medium">{rec.title}</h4>
                    </div>
                    <Badge variant={getPriorityColor(rec.priority)}>
                      {rec.priority} priority
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {rec.description}
                  </p>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {rec.category}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamResultsSection;