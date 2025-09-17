import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, MessageSquare, TrendingUp, AlertTriangle, CheckCircle, User } from 'lucide-react';

interface TeamMemberSummary {
  id: string;
  name: string;
  role?: string;
  email: string;
  oceanProfile?: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  recentInsights?: string[];
  needsAttention?: boolean;
  sessionCount?: number;
}

interface ManagementRecommendationsProps {
  teamMembers: TeamMemberSummary[];
  managerId: string;
  className?: string;
}

const ManagementRecommendations: React.FC<ManagementRecommendationsProps> = ({ 
  teamMembers, 
  managerId,
  className = "" 
}) => {
  const generateTeamRecommendations = () => {
    const recommendations = {
      teamDynamics: [] as string[],
      individualSupport: [] as Array<{member: string, action: string, priority: 'high' | 'medium' | 'low'}>,
      communication: [] as string[],
      development: [] as string[]
    };

    // Analyze team composition and generate recommendations
    if (teamMembers.length > 0) {
      const activeMembers = teamMembers.filter(m => m.sessionCount && m.sessionCount > 0);
      const membersNeedingAttention = teamMembers.filter(m => m.needsAttention);
      
      // Team dynamics recommendations
      if (activeMembers.length < teamMembers.length) {
        recommendations.teamDynamics.push("Encourage non-participating team members to engage with their development sessions");
      }
      
      if (membersNeedingAttention.length > 0) {
        recommendations.teamDynamics.push(`${membersNeedingAttention.length} team member(s) showing signs of stress - consider team check-ins`);
      }
      
      // Individual support recommendations
      activeMembers.forEach(member => {
        if (member.oceanProfile) {
          const { neuroticism, conscientiousness, extraversion } = member.oceanProfile;
          
          if (neuroticism > 0.7) {
            recommendations.individualSupport.push({
              member: member.name,
              action: "Provide additional emotional support and stress management resources",
              priority: 'high'
            });
          }
          
          if (conscientiousness < 0.4) {
            recommendations.individualSupport.push({
              member: member.name,
              action: "Offer structured goal-setting and accountability frameworks",
              priority: 'medium'
            });
          }
          
          if (extraversion < 0.3) {
            recommendations.individualSupport.push({
              member: member.name,
              action: "Create opportunities for one-on-one interactions and smaller group settings",
              priority: 'medium'
            });
          }
        }
      });
      
      // Communication recommendations
      recommendations.communication.push("Schedule regular 1:1 check-ins to discuss personal development progress");
      recommendations.communication.push("Create a safe space for team members to share challenges and wins");
      
      // Development recommendations
      recommendations.development.push("Identify team members ready for leadership development opportunities");
      recommendations.development.push("Match team members with complementary strengths for peer mentoring");
    }

    return recommendations;
  };

  const managementRecs = generateTeamRecommendations();

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'bg-red-50 border-red-200 text-red-700';
      case 'medium': return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'low': return 'bg-green-50 border-green-200 text-green-700';
    }
  };

  const getPriorityIcon = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return AlertTriangle;
      case 'medium': return TrendingUp;
      case 'low': return CheckCircle;
    }
  };

  return (
    <Card className={`${className}`}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle>Management Recommendations</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Strategic guidance for supporting your team members' development and well-being
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Team Overview */}
        <div className="space-y-3">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Team Dynamics
          </h3>
          <div className="space-y-2">
            {managementRecs.teamDynamics.length > 0 ? (
              managementRecs.teamDynamics.map((rec, index) => (
                <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium">{rec}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Your team dynamics look healthy!</p>
            )}
          </div>
        </div>

        {/* Individual Support */}
        <div className="space-y-3">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Individual Support Actions
          </h3>
          <div className="space-y-2">
            {managementRecs.individualSupport.length > 0 ? (
              managementRecs.individualSupport.map((rec, index) => {
                const PriorityIcon = getPriorityIcon(rec.priority);
                return (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg border ${getPriorityColor(rec.priority)}`}
                  >
                    <div className="flex items-start gap-3">
                      <PriorityIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{rec.member}</p>
                        <p className="text-xs mt-1 opacity-90">{rec.action}</p>
                      </div>
                      <Badge 
                        variant={rec.priority === 'high' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {rec.priority}
                      </Badge>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No immediate individual actions needed.</p>
            )}
          </div>
        </div>

        {/* Communication Strategies */}
        <div className="space-y-3">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Communication Strategies
          </h3>
          <div className="space-y-2">
            {managementRecs.communication.map((rec, index) => (
              <div key={index} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 font-medium">{rec}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Development Opportunities */}
        <div className="space-y-3">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            Development Opportunities
          </h3>
          <div className="space-y-2">
            {managementRecs.development.map((rec, index) => (
              <div key={index} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-purple-700 font-medium">{rec}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-border">
          <div className="flex gap-2">
            <Button variant="default" size="sm">
              <MessageSquare className="h-4 w-4 mr-2" />
              Schedule Check-ins
            </Button>
            <Button variant="outline" size="sm">
              <TrendingUp className="h-4 w-4 mr-2" />
              Track Team Progress
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ManagementRecommendations;