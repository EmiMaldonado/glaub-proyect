import React, { useState, useEffect } from 'react';
import { Target, Brain, MessageSquare, Sparkles, Users, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActionableSteps } from '@/hooks/useActionableSteps';
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
  const {
    user
  } = useAuth();
  const [strengths, setStrengths] = useState<StrengthsAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { actionableSteps, isLoading: stepsLoading } = useActionableSteps();
  useEffect(() => {
    generateStrengthsAnalysis();
  }, [profile, stats, oceanProfile, conversations]);
  const generateStrengthsAnalysis = async () => {
    if (!user) return;
    try {
      setIsLoading(true);

      // Generate strengths based on available data instead of calling problematic AI function
      if (oceanProfile && conversations > 0) {
        const dynamicStrengths = generateDynamicStrengths();
        setStrengths(dynamicStrengths);
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
  const generateDynamicStrengths = () => {
    const openness = oceanProfile?.openness || 50;
    const conscientiousness = oceanProfile?.conscientiousness || 50;
    const extraversion = oceanProfile?.extraversion || 50;
    const agreeableness = oceanProfile?.agreeableness || 50;
    const neuroticism = oceanProfile?.neuroticism || 50;
    const stability = 100 - neuroticism;
    let emotionalIntelligence = '';
    let softSkills = '';
    let overallStrengths = '';

    // Generate EI analysis based on OCEAN scores
    if (stability > 70) {
      emotionalIntelligence = `Your high emotional stability (${stability}%) demonstrates excellent emotional regulation and resilience under pressure. This foundation allows you to maintain clear thinking during challenging situations and provides a steady presence for others.`;
    } else if (stability > 50) {
      emotionalIntelligence = `Your moderate emotional stability (${stability}%) shows balanced emotional awareness with room for growth in stress management. You're developing good emotional regulation skills through your conversation practice.`;
    } else {
      emotionalIntelligence = `Your emotional awareness journey (${stability}% stability) shows you're actively working on emotional intelligence. Your willingness to engage in self-reflection through ${conversations} conversations demonstrates commitment to emotional growth.`;
    }

    // Generate soft skills based on extraversion and agreeableness
    if (extraversion > 60 && agreeableness > 60) {
      softSkills = `Your combination of strong social energy (${extraversion}% extraversion) and collaborative nature (${agreeableness}% agreeableness) makes you naturally effective in team environments. You likely excel at building relationships and facilitating group dynamics.`;
    } else if (agreeableness > 70) {
      softSkills = `Your high agreeableness (${agreeableness}%) indicates strong collaborative skills and natural empathy. You're likely someone others turn to for support and consensus-building in group settings.`;
    } else if (extraversion > 70) {
      softSkills = `Your high extraversion (${extraversion}%) suggests strong communication and networking abilities. You're comfortable taking initiative in social and professional situations.`;
    } else {
      softSkills = `Your thoughtful approach to interpersonal relationships, demonstrated through ${conversations} reflective conversations, shows developing soft skills in self-awareness and communication.`;
    }

    // Generate overall strengths
    const topTrait = Math.max(openness, conscientiousness, extraversion, agreeableness, stability);
    let primaryStrength = '';
    if (topTrait === openness && openness > 70) {
      primaryStrength = 'creativity and adaptability';
    } else if (topTrait === conscientiousness && conscientiousness > 70) {
      primaryStrength = 'organization and reliability';
    } else if (topTrait === extraversion && extraversion > 70) {
      primaryStrength = 'communication and leadership';
    } else if (topTrait === agreeableness && agreeableness > 70) {
      primaryStrength = 'collaboration and empathy';
    } else if (topTrait === stability && stability > 70) {
      primaryStrength = 'emotional resilience and stability';
    } else {
      primaryStrength = 'balanced personality development';
    }
    overallStrengths = `Your professional profile shows particular strength in ${primaryStrength}. Through ${conversations} conversations, you've demonstrated commitment to self-improvement and reflective thinking. This combination positions you well for roles that value both personal insight and professional growth.`;
    return {
      emotionalIntelligence,
      softSkills,
      overallStrengths
    };
  };
  const setFallbackStrengths = () => {
    if (conversations === 0) {
      setStrengths(null); // Set to null to show empty state
    } else {
      setStrengths({
        emotionalIntelligence: `Based on your ${conversations} conversations, you demonstrate growing self-awareness and emotional regulation. Your ability to engage in reflective dialogue shows promising emotional intelligence foundations.`,
        softSkills: `Through your conversation sessions, you've shown willingness to explore personal growth and engage in meaningful self-reflection. These are key indicators of strong interpersonal and communication potential.`,
        overallStrengths: `Your commitment to ${conversations} conversation sessions demonstrates self-awareness and a growth mindset. Continue building on these foundations through regular reflection and dialogue.`
      });
    }
  };
  if (isLoading) {
    return <div className="text-center py-6">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-sm text-muted-foreground">AI analyzing your strengths...</p>
      </div>;
  }
  if (!strengths) {
    return <div className="text-center py-4">
        <Target className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-muted-foreground text-sm">No strengths data available</p>
        <p className="text-xs text-muted-foreground mt-1">
          Complete a conversation to identify your strengths
        </p>
      </div>;
  }
  return <div className="space-y-6 bg-card rounded-lg shadow-soft p-6 border border-border/50">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-secondary" />
          Your soft skills profile
        </h3>
        <p className="text-sm text-muted-foreground">Based on your conversation patterns</p>
      </div>
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
      
      {/* Actionable Steps */}
      {actionableSteps && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-info" />
            <h4 className="text-sm font-medium">Actionable Steps</h4>
          </div>
          <div className="p-4 bg-info/5 rounded-lg border border-info/20">
            <p className="text-sm leading-relaxed text-foreground/90 mb-3">
              {actionableSteps.summary}
            </p>
            <ul className="space-y-2">
              {actionableSteps.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-foreground/90">
                  <CheckCircle2 className="h-3 w-3 text-info mt-1 flex-shrink-0" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {stepsLoading && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-info" />
            <h4 className="text-sm font-medium">Actionable Steps</h4>
          </div>
          <div className="p-4 bg-info/5 rounded-lg border border-info/20">
            <div className="animate-pulse">
              <div className="h-4 bg-info/20 rounded mb-2"></div>
              <div className="h-4 bg-info/20 rounded w-3/4 mb-3"></div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-info/20 rounded-full"></div>
                  <div className="h-3 bg-info/20 rounded flex-1"></div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-info/20 rounded-full"></div>
                  <div className="h-3 bg-info/20 rounded flex-1"></div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-info/20 rounded-full"></div>
                  <div className="h-3 bg-info/20 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="pt-2">
        <Button onClick={onStartConversation} className="w-full" size="sm">
          <MessageSquare className="h-4 w-4 mr-2" />
          Continue Building Your Profile
        </Button>
      </div>
    </div>;
};
export default ProfileStatusInsights;