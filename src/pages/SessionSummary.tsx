import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, CheckCircle, MessageCircle, Lightbulb } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface InsightData {
  key_insights: string[];
  personality_notes: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
    summary: string;
  };
  next_steps: string[];
}

const SessionSummary = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('Analyzing conversation...');
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get conversation ID from URL params or location state
  const conversationId = new URLSearchParams(location.search).get('conversation_id') || 
                        location.state?.conversationId;

  useEffect(() => {
    if (!conversationId) {
      toast({
        title: "Error",
        description: "No conversation ID provided",
        variant: "destructive",
      });
      navigate('/dashboard');
      return;
    }

    generateInsights();
  }, [conversationId]);

  const generateInsights = async () => {
    if (!user || !conversationId) return;

    try {
      setIsProcessing(true);
      setProgress(10);
      setCurrentStep('Retrieving conversation data...');

      setProgress(30);
      setCurrentStep('Analyzing conversation with AI...');

      // Send conversation for comprehensive analysis using dedicated function
      const { data: analysisResponse, error: analysisError } = await supabase.functions.invoke('session-analysis', {
        body: {
          conversationId,
          userId: user?.id
        }
      });

      if (analysisError) {
        console.error('Session analysis error:', analysisError);
        throw new Error(`Analysis failed: ${analysisError.message}`);
      }

      if (!analysisResponse?.success) {
        throw new Error(analysisResponse?.error || 'Analysis failed');
      }

      setProgress(80);
      setCurrentStep('Processing results...');

      // Extract insights from analysis response
      const analysis = analysisResponse.analysis;
      const insightData: InsightData = {
        key_insights: analysis.key_insights || [],
        personality_notes: analysis.ocean_profile || {
          openness: 50,
          conscientiousness: 50,
          extraversion: 50,
          agreeableness: 50,
          neuroticism: 50,
          summary: "Analysis completed based on conversation data."
        },
        next_steps: analysis.personalized_recommendations || []
      };

      setProgress(100);
      setCurrentStep('Analysis complete!');
      setInsights(insightData);
      
      setTimeout(() => {
        setIsProcessing(false);
      }, 1000);

    } catch (error: any) {
      console.error('Error generating insights:', error);
      setError(error.message || 'Failed to generate insights');
      setIsProcessing(false);
      toast({
        title: "Error generating insights",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="text-destructive mb-4">
              <MessageCircle className="w-12 h-12 mx-auto mb-2" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Processing Error</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground mb-2">Session Analysis</h1>
          <p className="text-muted-foreground">
            Processing your conversation to generate personalized insights
          </p>
        </div>

        {isProcessing ? (
          /* Processing State */
          <Card className="mb-8">
            <CardContent className="p-8">
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              </div>
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold mb-2">Analyzing your conversation</h2>
                <p className="text-muted-foreground">{currentStep}</p>
              </div>
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-center text-muted-foreground">{progress}% complete</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Results State */
          <div className="space-y-6">
            {/* Success Header */}
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <h2 className="text-lg font-semibold text-green-900">Analysis Complete!</h2>
                    <p className="text-green-700">Your insights have been saved to your profile</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Key Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  Key Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights?.key_insights?.map((insight, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <p className="text-sm leading-relaxed">{insight}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Personality Summary */}
            <Card>
              <CardHeader>
                <CardTitle>OCEAN Personality Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {insights?.personality_notes?.summary}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Openness</span>
                      <span className="text-sm font-medium">{insights?.personality_notes?.openness || 0}%</span>
                    </div>
                    <Progress value={insights?.personality_notes?.openness || 0} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Conscientiousness</span>
                      <span className="text-sm font-medium">{insights?.personality_notes?.conscientiousness || 0}%</span>
                    </div>
                    <Progress value={insights?.personality_notes?.conscientiousness || 0} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Extraversion</span>
                      <span className="text-sm font-medium">{insights?.personality_notes?.extraversion || 0}%</span>
                    </div>
                    <Progress value={insights?.personality_notes?.extraversion || 0} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Agreeableness</span>
                      <span className="text-sm font-medium">{insights?.personality_notes?.agreeableness || 0}%</span>
                    </div>
                    <Progress value={insights?.personality_notes?.agreeableness || 0} className="h-2" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Emotional Stability</span>
                      <span className="text-sm font-medium">{100 - (insights?.personality_notes?.neuroticism || 0)}%</span>
                    </div>
                    <Progress value={100 - (insights?.personality_notes?.neuroticism || 0)} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Next Steps */}
            <Card>
              <CardHeader>
                <CardTitle>Personalized Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights?.next_steps?.map((step, index) => (
                    <div key={index} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-600 mt-2 flex-shrink-0" />
                        <p className="text-sm leading-relaxed text-green-800">{step}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button onClick={() => navigate('/dashboard')} className="flex-1">
                View Dashboard
              </Button>
              <Button onClick={() => navigate('/conversation')} variant="outline" className="flex-1">
                New Conversation
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionSummary;