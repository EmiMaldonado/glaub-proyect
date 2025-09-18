import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  User, 
  Target, 
  MessageCircle, 
  TrendingUp, 
  AlertCircle, 
  RefreshCw,
  Clock,
  CheckCircle2,
  Lightbulb,
  Brain
} from 'lucide-react';
import { useIndividualRecommendations } from '@/hooks/useIndividualRecommendations';

interface TeamMember {
  id: string;
  display_name: string;
  full_name: string;
  role: string;
}

interface IndividualRecommendationsDashboardProps {
  managerId: string;
  member: TeamMember;
}

const IndividualRecommendationsDashboard: React.FC<IndividualRecommendationsDashboardProps> = ({
  managerId,
  member
}) => {
  const { data, loading, error, generateRecommendations, clearCache } = useIndividualRecommendations();

  useEffect(() => {
    if (managerId && member) {
      generateRecommendations(managerId, member);
    }
  }, [managerId, member, generateRecommendations]);

  const handleRefresh = () => {
    clearCache(managerId, member.id).then(() => {
      generateRecommendations(managerId, member);
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
      case 'communication': return <MessageCircle className="h-4 w-4" />;
      case 'development': return <TrendingUp className="h-4 w-4" />;
      case 'motivation': return <Target className="h-4 w-4" />;
      case 'performance': return <CheckCircle2 className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (!member) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <User className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground mt-4">No team member selected</p>
          <p className="text-sm text-muted-foreground">Select a team member to view personalized recommendations</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <RefreshCw className="mx-auto h-8 w-8 text-primary animate-spin" />
          <p className="text-muted-foreground mt-4">
            Generating personalized recommendations for {member.display_name || member.full_name}...
          </p>
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
          <Button onClick={() => generateRecommendations(managerId, member)} variant="outline">
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
          <h2 className="text-2xl font-bold text-foreground">
            {member.display_name || member.full_name}
          </h2>
          <p className="text-muted-foreground">Personalized management recommendations</p>
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

      {/* Member Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Personality Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-sm mb-2 text-green-700">Key Strengths</h4>
              <ul className="space-y-1">
                {data.memberAnalysis.strengths.map((strength, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-sm mb-2 text-blue-700">Growth Areas</h4>
              <ul className="space-y-1">
                {data.memberAnalysis.growthAreas.map((area, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-3 w-3 text-blue-500" />
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-medium text-sm mb-2">Communication Style</h4>
            <p className="text-sm text-muted-foreground">{data.memberAnalysis.communicationStyle}</p>
          </div>

          <div>
            <h4 className="font-medium text-sm mb-2">Motivation Factors</h4>
            <div className="flex flex-wrap gap-2">
              {data.memberAnalysis.motivationFactors.map((factor, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {factor}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Personalized Recommendations
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

      {/* Leadership Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Leadership Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.leadershipTips.map((tip, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <h4 className="font-medium text-sm text-blue-700">{tip.situation}</h4>
                
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium text-green-700">APPROACH:</span>
                    <p className="text-sm text-muted-foreground mt-1">{tip.approach}</p>
                  </div>
                  
                  <div>
                    <span className="text-xs font-medium text-red-700">AVOID:</span>
                    <p className="text-sm text-muted-foreground mt-1">{tip.avoid}</p>
                  </div>
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

export default IndividualRecommendationsDashboard;