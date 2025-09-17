import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  User, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Brain, 
  Heart, 
  Target,
  MessageCircle,
  BarChart3
} from 'lucide-react';

interface IndividualMemberData {
  profile: {
    id: string;
    email: string;
    full_name: string;
    display_name: string;
    avatar_url: string;
  };
  metrics: {
    totalSessions: number;
    averageSessionLength: number;
    lastSessionDate: string | null;
    totalInsights: number;
    oceanProfile?: {
      openness: number;
      conscientiousness: number;
      extraversion: number;
      agreeableness: number;
      neuroticism: number;
    };
  };
  recentActivity: Array<{
    date: string;
    type: 'session' | 'insight';
    description: string;
  }>;
  progressTrends: {
    selfAwareness: number;
    emotionalRegulation: number;
    goalProgress: number;
    engagementLevel: number;
  };
}

interface IndividualMemberAnalysisProps {
  memberData: IndividualMemberData;
  className?: string;
}

const IndividualMemberAnalysis: React.FC<IndividualMemberAnalysisProps> = ({ 
  memberData, 
  className = "" 
}) => {
  const { profile, metrics, recentActivity, progressTrends } = memberData;

  const formatProgress = (value: number) => Math.round(value * 100);

  const getOceanTraitName = (trait: string) => {
    switch (trait) {
      case 'openness': return 'Openness';
      case 'conscientiousness': return 'Conscientiousness';
      case 'extraversion': return 'Extraversion';
      case 'agreeableness': return 'Agreeableness';
      case 'neuroticism': return 'Neuroticism';
      default: return trait;
    }
  };

  const getProgressColor = (value: number) => {
    if (value >= 0.7) return 'text-green-600';
    if (value >= 0.4) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Member Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.avatar_url} alt={profile.display_name || profile.full_name} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {(profile.display_name || profile.full_name || profile.email)?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-xl">
                {profile.display_name || profile.full_name || 'Unknown Member'}
              </CardTitle>
              <p className="text-muted-foreground">{profile.email}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary">Team Member</Badge>
                {metrics.lastSessionDate && (
                  <Badge variant="outline">
                    Last active: {new Date(metrics.lastSessionDate).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-foreground">{metrics.totalSessions}</p>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-foreground">{metrics.averageSessionLength}m</p>
                <p className="text-sm text-muted-foreground">Avg Session Length</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-foreground">{metrics.totalInsights}</p>
                <p className="text-sm text-muted-foreground">Total Insights</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-600" />
              <div>
                <p className={`text-2xl font-bold ${getProgressColor(progressTrends.engagementLevel)}`}>
                  {formatProgress(progressTrends.engagementLevel)}%
                </p>
                <p className="text-sm text-muted-foreground">Engagement Level</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Progress Trends
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {Object.entries(progressTrends).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span className={`font-medium ${getProgressColor(value)}`}>
                    {formatProgress(value)}%
                  </span>
                </div>
                <Progress value={value * 100} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* OCEAN Profile */}
      {metrics.oceanProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Personality Profile (OCEAN)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(metrics.oceanProfile).map(([trait, value]) => (
                <div key={trait} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{getOceanTraitName(trait)}</span>
                    <span className="font-medium">{formatProgress(value)}%</span>
                  </div>
                  <Progress value={value * 100} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <div className={`p-1 rounded-full ${
                    activity.type === 'session' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                  }`}>
                    {activity.type === 'session' ? 
                      <MessageCircle className="h-4 w-4" /> : 
                      <Brain className="h-4 w-4" />
                    }
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No recent activity to display</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IndividualMemberAnalysis;