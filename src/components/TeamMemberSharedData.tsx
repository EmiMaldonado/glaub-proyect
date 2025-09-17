import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  Eye, 
  EyeOff, 
  MessageCircle, 
  Brain, 
  BarChart3, 
  User, 
  Calendar,
  Target,
  TrendingUp,
  Lightbulb
} from 'lucide-react';

interface TeamMemberData {
  profile: {
    id: string;
    full_name: string;
    display_name: string;
    email: string;
    avatar_url?: string;
  };
  sharingPreferences: {
    share_profile: boolean;
    share_insights: boolean;
    share_conversations: boolean;
    share_ocean_profile: boolean;
    share_progress: boolean;
  };
  conversations?: any[];
  insights?: any[];
  oceanProfile?: any;
}

interface TeamMemberSharedDataProps {
  teamMembers: any[];
  managerId: string;
}

const TeamMemberSharedData: React.FC<TeamMemberSharedDataProps> = ({
  teamMembers,
  managerId
}) => {
  const [memberData, setMemberData] = useState<TeamMemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  useEffect(() => {
    if (teamMembers.length > 0 && managerId) {
      loadTeamMemberData();
    }
  }, [teamMembers, managerId]);

  const loadTeamMemberData = async () => {
    setLoading(true);
    try {
      const memberDataPromises = teamMembers.map(async (member) => {
        if (!member) return null;

        // Get sharing preferences for this member
        const { data: sharingPrefs } = await supabase
          .from('sharing_preferences')
          .select('*')
          .eq('manager_id', managerId)
          .maybeSingle();

        const memberInfo: TeamMemberData = {
          profile: member,
          sharingPreferences: sharingPrefs || {
            share_profile: false,
            share_insights: false,
            share_conversations: false,
            share_ocean_profile: false,
            share_progress: false
          }
        };

        // Load shared data based on preferences
        if (sharingPrefs?.share_conversations) {
          const { data: conversations } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', member.user_id)
            .order('created_at', { ascending: false })
            .limit(5);
          memberInfo.conversations = conversations || [];
        }

        if (sharingPrefs?.share_insights) {
          const { data: insights } = await supabase
            .from('key_insights')
            .select(`
              *,
              conversation:conversations(title, created_at)
            `)
            .in('conversation_id', 
              memberInfo.conversations?.map(c => c.id) || []
            )
            .order('created_at', { ascending: false })
            .limit(10);
          memberInfo.insights = insights || [];
        }

        // Calculate OCEAN profile if shared
        if (sharingPrefs?.share_ocean_profile && memberInfo.insights?.length > 0) {
          const personalityData = memberInfo.insights
            .map(i => i.personality_notes)
            .filter(Boolean);

          if (personalityData.length > 0) {
            memberInfo.oceanProfile = {
              openness: Math.round(personalityData.reduce((sum, p: any) => sum + (p?.openness || 0), 0) / personalityData.length),
              conscientiousness: Math.round(personalityData.reduce((sum, p: any) => sum + (p?.conscientiousness || 0), 0) / personalityData.length),
              extraversion: Math.round(personalityData.reduce((sum, p: any) => sum + (p?.extraversion || 0), 0) / personalityData.length),
              agreeableness: Math.round(personalityData.reduce((sum, p: any) => sum + (p?.agreeableness || 0), 0) / personalityData.length),
              neuroticism: Math.round(personalityData.reduce((sum, p: any) => sum + (p?.neuroticism || 0), 0) / personalityData.length),
            };
          }
        }

        return memberInfo;
      });

      const results = await Promise.all(memberDataPromises);
      setMemberData(results.filter(Boolean) as TeamMemberData[]);
    } catch (error) {
      console.error('Error loading team member data:', error);
      toast({
        title: "Error",
        description: "Failed to load team member data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderMemberCard = (member: TeamMemberData) => {
    const sharedCount = Object.values(member.sharingPreferences).filter(Boolean).length;
    const hasSharedData = sharedCount > 0;

    return (
      <Card 
        key={member.profile.id} 
        className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
          selectedMember === member.profile.id ? 'ring-2 ring-primary' : ''
        }`}
        onClick={() => setSelectedMember(
          selectedMember === member.profile.id ? null : member.profile.id
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={member.profile.avatar_url} alt={member.profile.display_name} />
              <AvatarFallback>
                {(member.profile.display_name || member.profile.full_name || member.profile.email)
                  ?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold">
                {member.profile.display_name || member.profile.full_name}
              </h3>
              <p className="text-sm text-muted-foreground">{member.profile.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {hasSharedData ? (
                <Badge variant="default" className="text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  {sharedCount} shared
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  <EyeOff className="h-3 w-3 mr-1" />
                  Private
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        {selectedMember === member.profile.id && hasSharedData && (
          <CardContent className="pt-0">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                {member.sharingPreferences.share_ocean_profile && (
                  <TabsTrigger value="personality">OCEAN</TabsTrigger>
                )}
                {member.sharingPreferences.share_insights && (
                  <TabsTrigger value="insights">Insights</TabsTrigger>
                )}
                {member.sharingPreferences.share_conversations && (
                  <TabsTrigger value="history">History</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    <span>{member.conversations?.length || 0} conversations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-secondary" />
                    <span>{member.insights?.length || 0} insights</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Last active: {member.conversations?.[0]?.created_at 
                        ? new Date(member.conversations[0].created_at).toLocaleDateString()
                        : 'Never'
                      }
                    </span>
                  </div>
                </div>
              </TabsContent>

              {member.sharingPreferences.share_ocean_profile && member.oceanProfile && (
                <TabsContent value="personality" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Openness</span>
                        <span className="font-medium">{member.oceanProfile.openness}%</span>
                      </div>
                      <Progress value={member.oceanProfile.openness} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Conscientiousness</span>
                        <span className="font-medium">{member.oceanProfile.conscientiousness}%</span>
                      </div>
                      <Progress value={member.oceanProfile.conscientiousness} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Extraversion</span>
                        <span className="font-medium">{member.oceanProfile.extraversion}%</span>
                      </div>
                      <Progress value={member.oceanProfile.extraversion} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Agreeableness</span>
                        <span className="font-medium">{member.oceanProfile.agreeableness}%</span>
                      </div>
                      <Progress value={member.oceanProfile.agreeableness} className="h-2" />
                    </div>
                  </div>
                </TabsContent>
              )}

              {member.sharingPreferences.share_insights && (
                <TabsContent value="insights" className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                        <Target className="h-4 w-4 text-green-600" />
                        Strengths
                      </h4>
                      <ul className="space-y-1">
                        {member.insights?.flatMap(i => i.insights || []).slice(0, 3).map((insight: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-600 mt-2 flex-shrink-0" />
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm flex items-center gap-2 mb-2">
                        <Lightbulb className="h-4 w-4 text-amber-600" />
                        Growth Areas
                      </h4>
                      <ul className="space-y-1">
                        {member.insights?.flatMap(i => i.next_steps || []).slice(0, 3).map((step: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-2 flex-shrink-0" />
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              )}

              {member.sharingPreferences.share_conversations && (
                <TabsContent value="history" className="space-y-3">
                  {member.conversations?.slice(0, 3).map((conversation: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-sm">{conversation.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {conversation.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(conversation.created_at).toLocaleDateString()} • 
                        {conversation.duration_minutes} min
                      </p>
                    </div>
                  ))}
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (memberData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Team Member Insights
          </CardTitle>
          <CardDescription>
            View shared data from your team members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No team members or shared data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Team Member Insights
        </CardTitle>
        <CardDescription>
          View shared data from your team members. Click on a member to see their details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {memberData.map(member => renderMemberCard(member))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamMemberSharedData;