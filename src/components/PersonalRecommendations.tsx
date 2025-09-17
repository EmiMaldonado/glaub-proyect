import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, Target, TrendingUp, Star, ArrowRight, CheckCircle2 } from 'lucide-react';
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
  recommendations,
  oceanProfile,
  className = ""
}) => {
  const generatePersonalizedRecommendations = () => {
    const personal = {
      development: ["Schedule 15 minutes daily for self-reflection to strengthen self-awareness", "Practice active listening in your next three conversations", "Set one specific, measurable goal for this week and track your progress"],
      wellness: ["Try a 5-minute breathing exercise when you feel overwhelmed", "Establish a consistent evening routine to improve sleep quality", "Take short walks during work breaks to boost mental clarity"],
      skills: ["Focus on improving emotional regulation during stressful situations", "Develop your communication skills by asking more open-ended questions", "Practice saying 'no' to commitments that don't align with your priorities"],
      goals: ["Create a personal development plan with 3 monthly objectives", "Build stronger relationships by reaching out to one colleague weekly", "Establish boundaries that protect your energy and well-being"]
    };

    // Customize based on OCEAN profile if available
    if (oceanProfile) {
      if (oceanProfile.openness > 0.7) {
        personal.development.push("Explore creative problem-solving techniques in your work");
      }
      if (oceanProfile.conscientiousness < 0.4) {
        personal.skills.push("Use time-blocking techniques to improve task completion");
      }
      if (oceanProfile.extraversion < 0.4) {
        personal.wellness.push("Practice small social interactions to build confidence");
      }
      if (oceanProfile.neuroticism > 0.6) {
        personal.wellness.push("Develop stress management strategies and regular check-ins with yourself");
      }
    }
    return personal;
  };
  const personalRecs = recommendations || generatePersonalizedRecommendations();
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
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <CardTitle>Your Personal Recommendations</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Tailored suggestions based on your conversation patterns and personal growth areas
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(personalRecs).map(([category, items]) => {
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

        {/* Action Buttons */}
        
      </CardContent>
    </Card>;
};
export default PersonalRecommendations;