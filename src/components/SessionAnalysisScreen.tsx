import React from 'react';
import { Brain, Sparkles, Clock, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface SessionAnalysisScreenProps {
  isVisible: boolean;
  onComplete?: () => void;
}

export const SessionAnalysisScreen: React.FC<SessionAnalysisScreenProps> = ({
  isVisible,
  onComplete
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 p-8 text-center animate-fade-in">
        <div className="space-y-6">
          {/* Icon Animation */}
          <div className="relative">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
              <Brain className="w-10 h-10 text-primary animate-bounce" />
            </div>
            <div className="absolute -top-2 -right-2">
              <Sparkles className="w-6 h-6 text-yellow-500 animate-spin" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">
              Analyzing Your Session
            </h2>
            <p className="text-muted-foreground">
              We're creating personalized insights and recommendations based on your conversation.
            </p>
          </div>

          {/* Progress Steps */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-sm text-foreground">Processing conversation data</span>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className="w-6 h-6 rounded-full bg-primary/60 flex items-center justify-center animate-pulse">
                <Brain className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-sm text-foreground">Generating insights</span>
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/10">
              <div className="w-6 h-6 rounded-full border-2 border-muted flex items-center justify-center">
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">Creating recommendations</span>
            </div>
          </div>

          {/* Estimated Time */}
          <div className="text-xs text-muted-foreground border-t pt-4">
            This usually takes 30-60 seconds
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SessionAnalysisScreen;