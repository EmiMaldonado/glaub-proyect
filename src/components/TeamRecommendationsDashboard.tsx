import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Lightbulb, 
  Users, 
  TrendingUp, 
  AlertCircle, 
  RefreshCw,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useTeamRecommendations } from '@/hooks/useTeamRecommendations';

interface TeamMember {
  id: string;
  display_name: string;
  full_name: string;
  role: string;
}

interface TeamRecommendationsDashboardProps {
  managerId: string;
  teamMembers: TeamMember[];
}

const TeamRecommendationsDashboard: React.FC<TeamRecommendationsDashboardProps> = ({
  managerId,
  teamMembers
}) => {
  const { data, loading, error, generateRecommendations, clearCache } = useTeamRecommendations();

  useEffect(() => {
    if (managerId && teamMembers.length > 0) {
      generateRecommendations(managerId, teamMembers);
    }
  }, [managerId, teamMembers, generateRecommendations]);

  const handleRefresh = () => {
    clearCache(managerId).then(() => {
      generateRecommendations(managerId, teamMembers);
    });
  };

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

  if (teamMembers.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground mt-4">No team members to analyze</p>
          <p className="text-sm text-muted-foreground">Add team members to generate recommendations</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <RefreshCw className="mx-auto h-8 w-8 text-primary animate-spin" />
          <p className="text-muted-foreground mt-4">Generating AI-powered team recommendations...</p>
          <p className="text-sm text-muted-foreground">This may take a few moments</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Error Loading Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => generateRecommendations(managerId, teamMembers)} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Team Recommendations</h2>
          <p className="text-muted-foreground">AI-powered insights for team management</p>
        </div>
        <div className="flex items-center gap-2">
          {data.cached && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Cached
            </div>
          )}
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Team Analysis Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Analysis Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-sm mb-2 text-green-700">Team Strengths</h4>
              <ul className="space-y-1">
                {data.teamAnalysis.strengths.map((strength, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-sm mb-2 text-amber-700">Areas for Growth</h4>
              <ul className="space-y-1">
                {data.teamAnalysis.challenges.map((challenge, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                    {challenge}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-medium text-sm mb-2">Team Dynamics</h4>
            <p className="text-sm text-muted-foreground">{data.teamAnalysis.dynamics}</p>
          </div>

          <div>
            <h4 className="font-medium text-sm mb-2">Personality Diversity</h4>
            <p className="text-sm text-muted-foreground">{data.teamAnalysis.diversity}</p>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Actionable Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.recommendations.map((rec, index) => (
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
        </CardContent>
      </Card>

      {/* Generation Info */}
      <div className="text-center text-xs text-muted-foreground">
        Generated {data.cached ? 'from cache' : 'fresh'} • {new Date(data.generatedAt).toLocaleString()}
      </div>
    </div>
  );
};

export default TeamRecommendationsDashboard;