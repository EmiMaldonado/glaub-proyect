import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Lightbulb, Target, TrendingUp, Star, ArrowRight, CheckCircle2, RefreshCw, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PersonalRecommendationsProps {
  context?: 'last_session' | 'historical';
  period?: 'last_week' | 'last_month' | 'last_3_months';
  sessionId?: string;
  recommendations?: {
    development: string[];
    wellness: string[];
    skills: string[];
    goals: string[];
  };
  oceanProfile?: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  className?: string;
  onShareToggle?: (category: string, shared: boolean) => void;
}

const PersonalRecommendations: React.FC<PersonalRecommendationsProps> = ({
  context = 'last_session',
  period = 'last_week',
  sessionId,
  recommendations: propRecommendations,
  oceanProfile,
  className = "",
  onShareToggle
}) => {
  const [recommendations, setRecommendations] = useState(propRecommendations);
  const [isLoading, setIsLoading] = useState(false);
  const [hasConversations, setHasConversations] = useState(true);
  const [shareSettings, setShareSettings] = useState<Record<string, boolean>>({
    development: false,
    wellness: false,
    skills: false,
    goals: false
  });
  const { toast } = useToast();

  const generatePersonalizedRecommendations = async () => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    // Check cache first - only regenerate if there's a new conversation
    const cacheKey = `personal_recommendations_${userId}_${context}_${period}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    // Get latest conversation ID to check if we need fresh data
    let latestConversationId;
    try {
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1);
      
      latestConversationId = conversations?.[0]?.id;
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
    
    if (cachedData && latestConversationId) {
      try {
        const parsed = JSON.parse(cachedData);
        // If we have cached data for the same conversation, use it
        if (parsed.conversationId === latestConversationId && parsed.recommendations) {
          setRecommendations(parsed.recommendations);
          setHasConversations(true);
          return;
        }
      } catch (e) {
        console.log('Cache parse error, regenerating...');
      }
    }

    setIsLoading(true);
    try {
      let data, error;
      
      if (context === 'historical') {
        // Call historical data function
        ({ data, error } = await supabase.functions.invoke('generate-historical-data', {
          body: { 
            userId,
            period: period || 'last_week'
          }
        }));
        
        if (data?.aggregated_recommendations) {
          // Transform historical data format to match expected format
          const transformedRecs = {
            development: data.aggregated_recommendations.personal_development?.map((item: any) => 
              typeof item === 'string' ? item : item.description || item.title
            ) || [],
            wellness: [], // Historical data doesn't separate wellness, add to development
            skills: data.aggregated_recommendations.skill_building?.map((item: any) => 
              typeof item === 'string' ? item : item.description || item.title
            ) || [],
            goals: data.aggregated_recommendations.goal_achievement?.map((item: any) => 
              typeof item === 'string' ? item : item.description || item.title
            ) || []
          };
          setRecommendations(transformedRecs);
          
          // Cache the result with conversation ID
          const cacheData = {
            recommendations: transformedRecs,
            conversationId: latestConversationId,
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        }
      } else {
        // Call last session function
        ({ data, error } = await supabase.functions.invoke('generate-personal-recommendations', {
          body: { userId }
        }));
        
        if (data?.recommendations) {
          setRecommendations(data.recommendations);
          
          // Cache the result with conversation ID
          const cacheData = {
            recommendations: data.recommendations,
            conversationId: latestConversationId,
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        }
      }

      if (error) {
        console.error('Error generating recommendations:', error);
        throw error;
      }

      if (data && (data.recommendations || data.aggregated_recommendations)) {
        setHasConversations(true);
        toast({
          title: "Recommendations Updated",
          description: context === 'historical' 
            ? `Your recommendations have been generated based on ${period} data.`
            : "Your personal recommendations have been generated based on your latest conversation.",
        });
      } else {
        setRecommendations(null);
        setHasConversations(false);
      }
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      setRecommendations(null);
      setHasConversations(false);
      toast({
        title: "No Conversation Data",
        description: context === 'historical' 
          ? `No conversation data available for ${period}.`
          : "Complete a conversation session to get personalized recommendations.",
        variant: "default",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load AI-generated recommendations on component mount if no props provided
  useEffect(() => {
    if (!propRecommendations) {
      generatePersonalizedRecommendations();
    }
  }, [propRecommendations]);

  const handleShareToggle = (category: string, shared: boolean) => {
    setShareSettings(prev => ({ ...prev, [category]: shared }));
    onShareToggle?.(category, shared);
  };

  // Don't show anything if there are no conversations and no recommendations
  if (!recommendations && !isLoading && !hasConversations) {
    return null;
  }

  const personalRecs = recommendations;
  const categoryIcons = {
    development: TrendingUp,
    wellness: Star,
    skills: Target,
    goals: CheckCircle2
  };

  const categoryColors = {
    development: "bg-blue-50 border-blue-200 text-blue-700",
    wellness: "bg-green-50 border-green-200 text-green-700",
    skills: "bg-purple-50 border-purple-200 text-purple-700",
    goals: "bg-amber-50 border-amber-200 text-amber-700"
  };

  const categoryLabels = {
    development: "Personal Development",
    wellness: "Wellness & Balance",
    skills: "Skill Building",
    goals: "Goal Achievement"
  };

  return (
    <div className={className}>
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Personal Recommendations</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-powered recommendations based on your conversation patterns and personal growth areas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Share2 className="h-4 w-4" />
              <span className="font-semibold">Share with manager</span>
            </div>
            <Switch 
              checked={shareSettings.summary || false} 
              onCheckedChange={(checked) => handleShareToggle('summary', checked)}
              className="scale-75"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={generatePersonalizedRecommendations}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Generating...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>
      
      <div className="space-y-6">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Generating AI-powered recommendations...</span>
          </div>
        )}
        
        {!isLoading && personalRecs && Object.entries(personalRecs).map(([category, items]) => {
          const Icon = categoryIcons[category as keyof typeof categoryIcons];
          const colorClass = categoryColors[category as keyof typeof categoryColors];
          const label = categoryLabels[category as keyof typeof categoryLabels];
          
          return (
            <div key={category} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-foreground">{label}</h4>
                  <Badge variant="secondary" className="text-xs">
                    {items.length} items
                  </Badge>
                </div>
                <Switch 
                  checked={shareSettings[category]} 
                  onCheckedChange={(checked) => handleShareToggle(category, checked)}
                  className="scale-75"
                />
              </div>
              
              <div className="space-y-2">
                {items.slice(0, 3).map((item, index) => (
                  <div key={index} className="p-3 rounded-lg border bg-gray-50 border-gray-200 text-gray-700 flex items-start gap-3">
                    <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PersonalRecommendations;