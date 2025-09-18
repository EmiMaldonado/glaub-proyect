import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, Target, TrendingUp, Star, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
interface PersonalRecommendationsProps {
  recommendations: {
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
}
const PersonalRecommendations: React.FC<PersonalRecommendationsProps> = ({
  recommendations: propRecommendations,
  oceanProfile,
  className = ""
}) => {
  const [recommendations, setRecommendations] = useState(propRecommendations);
  const [isLoading, setIsLoading] = useState(false);
  const [hasConversations, setHasConversations] = useState(true);
  const { toast } = useToast();
  const generatePersonalizedRecommendations = async () => {
    setIsLoading(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('generate-personal-recommendations', {
        body: { userId }
      });

      if (error) {
        console.error('Error generating recommendations:', error);
        throw error;
      }

      if (data?.recommendations) {
        setRecommendations(data.recommendations);
        setHasConversations(true);
        toast({
          title: "Recommendations Updated",
          description: "Your personal recommendations have been generated based on your latest conversation.",
        });
      } else {
        // No recommendations means no conversations
        setRecommendations(null);
        setHasConversations(false);
      }
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      setRecommendations(null);
      setHasConversations(false);
      toast({
        title: "No Conversation Data",
        description: "Complete a conversation session to get personalized recommendations.",
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
  return <Card className={`${className}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Personal Recommendations
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered recommendations based on your conversations
          </p>
        </div>
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
      </CardHeader>
      
      <CardContent className="space-y-6">
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
        return <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <h3 className="font-medium text-foreground">{label}</h3>
                <Badge variant="secondary" className="text-xs">
                  {items.length} items
                </Badge>
              </div>
              
              <div className="space-y-2">
                {items.slice(0, 3).map((item, index) => <div key={index} className={`p-3 rounded-lg border ${colorClass} flex items-start gap-3`}>
                    <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p className="text-sm font-medium">{item}</p>
                  </div>)}
              </div>
            </div>;
      })}

        
      </CardContent>
    </Card>;
};
export default PersonalRecommendations;