import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  User, 
  Brain, 
  Target, 
  MessageCircle, 
  BarChart3,
  Eye,
  EyeOff,
  Lock
} from 'lucide-react';

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string;
  email: string;
  role: string;
  created_at: string;
  avatar_url?: string;
}

interface SharingPreferences {
  share_profile: boolean;
  share_insights: boolean;
  share_conversations: boolean;
  share_ocean_profile: boolean;
  share_progress: boolean;
  share_strengths: boolean;
  share_manager_recommendations: boolean;
}

interface MemberData {
  profile: TeamMember;
  sharingPreferences: SharingPreferences | null;
  conversations: any[];
  insights: any[];
  oceanProfile: any;
  hasData: boolean;
}

interface ManagerInsightsDashboardProps {
  teamMembers: TeamMember[];
  managerId: string;
  selectedMember: TeamMember | null;
  onMemberSelect: (member: TeamMember | null) => void;
}

const ManagerInsightsDashboard: React.FC<ManagerInsightsDashboardProps> = ({
  teamMembers,
  managerId,
  selectedMember,
  onMemberSelect
}) => {
  const [memberData, setMemberData] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMemberData();
  }, [teamMembers, managerId]);

  const loadMemberData = async () => {
    if (teamMembers.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const dataPromises = teamMembers.map(async (member) => {
        // Load sharing preferences
        const { data: sharingPrefs } = await supabase
          .from('sharing_preferences')
          .select('*')
          .eq('user_id', member.user_id)
          .eq('manager_id', managerId)
          .maybeSingle();

        // Only load data if member has sharing enabled
        let conversations: any[] = [];
        let insights: any[] = [];
        let oceanProfile: any = null;

        if (sharingPrefs) {
          // Load conversations if shared
          if (sharingPrefs.share_conversations) {
            const { data: convData } = await supabase
              .from('conversations')
              .select('*')
              .eq('user_id', member.user_id)
              .order('created_at', { ascending: false });
            conversations = convData || [];
          }

          // Load insights if shared
          if (sharingPrefs.share_insights) {
            const { data: insightData } = await supabase
              .from('key_insights')
              .select('*')
              .order('created_at', { ascending: false });
            
            if (insightData && conversations.length > 0) {
              const conversationIds = conversations.map(c => c.id);
              insights = insightData.filter(insight => 
                conversationIds.includes(insight.conversation_id)
              );
            }
          }

          // Calculate OCEAN profile if shared
          if (sharingPrefs.share_ocean_profile && insights.length > 0) {
            const personalityData = insights
              .map(i => i.personality_notes)
              .filter(Boolean);

            if (personalityData.length > 0) {
              oceanProfile = {
                openness: Math.round(personalityData.reduce((sum: number, p: any) => sum + (p?.openness || 0), 0) / personalityData.length),
                conscientiousness: Math.round(personalityData.reduce((sum: number, p: any) => sum + (p?.conscientiousness || 0), 0) / personalityData.length),
                extraversion: Math.round(personalityData.reduce((sum: number, p: any) => sum + (p?.extraversion || 0), 0) / personalityData.length),
                agreeableness: Math.round(personalityData.reduce((sum: number, p: any) => sum + (p?.agreeableness || 0), 0) / personalityData.length),
                neuroticism: Math.round(personalityData.reduce((sum: number, p: any) => sum + (p?.neuroticism || 0), 0) / personalityData.length)
              };
            }
          }
        }

        return {
          profile: member,
          sharingPreferences: sharingPrefs,
          conversations,
          insights,
          oceanProfile,
          hasData: conversations.length > 0 || insights.length > 0 || !!oceanProfile
        };
      });

      const results = await Promise.all(dataPromises);
      setMemberData(results);
    } catch (error) {
      console.error('Error loading member data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading team insights...</p>
        </div>
      </div>
    );
  }

  if (teamMembers.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground mt-4 mb-4">No team members to show insights for</p>
          <p className="text-sm text-muted-foreground">Add team members to view their shared insights</p>
        </CardContent>
      </Card>
    );
  }

  const selectedMemberData = selectedMember ? 
    memberData.find(data => data.profile.id === selectedMember.id) : null;

  return (
    <div className="space-y-6">
      {/* Member Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Select Team Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select 
            value={selectedMember?.id || ''} 
            onValueChange={(value) => {
              const member = teamMembers.find(m => m.id === value) || null;
              onMemberSelect(member);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a team member to view insights" />
            </SelectTrigger>
            <SelectContent>
              {teamMembers.map((member) => {
                const data = memberData.find(d => d.profile.id === member.id);
                const hasSharedData = data?.hasData && data?.sharingPreferences;
                
                return (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <span>{member.display_name || member.full_name}</span>
                      {hasSharedData ? (
                        <Eye className="h-3 w-3 text-success" />
                      ) : (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Team Overview */}
      {!selectedMember && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {memberData.map((data) => (
            <Card 
              key={data.profile.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onMemberSelect(data.profile)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={data.profile.avatar_url} />
                      <AvatarFallback>
                        {(data.profile.display_name || data.profile.full_name)
                          .split(' ')
                          .map(n => n[0])
                          .join('')
                          .toUpperCase()
                        }
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{data.profile.display_name || data.profile.full_name}</p>
                      <p className="text-sm text-muted-foreground">{data.profile.role}</p>
                    </div>
                  </div>
                  {data.sharingPreferences ? (
                    <Badge variant="outline" className="text-success">
                      <Eye className="w-3 h-3 mr-1" />
                      Sharing
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      <Lock className="w-3 h-3 mr-1" />
                      Private
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {data.sharingPreferences ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Sessions</span>
                      <span className="font-medium">{data.conversations.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Insights</span>
                      <span className="font-medium">{data.insights.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">OCEAN Profile</span>
                      <span className="font-medium">{data.oceanProfile ? 'Available' : 'Not available'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Lock className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground mt-2">
                      No data shared with you yet
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Individual Member Insights */}
      {selectedMember && selectedMemberData && (
        <div className="space-y-6">
          {/* Member Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedMemberData.profile.avatar_url} />
                    <AvatarFallback>
                      {(selectedMemberData.profile.display_name || selectedMemberData.profile.full_name)
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                      }
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {selectedMemberData.profile.display_name || selectedMemberData.profile.full_name}
                    </h2>
                    <p className="text-muted-foreground">{selectedMemberData.profile.email}</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => onMemberSelect(null)}
                >
                  Back to Overview
                </Button>
              </div>
            </CardContent>
          </Card>

          {selectedMemberData.sharingPreferences ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Conversation Stats */}
              {selectedMemberData.sharingPreferences.share_conversations && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" />
                      Session Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Total Sessions</span>
                        <span className="font-medium">{selectedMemberData.conversations.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Completed Sessions</span>
                        <span className="font-medium">
                          {selectedMemberData.conversations.filter(c => c.status === 'completed').length}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Last Session</span>
                        <span className="font-medium">
                          {selectedMemberData.conversations.length > 0 
                            ? new Date(selectedMemberData.conversations[0].created_at).toLocaleDateString()
                            : 'No sessions'
                          }
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* OCEAN Profile */}
              {selectedMemberData.sharingPreferences.share_ocean_profile && selectedMemberData.oceanProfile && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      OCEAN Personality Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(selectedMemberData.oceanProfile).map(([trait, value]: [string, any]) => (
                      <div key={trait} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{trait}</span>
                          <span className="font-medium">{value}%</span>
                        </div>
                        <Progress value={value} className="h-2" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Insights Summary */}
              {selectedMemberData.sharingPreferences.share_insights && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Key Insights ({selectedMemberData.insights.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedMemberData.insights.length > 0 ? (
                      <div className="space-y-4">
                        {selectedMemberData.insights.slice(0, 5).map((insight, index) => (
                          <div key={insight.id} className="p-4 border rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium">Session {index + 1}</h4>
                              <span className="text-sm text-muted-foreground">
                                {new Date(insight.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            {insight.insights && insight.insights.length > 0 && (
                              <div className="space-y-1">
                                {insight.insights.slice(0, 3).map((item: string, idx: number) => (
                                  <p key={idx} className="text-sm text-muted-foreground">
                                    • {item}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Target className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <p className="text-muted-foreground mt-4">No insights available yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Lock className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground mt-4 mb-2">
                  {selectedMemberData.profile.display_name || selectedMemberData.profile.full_name} 
                  {' '}hasn't shared any data with you yet
                </p>
                <p className="text-sm text-muted-foreground">
                  They can enable sharing from their dashboard settings
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default ManagerInsightsDashboard;