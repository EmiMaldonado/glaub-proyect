import React, { useState, useEffect } from 'react';
import { Target, Brain, MessageSquare, Sparkles } from 'lucide-react';
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

interface StrengthsAnalysis {
  emotionalIntelligence: string;
  softSkills: string;
  overallStrengths: string;
}

const ProfileStatusInsights: React.FC<ProfileStatusInsightsProps> = ({
  profile,
  stats,
  oceanProfile,
  conversations,
  onStartConversation
}) => {
  const { user } = useAuth();
  const [strengths, setStrengths] = useState<StrengthsAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    generateStrengthsAnalysis();
  }, [profile, stats, oceanProfile, conversations]);

  const generateStrengthsAnalysis = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Fetch conversation insights for analysis
      let insights: any[] = [];
      try {
        const result = await (supabase as any)
          .from('key_insights')
          .select('insights, personality_notes, next_steps')
          .eq('user_id', user.id);
        insights = result.data || [];
      } catch (e) {
        console.log('Could not fetch insights:', e);
      }

      // Generate AI-powered strengths analysis
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: `Analyze this user's emotional intelligence and soft skills based on their conversation data and generate a comprehensive strengths paragraph:

          User Profile:
          - Role: ${profile?.job_position || 'Not specified'}
          - Organization: ${profile?.organization || 'Not specified'}
          - Conversations Completed: ${stats.completedConversations}
          - Total Conversations: ${conversations}

          OCEAN Personality Profile: ${oceanProfile ? JSON.stringify({
            openness: oceanProfile.openness,
            conscientiousness: oceanProfile.conscientiousness,
            extraversion: oceanProfile.extraversion,
            agreeableness: oceanProfile.agreeableness,
            neuroticism: oceanProfile.neuroticism
          }) : 'Not available'}

          Conversation Insights: ${JSON.stringify(insights)}

          Generate a detailed analysis focusing on:
          1. Emotional Intelligence strengths (1-2 flowing paragraphs)
          2. Soft Skills strengths (1-2 flowing paragraphs)
          3. Overall professional strengths summary (1 paragraph)

          Write in an encouraging, professional tone. Focus on specific strengths demonstrated through their conversations and personality profile. Make it personal and actionable.
          
          Respond in JSON format: {
            "emotionalIntelligence": "paragraph about EI strengths",
            "softSkills": "paragraph about soft skills strengths", 
            "overallStrengths": "paragraph summarizing overall strengths"
          }`,
          userId: user.id,
          systemContext: 'strengths_analysis',
          skipDatabase: true
        }
      });

      if (response.data?.content) {
        try {
          const aiAnalysis = JSON.parse(response.data.content);
          setStrengths({
            emotionalIntelligence: aiAnalysis.emotionalIntelligence || '',
            softSkills: aiAnalysis.softSkills || '',
            overallStrengths: aiAnalysis.overallStrengths || ''
          });
        } catch (parseError) {
          // Fallback if JSON parsing fails
          setFallbackStrengths();
        }
      } else {
        setFallbackStrengths();
      }
    } catch (error) {
      console.error('Error generating strengths analysis:', error);
      setFallbackStrengths();
    } finally {
      setIsLoading(false);
    }
  };

  const setFallbackStrengths = () => {
    if (conversations === 0) {
      setStrengths({
        emotionalIntelligence: "Complete your first conversation to discover your emotional intelligence strengths through AI analysis of your communication patterns and responses.",
        softSkills: "Your soft skills profile will be generated once you engage in conversations, revealing insights about your collaboration, leadership, and interpersonal abilities.",
        overallStrengths: "Start a conversation with Glai to unlock personalized insights about your professional strengths based on psychological analysis of your unique communication style."
      });
    } else {
      setStrengths({
        emotionalIntelligence: `Based on your ${conversations} conversations, you demonstrate growing self-awareness and emotional regulation. Your ability to engage in reflective dialogue shows promising emotional intelligence foundations.`,
        softSkills: `Through your conversation sessions, you've shown willingness to explore personal growth and engage in meaningful self-reflection. These are key indicators of strong interpersonal and communication potential.`,
        overallStrengths: `Your commitment to ${conversations} conversation sessions demonstrates self-awareness and a growth mindset. Continue building on these foundations through regular reflection and dialogue.`
      });
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-6">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-sm text-muted-foreground">AI analyzing your strengths...</p>
      </div>
    );
  }

  if (!strengths) {
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
    <div className="space-y-6">
      {/* Emotional Intelligence */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium">Emotional Intelligence</h4>
        </div>
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-sm leading-relaxed text-foreground/90">
            {strengths.emotionalIntelligence}
          </p>
        </div>
      </div>

      {/* Soft Skills */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-success" />
          <h4 className="text-sm font-medium">Soft Skills</h4>
        </div>
        <div className="p-4 bg-success/5 rounded-lg border border-success/20">
          <p className="text-sm leading-relaxed text-foreground/90">
            {strengths.softSkills}
          </p>
        </div>
      </div>

      {/* Overall Strengths */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-warning" />
          <h4 className="text-sm font-medium">Overall Professional Strengths</h4>
        </div>
        <div className="p-4 bg-warning/5 rounded-lg border border-warning/20">
          <p className="text-sm leading-relaxed text-foreground/90">
            {strengths.overallStrengths}
          </p>
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-2">
        <Button onClick={onStartConversation} className="w-full" size="sm">
          <MessageSquare className="h-4 w-4 mr-2" />
          Continue Building Your Profile
        </Button>
      </div>
    </div>
  );
};

export default ProfileStatusInsights;