import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  ArrowRight,
  Clock,
  Brain,
  Target,
  MessageCircle
} from 'lucide-react';

interface TeamMemberComparison {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  metrics: {
    sessions: number;
    avgSessionLength: number;
    totalInsights: number;
    engagementScore: number;
    lastActive: string;
    oceanProfile?: {
      openness: number;
      conscientiousness: number;
      extraversion: number;
      agreeableness: number;
      neuroticism: number;
    };
  };
  trends: {
    sessionTrend: number;
    engagementTrend: number;
  };
}

interface TeamComparativeViewProps {
  teamMembers: TeamMemberComparison[];
  sortBy: 'sessions' | 'engagement' | 'insights' | 'lastActive';
  onSortChange: (sortBy: 'sessions' | 'engagement' | 'insights' | 'lastActive') => void;
  className?: string;
}

const TeamComparativeView: React.FC<TeamComparativeViewProps> = ({ 
  teamMembers, 
  sortBy,
  onSortChange,
  className = "" 
}) => {
  const formatProgress = (value: number) => Math.round(value * 100);

  const getTrendIcon = (value: number) => {
    return value >= 0 ? TrendingUp : TrendingDown;
  };

  const getTrendColor = (value: number) => {
    if (value >= 0.1) return 'text-green-600';
    if (value >= -0.1) return 'text-amber-600';
    return 'text-red-600';
  };

  const getEngagementColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-amber-600';
    return 'text-red-600';
  };

  const sortedMembers = [...teamMembers].sort((a, b) => {
    switch (sortBy) {
      case 'sessions':
        return b.metrics.sessions - a.metrics.sessions;
      case 'engagement':
        return b.metrics.engagementScore - a.metrics.engagementScore;
      case 'insights':
        return b.metrics.totalInsights - a.metrics.totalInsights;
      case 'lastActive':
        return new Date(b.metrics.lastActive).getTime() - new Date(a.metrics.lastActive).getTime();
      default:
        return 0;
    }
  });

  const getRankBadge = (index: number) => {
    if (index === 0) return { variant: 'default' as const, text: '#1' };
    if (index === 1) return { variant: 'secondary' as const, text: '#2' };
    if (index === 2) return { variant: 'outline' as const, text: '#3' };
    return { variant: 'outline' as const, text: `#${index + 1}` };
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Sort Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Team Member Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
            {[
              { key: 'sessions', label: 'Sessions', icon: MessageCircle },
              { key: 'engagement', label: 'Engagement', icon: Target },
              { key: 'insights', label: 'Insights', icon: Brain },
              { key: 'lastActive', label: 'Last Active', icon: Clock }
            ].map(({ key, label, icon: Icon }) => (
              <Button
                key={key}
                variant={sortBy === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => onSortChange(key as any)}
                className="flex items-center gap-1"
              >
                <Icon className="h-3 w-3" />
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="text-left p-4 font-medium">Rank</th>
                  <th className="text-left p-4 font-medium">Member</th>
                  <th className="text-left p-4 font-medium">Sessions</th>
                  <th className="text-left p-4 font-medium">Avg Length</th>
                  <th className="text-left p-4 font-medium">Insights</th>
                  <th className="text-left p-4 font-medium">Engagement</th>
                  <th className="text-left p-4 font-medium">Trends</th>
                  <th className="text-left p-4 font-medium">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {sortedMembers.map((member, index) => {
                  const rankBadge = getRankBadge(index);
                  return (
                    <tr key={member.id} className="border-b border-border hover:bg-muted/20">
                      <td className="p-4">
                        <Badge variant={rankBadge.variant} className="text-xs">
                          {rankBadge.text}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.avatar_url} alt={member.name} />
                            <AvatarFallback className="text-xs">
                              {member.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{member.metrics.sessions}</span>
                          {(() => {
                            const TrendIcon = getTrendIcon(member.trends.sessionTrend);
                            return (
                              <div className="flex items-center gap-1">
                                <TrendIcon className={`h-3 w-3 ${getTrendColor(member.trends.sessionTrend)}`} />
                                <span className={`text-xs ${getTrendColor(member.trends.sessionTrend)}`}>
                                  {formatProgress(Math.abs(member.trends.sessionTrend))}%
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">{member.metrics.avgSessionLength}m</span>
                      </td>
                      <td className="p-4">
                        <span className="font-medium">{member.metrics.totalInsights}</span>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium text-sm ${getEngagementColor(member.metrics.engagementScore)}`}>
                              {formatProgress(member.metrics.engagementScore)}%
                            </span>
                          </div>
                          <Progress value={member.metrics.engagementScore * 100} className="h-1 w-16" />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const TrendIcon = getTrendIcon(member.trends.engagementTrend);
                            return (
                              <div className="flex items-center gap-1">
                                <TrendIcon className={`h-4 w-4 ${getTrendColor(member.trends.engagementTrend)}`} />
                                <span className={`text-xs ${getTrendColor(member.trends.engagementTrend)}`}>
                                  {formatProgress(Math.abs(member.trends.engagementTrend))}%
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {new Date(member.metrics.lastActive).toLocaleDateString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* OCEAN Profile Comparison */}
      {teamMembers.some(member => member.metrics.oceanProfile) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Personality Profile Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'].map((trait) => (
                <div key={trait} className="space-y-3">
                  <h4 className="font-medium capitalize">{trait}</h4>
                  <div className="space-y-2">
                    {sortedMembers
                      .filter(member => member.metrics.oceanProfile)
                      .map((member) => (
                        <div key={member.id} className="flex items-center gap-3">
                          <div className="w-32 text-sm text-muted-foreground truncate">
                            {member.name}
                          </div>
                          <div className="flex-1">
                            <Progress 
                              value={(member.metrics.oceanProfile?.[trait as keyof typeof member.metrics.oceanProfile] || 0) * 100} 
                              className="h-2" 
                            />
                          </div>
                          <div className="w-12 text-sm font-medium text-right">
                            {formatProgress(member.metrics.oceanProfile?.[trait as keyof typeof member.metrics.oceanProfile] || 0)}%
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TeamComparativeView;