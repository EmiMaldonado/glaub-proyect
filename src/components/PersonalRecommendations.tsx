import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Lightbulb, Target, TrendingUp, BookOpen, ArrowRight, RefreshCw, ChevronDown, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
interface RecommendationItem {
  title: string;
  description: string;
  specific_context?: string;
  session_context?: string;
  session_insight?: string;
  pattern_analysis?: string;
  consolidated_advice?: string;
  progress_tracking?: string;
  behavioral_pattern?: string;
  actionable_steps?: string[];
  next_actions?: string[];
  growth_opportunity?: string;
  sessions_count?: number;
  frequency?: string;
  sessions_involved?: string[];
}

interface PersonalRecommendationsProps {
  context: 'last_session' | 'historical';
  period?: 'last_week' | 'last_month' | 'last_3_months';
  sessionId?: string;
  recommendations?: {
    skill_building: RecommendationItem[];
    goal_achievement: RecommendationItem[];
    personal_development: RecommendationItem[];
  };
  className?: string;
  onShareToggle?: (category: string, shared: boolean) => void;
}
const PersonalRecommendations: React.FC<PersonalRecommendationsProps> = ({
  context,
  period = 'last_week',
  sessionId,
  recommendations: propRecommendations,
  className = "",
  onShareToggle
}) => {
  const [recommendations, setRecommendations] = useState(propRecommendations);
  const [isLoading, setIsLoading] = useState(false);
  const [hasConversations, setHasConversations] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    skill_building: true,
    goal_achievement: true,
    personal_development: true
  });
  const [shareSettings, setShareSettings] = useState<Record<string, boolean>>({
    skill_building: false,
    goal_achievement: false,
    personal_development: false
  });
  const { toast } = useToast();
  const generatePersonalizedRecommendations = async () => {
    setIsLoading(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const functionName = context === 'historical' ? 'generate-historical-data' : 'generate-personal-recommendations';
      const body = context === 'historical' 
        ? { userId, period }
        : { userId, sessionId };

      const { data, error } = await supabase.functions.invoke(functionName, { body });

      if (error) {
        console.error('Error generating recommendations:', error);
        throw error;
      }

      if (data?.recommendations || data?.aggregated_recommendations) {
        const newRecommendations = context === 'historical' 
          ? data.aggregated_recommendations 
          : data.recommendations;
        setRecommendations(newRecommendations);
        setHasConversations(true);
        toast({
          title: "Recommendations Updated",
          description: context === 'historical' 
            ? "Your consolidated recommendations have been generated from the selected period."
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
  }, [propRecommendations, context, period, sessionId]);

  const handleShareToggle = (category: string, shared: boolean) => {
    setShareSettings(prev => ({ ...prev, [category]: shared }));
    onShareToggle?.(category, shared);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  // Don't show anything if there are no conversations and no recommendations
  if (!recommendations && !isLoading && !hasConversations) {
    return null;
  }

  const categoryIcons = {
    skill_building: Target,
    goal_achievement: TrendingUp,
    personal_development: BookOpen
  };

  const categoryLabels = {
    skill_building: "Skill Building",
    goal_achievement: "Goal Achievement", 
    personal_development: "Personal Development"
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'last_week': return 'last week';
      case 'last_month': return 'last month';
      case 'last_3_months': return 'last 3 months';
      default: return period;
    }
  };
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Personal Recommendations
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {context === 'historical' 
                ? `Consolidated suggestions from your ${getPeriodLabel()} conversation patterns`
                : 'Tailored suggestions based on your conversation patterns and personal growth areas'
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Share2 className="h-4 w-4" />
              <span>Share with manager</span>
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
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Generating AI-powered recommendations...</span>
          </div>
        )}
        
        {!isLoading && recommendations && Object.entries(recommendations).map(([category, items]) => {
          const Icon = categoryIcons[category as keyof typeof categoryIcons];
          const label = categoryLabels[category as keyof typeof categoryLabels];
          const isExpanded = expandedSections[category];
          
          return (
            <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleSection(category)}>
              <div className="border rounded-lg">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-4 hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-primary" />
                      <h4 className="font-medium text-left">{label}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {items.length} Items
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={shareSettings[category]} 
                        onCheckedChange={(checked) => handleShareToggle(category, checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="scale-75"
                      />
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-3">
                    {context === 'historical' && (
                      <p className="text-xs text-muted-foreground italic">
                        Based on patterns from {getPeriodLabel()}
                      </p>
                    )}
                    
                    <div className="space-y-3">
                      {items.map((item, index) => (
                        <div key={index} className="bg-muted/30 p-3 rounded-lg border">
                          <div className="flex items-start gap-3">
                            <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                            <div className="space-y-2 flex-1">
                              <h5 className="font-medium text-sm">{item.title}</h5>
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                              
                              {context === 'last_session' && item.specific_context && (
                                <p className="text-xs text-muted-foreground bg-blue-50 p-2 rounded border-l-2 border-blue-200">
                                  {item.specific_context}
                                </p>
                              )}
                              
                              {context === 'historical' && item.pattern_analysis && (
                                <p className="text-xs text-muted-foreground bg-amber-50 p-2 rounded border-l-2 border-amber-200">
                                  Pattern: {item.pattern_analysis}
                                </p>
                              )}
                              
                              {item.actionable_steps && item.actionable_steps.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-xs font-medium">Action Steps:</p>
                                  <ul className="text-xs text-muted-foreground space-y-1 ml-2">
                                    {item.actionable_steps.map((step, stepIndex) => (
                                      <li key={stepIndex} className="flex items-start gap-1">
                                        <span className="text-primary">•</span>
                                        {step}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {context === 'historical' && (item.sessions_count || item.frequency) && (
                                <div className="flex gap-4 text-xs text-muted-foreground">
                                  {item.sessions_count && (
                                    <span>📊 {item.sessions_count} sessions</span>
                                  )}
                                  {item.frequency && (
                                    <span>📈 {item.frequency}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
};
export default PersonalRecommendations;