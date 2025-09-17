import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Target, 
  Brain,
  MessageCircle,
  Calendar,
  BarChart3,
  PieChart
} from 'lucide-react';

interface TeamAnalyticsData {
  overview: {
    totalMembers: number;
    activeMembers: number;
    totalSessions: number;
    averageEngagement: number;
  };
  trends: {
    sessionGrowth: number;
    engagementTrend: number;
    insightGeneration: number;
  };
  distribution: {
    sessionsByMember: Array<{ name: string; sessions: number }>;
    personalityDistribution: {
      openness: number;
      conscientiousness: number;
      extraversion: number;
      agreeableness: number;
      neuroticism: number;
    };
  };
  teamHealth: {
    overallScore: number;
    communicationScore: number;
    developmentScore: number;
    wellbeingScore: number;
  };
}

interface TeamAnalyticsDashboardProps {
  analyticsData: TeamAnalyticsData;
  dateRange: { start: Date; end: Date };
  className?: string;
}

const TeamAnalyticsDashboard: React.FC<TeamAnalyticsDashboardProps> = ({ 
  analyticsData, 
  dateRange,
  className = "" 
}) => {
  const { overview, trends, distribution, teamHealth } = analyticsData;

  const formatProgress = (value: number) => Math.round(value * 100);

  const getTrendIcon = (value: number) => {
    return value >= 0 ? TrendingUp : TrendingDown;
  };

  const getTrendColor = (value: number) => {
    if (value >= 0.1) return 'text-green-600';
    if (value >= -0.1) return 'text-amber-600';
    return 'text-red-600';
  };

  const getHealthColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 0.6) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-foreground">{overview.totalMembers}</p>
                <p className="text-sm text-muted-foreground">Total Members</p>
                <Badge variant="secondary" className="mt-1 text-xs">
                  {overview.activeMembers} active
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-foreground">{overview.totalSessions}</p>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <div className="flex items-center gap-1 mt-1">
                  {(() => {
                    const TrendIcon = getTrendIcon(trends.sessionGrowth);
                    return (
                      <>
                        <TrendIcon className={`h-3 w-3 ${getTrendColor(trends.sessionGrowth)}`} />
                        <span className={`text-xs ${getTrendColor(trends.sessionGrowth)}`}>
                          {formatProgress(Math.abs(trends.sessionGrowth))}%
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {formatProgress(overview.averageEngagement)}%
                </p>
                <p className="text-sm text-muted-foreground">Avg Engagement</p>
                <div className="flex items-center gap-1 mt-1">
                  {(() => {
                    const TrendIcon = getTrendIcon(trends.engagementTrend);
                    return (
                      <>
                        <TrendIcon className={`h-3 w-3 ${getTrendColor(trends.engagementTrend)}`} />
                        <span className={`text-xs ${getTrendColor(trends.engagementTrend)}`}>
                          {formatProgress(Math.abs(trends.engagementTrend))}%
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {formatProgress(trends.insightGeneration)}
                </p>
                <p className="text-sm text-muted-foreground">Insight Generation</p>
                <Badge variant="outline" className="mt-1 text-xs">
                  per session
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Health Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Team Health Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(teamHealth).map(([key, score]) => (
              <div key={key} className={`p-4 rounded-lg border ${getHealthColor(score)}`}>
                <div className="text-center">
                  <p className="text-2xl font-bold">{formatProgress(score)}%</p>
                  <p className="text-sm font-medium capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                  <Progress value={score * 100} className="mt-2 h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Session Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            Session Distribution by Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {distribution.sessionsByMember.map((member, index) => {
              const percentage = overview.totalSessions > 0 
                ? (member.sessions / overview.totalSessions) * 100 
                : 0;
              
              return (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{member.name}</span>
                    <span className="text-muted-foreground">
                      {member.sessions} sessions ({Math.round(percentage)}%)
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Personality Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Team Personality Profile (OCEAN Average)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(distribution.personalityDistribution).map(([trait, value]) => (
              <div key={trait} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium capitalize">{trait}</span>
                  <span className="font-medium">{formatProgress(value)}%</span>
                </div>
                <Progress value={value * 100} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Date Range Info */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              Analytics for period: {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamAnalyticsDashboard;