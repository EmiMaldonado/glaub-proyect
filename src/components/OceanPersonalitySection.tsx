import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Users } from 'lucide-react';

interface PersonalityDistribution {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

interface OceanPersonalitySectionProps {
  personalityData: PersonalityDistribution;
  teamDescription?: string;
  loading?: boolean;
}

const OceanPersonalitySection: React.FC<OceanPersonalitySectionProps> = ({
  personalityData,
  teamDescription,
  loading = false
}) => {
  const oceanTraits = [
    { key: 'openness', label: 'Openness', value: personalityData.openness },
    { key: 'conscientiousness', label: 'Conscientiousness', value: personalityData.conscientiousness },
    { key: 'extraversion', label: 'Extraversion', value: personalityData.extraversion },
    { key: 'agreeableness', label: 'Agreeableness', value: personalityData.agreeableness },
    { key: 'neuroticism', label: 'Neuroticism', value: personalityData.neuroticism },
  ];

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Team Personality Profile (OCEAN)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="text-center">
                  <div className="h-8 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded"></div>
                </div>
              ))}
            </div>
            <div className="h-16 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Team Personality Profile (OCEAN)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* OCEAN Percentages Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {oceanTraits.map((trait) => (
            <div key={trait.key} className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">
                {trait.value}%
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                {trait.label}
              </div>
            </div>
          ))}
        </div>

        {/* Team Description */}
        {teamDescription && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Team Profile Description</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {teamDescription}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OceanPersonalitySection;