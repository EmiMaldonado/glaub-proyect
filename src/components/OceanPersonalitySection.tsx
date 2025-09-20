import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Users, RefreshCw } from 'lucide-react';

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
  onRefresh?: () => void;
  hasRealData?: boolean;
}

const OceanPersonalitySection: React.FC<OceanPersonalitySectionProps> = ({
  personalityData,
  teamDescription,
  loading = false,
  onRefresh,
  hasRealData = false
}) => {
  const oceanTraits = [
    { key: 'openness', label: 'Openness', value: personalityData.openness },
    { key: 'conscientiousness', label: 'Conscientiousness', value: personalityData.conscientiousness },
    { key: 'extraversion', label: 'Extraversion', value: personalityData.extraversion },
    { key: 'agreeableness', label: 'Agreeableness', value: personalityData.agreeableness },
    { key: 'neuroticism', label: 'Stability', value: personalityData.neuroticism },
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
    <Card className="w-full h-full min-h-[400px]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Team Personality Profile (OCEAN)
            </CardTitle>
            <CardDescription className="mt-1">
              {hasRealData 
                ? "Based on real team conversation data" 
                : "Analysis based on available data - encourage team members to complete conversations for more accurate insights"
              }
            </CardDescription>
          </div>
          {onRefresh && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefresh}
              disabled={loading}
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* OCEAN Percentages Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
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

        {/* Team Analysis */}
        {teamDescription ? (
          <div className="pt-4 border-t space-y-6">
            {teamDescription.includes('**Team Profile Summary:**') ? (
              <>
                {/* Parse structured analysis */}
                {(() => {
                  const sections = teamDescription.split('**Tailored Leadership Strategies:**');
                  const profileSection = sections[0].replace('**Team Profile Summary:**', '').trim();
                  const leadershipSection = sections[1]?.trim();
                  
                  return (
                    <>
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Users className="h-4 w-4 text-primary" />
                          <h3 className="font-medium text-sm">Team Profile Summary</h3>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {profileSection}
                        </p>
                      </div>
                      
                      {leadershipSection && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Brain className="h-4 w-4 text-primary" />
                            <h3 className="font-medium text-sm">Tailored Leadership Strategies</h3>
                          </div>
                          <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                            {leadershipSection}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              /* Fallback for unstructured analysis or status messages */
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="font-medium text-sm">Team Profile Analysis</h3>
                </div>
                
                {/* Check for specific status messages */}
                {teamDescription.includes('processing') || teamDescription.includes('generating') ? (
                  <div className="text-center py-4">
                    <div className="text-sm text-muted-foreground mb-2">
                      ⏳ Generating detailed team analysis...
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Personality data is available. AI description is being generated.
                    </div>
                  </div>
                ) : teamDescription.includes('unavailable') || teamDescription.includes('service') ? (
                  <div className="text-center py-4">
                    <div className="text-sm text-amber-600 mb-2">
                      ⚠️ Analysis temporarily unavailable
                    </div>
                    <div className="text-xs text-muted-foreground max-w-md mx-auto">
                      {teamDescription}
                    </div>
                    {onRefresh && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={onRefresh}
                        className="mt-3"
                      >
                        Try Again
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {teamDescription}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          /* No description available */
          <div className="pt-4 border-t">
            <div className="text-center py-6">
              <div className="text-sm text-muted-foreground mb-2">
                ⏳ Generating team analysis...
              </div>
              <div className="text-xs text-muted-foreground">
                Team personality metrics are calculated. Detailed analysis is being generated.
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OceanPersonalitySection;