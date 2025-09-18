import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Lightbulb, 
  Users, 
  User,
  RefreshCw,
  TrendingUp,
  AlertCircle
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
}

const TeamResultsSection: React.FC<TeamResultsSectionProps> = ({
  teamMembers,
  selectedMember,
  teamStrengths,
  recommendations,
  onMemberSelect,
  loading = false,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState('overview');

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
          <CardTitle className="text-xl">Team Results</CardTitle>
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
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="overview">Team Overview</TabsTrigger>
            <TabsTrigger value="individual">Individual Member Review</TabsTrigger>
          </TabsList>

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
            {/* Member Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Select Team Member</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedMember?.id === member.id
                        ? 'bg-primary/5 border-primary/20'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => onMemberSelect(member)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {member.display_name || member.full_name}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {member.role}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Member Details */}
            {selectedMember && (
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-3">
                  Individual Analysis: {selectedMember.display_name || selectedMember.full_name}
                </h4>
                <div className="text-center py-8 text-muted-foreground">
                  <User className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Individual member analysis will be displayed here</p>
                  <p className="text-sm mt-2">Select the "Recommendations" section for detailed insights</p>
                </div>
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