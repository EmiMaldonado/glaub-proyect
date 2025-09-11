import React, { useState } from 'react';
import { ArrowLeft, Keyboard, Mic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const ConversationSelector = () => {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState<'chat' | 'voice' | null>(null);

  const handleContinue = () => {
    if (selectedMode) {
      navigate(`/conversation/${selectedMode}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <Progress value={25} className="mb-2" />
            <h1 className="text-lg font-semibold text-center">Talk or type?</h1>
          </div>
        </div>
      </div>

      {/* Mode Selection Cards */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          {/* Text Mode Card */}
          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-medium ${
              selectedMode === 'chat' 
                ? 'ring-2 ring-primary bg-primary/5' 
                : 'hover:bg-accent/5'
            }`}
            onClick={() => setSelectedMode('chat')}
          >
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                  selectedMode === 'chat' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-accent text-accent-foreground'
                }`}>
                  <Keyboard className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Chat</h2>
                  <p className="text-muted-foreground text-sm">
                    Not in the talking mood?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Type your thoughts and let's have a conversation through text
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Voice Mode Card */}
          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-medium ${
              selectedMode === 'voice' 
                ? 'ring-2 ring-primary bg-primary/5' 
                : 'hover:bg-accent/5'
            }`}
            onClick={() => setSelectedMode('voice')}
          >
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                  selectedMode === 'voice' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-accent text-accent-foreground'
                }`}>
                  <Mic className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Voice</h2>
                  <p className="text-muted-foreground text-sm">
                    Just speak, I'm all ears
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Have a natural voice conversation with real-time responses
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Continue Button */}
      <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-md mx-auto">
          <Button
            onClick={handleContinue}
            disabled={!selectedMode}
            className="w-full h-12 text-base"
            variant={selectedMode ? "default" : "secondary"}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConversationSelector;