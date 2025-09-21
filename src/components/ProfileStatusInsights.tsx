import React, { useState, useEffect } from 'react';
import { Target, Brain, MessageSquare, TrendingUp, Sparkles, User, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileStatusInsightsProps {
  profile: any;
  stats: {
    totalConversations: number;
    completedConversations: number;
    sharedInsights: number;
    teamMembers: number;
  };
  oceanProfile: any;
  conversations: number;
  onStartConversation: () => void;
}

interface ProfileAnalysis {
  status: 'new' | 'developing' | 'established' | 'rich';
  completeness: number;
  insights: string[];
  recommendations: string[];
  nextSteps: string[];
}

const ProfileStatusInsights: React.FC<ProfileStatusInsightsProps> = ({
  profile,
  stats,
  oceanProfile,
  conversations,
  onStartConversation
}) => {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<ProfileAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    generateProfileAnalysis();
  }, [profile, stats, oceanProfile, conversations]);

  const generateProfileAnalysis = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Calculate profile completeness
      const profileFields = [
        profile?.full_name,
        profile?.display_name,
        profile?.job_position,
        profile?.organization,
        profile?.age,
        profile?.job_level
      ];
      const completedFields = profileFields.filter(field => field && field.trim()).length;
      const completeness = Math.round((completedFields / profileFields.length) * 100);

      // Determine profile status based on conversations and data richness
      let status: ProfileAnalysis['status'] = 'new';
      if (conversations >= 5 && oceanProfile && completeness > 70) {
        status = 'rich';
      } else if (conversations >= 3 && oceanProfile) {
        status = 'established';
      } else if (conversations >= 1) {
        status = 'developing';
      }

      // Generate AI-powered insights based on profile status
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: `Analyze this user's profile status and generate personalized insights:
          
          Profile Status: ${status}
          Conversations: ${conversations}
          Completed Conversations: ${stats.completedConversations}
          Profile Completeness: ${completeness}%
          Has OCEAN Data: ${!!oceanProfile}
          Profile Info: ${JSON.stringify({
            role: profile?.job_position,
            organization: profile?.organization,
            level: profile?.job_level
          })}
          
          Generate a brief analysis with:
          1. 2-3 insights about their current profile status
          2. 2-3 specific recommendations for improvement
          3. 2-3 next steps they should take
          
          Keep it encouraging and actionable. Focus on personality development and career growth.
          Respond in JSON format: {"insights": [], "recommendations": [], "nextSteps": []}`,
          userId: user.id,
          systemContext: 'profile_analysis',
          skipDatabase: true
        }
      });

      if (response.data?.content) {
        try {
          const aiAnalysis = JSON.parse(response.data.content);
          setAnalysis({
            status,
            completeness,
            insights: aiAnalysis.insights || [],
            recommendations: aiAnalysis.recommendations || [],
            nextSteps: aiAnalysis.nextSteps || []
          });
        } catch (parseError) {
          // Fallback if JSON parsing fails
          setFallbackAnalysis(status, completeness);
        }
      } else {
        setFallbackAnalysis(status, completeness);
      }
    } catch (error) {
      console.error('Error generating profile analysis:', error);
      setFallbackAnalysis('new', 0);
    } finally {
      setIsLoading(false);
    }
  };

  const setFallbackAnalysis = (status: ProfileAnalysis['status'], completeness: number) => {
    const fallbackAnalyses = {
      new: {
        insights: [
          "Your profile is just getting started - there's tremendous potential ahead",
          "Each conversation will reveal new aspects of your personality and strengths"
        ],
        recommendations: [
          "Complete your first conversation to begin personality analysis",
          "Fill out your profile information for more personalized insights"
        ],
        nextSteps: [
          "Start your first conversation with Glai",
          "Set aside 10-15 minutes for a meaningful dialogue"
        ]
      },
      developing: {
        insights: [
          "Your personality profile is beginning to take shape",
          "Early patterns in your communication style are emerging"
        ],
        recommendations: [
          "Continue regular conversations to deepen your profile",
          "Explore different topics to reveal more personality dimensions"
        ],
        nextSteps: [
          "Schedule your next conversation session",
          "Review your current insights for patterns"
        ]
      },
      established: {
        insights: [
          "Your personality profile shows consistent patterns across sessions",
          "You have solid foundation of insights to build upon"
        ],
        recommendations: [
          "Focus on applying insights to real-world situations",
          "Consider sharing insights with your manager for development discussions"
        ],
        nextSteps: [
          "Set specific goals based on your personality insights",
          "Schedule regular check-ins to track progress"
        ]
      },
      rich: {
        insights: [
          "You have a comprehensive personality profile with deep insights",
          "Your data shows strong self-awareness and continuous growth"
        ],
        recommendations: [
          "Use your insights to mentor others and share experiences",
          "Consider advanced development opportunities based on your profile"
        ],
        nextSteps: [
          "Leverage your insights for strategic career planning",
          "Explore leadership development opportunities"
        ]
      }
    };

    setAnalysis({
      status,
      completeness,
      ...fallbackAnalyses[status]
    });
  };

  const getStatusIcon = () => {
    switch (analysis?.status) {
      case 'rich': return <Sparkles className="h-6 w-6 text-primary" />;
      case 'established': return <CheckCircle className="h-6 w-6 text-success" />;
      case 'developing': return <TrendingUp className="h-6 w-6 text-warning" />;
      default: return <User className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (analysis?.status) {
      case 'rich': return 'bg-primary/5 border-primary/20';
      case 'established': return 'bg-success/5 border-success/20';
      case 'developing': return 'bg-warning/5 border-warning/20';
      default: return 'bg-muted/30 border-muted-foreground/20';
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-6">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-sm text-muted-foreground">AI analyzing your profile...</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-4">
        <Target className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-muted-foreground text-sm">No strengths data available</p>
        <p className="text-xs text-muted-foreground mt-1">
          Complete a conversation to identify your strengths
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Profile Status Header */}
      <Card className={`${getStatusColor()} border`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {getStatusIcon()}
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">
                Profile Status: {analysis.status.charAt(0).toUpperCase() + analysis.status.slice(1)}
              </h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <span>{conversations} conversations</span>
                <span>•</span>
                <span>{analysis.completeness}% complete</span>
              </div>
              <p className="text-xs leading-relaxed">
                {analysis.insights[0]}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">AI Profile Analysis</span>
        </div>
        
        {analysis.insights.slice(1).map((insight, index) => (
          <div key={index} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
            <span className="text-sm leading-relaxed">{insight}</span>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-warning" />
          <span className="text-sm font-medium">Recommendations</span>
        </div>
        
        {analysis.recommendations.map((rec, index) => (
          <div key={index} className="flex items-start gap-3 p-3 bg-warning/5 rounded-lg border border-warning/20">
            <div className="w-2 h-2 rounded-full bg-warning mt-2 flex-shrink-0" />
            <span className="text-sm leading-relaxed">{rec}</span>
          </div>
        ))}
      </div>

      {/* Next Steps */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-success" />
          <span className="text-sm font-medium">Next Steps</span>
        </div>
        
        {analysis.nextSteps.map((step, index) => (
          <div key={index} className="flex items-start gap-3 p-3 bg-success/5 rounded-lg border border-success/20">
            <div className="w-2 h-2 rounded-full bg-success mt-2 flex-shrink-0" />
            <span className="text-sm leading-relaxed">{step}</span>
          </div>
        ))}
      </div>

      {/* Action Button */}
      <div className="pt-2">
        <Button onClick={onStartConversation} className="w-full" size="sm">
          <MessageSquare className="h-4 w-4 mr-2" />
          Start New Conversation
        </Button>
      </div>
    </div>
  );
};

export default ProfileStatusInsights;