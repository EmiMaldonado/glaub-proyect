import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MessageSquare, Zap } from 'lucide-react';

type ConversationMode = 'text' | 'voice' | 'realtime';

interface ConversationModeSelectorProps {
  currentMode: ConversationMode;
  onModeChange: (mode: ConversationMode) => void;
  disabled?: boolean;
}

const ConversationModeSelector: React.FC<ConversationModeSelectorProps> = ({
  currentMode,
  onModeChange,
  disabled = false
}) => {
  const modes = [
    {
      id: 'text' as ConversationMode,
      name: 'Text Chat',
      description: 'Traditional text messaging with AI responses',
      icon: MessageSquare,
      color: 'bg-blue-500'
    },
    {
      id: 'voice' as ConversationMode,
      name: 'Voice Recording',
      description: 'Record voice messages for transcription and AI response',
      icon: Mic,
      color: 'bg-green-500'
    },
    {
      id: 'realtime' as ConversationMode,
      name: 'Real-time Voice',
      description: 'Live voice conversation with AI - speak and hear responses',
      icon: Zap,
      color: 'bg-purple-500'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = currentMode === mode.id;
        
        return (
          <Card 
            key={mode.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              isActive 
                ? 'ring-2 ring-primary shadow-lg transform scale-105' 
                : 'hover:shadow-md'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => !disabled && onModeChange(mode.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center space-x-3 mb-2">
                <div className={`w-10 h-10 rounded-full ${mode.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-foreground">{mode.name}</h3>
                {isActive && (
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {mode.description}
              </p>
              {mode.id === 'realtime' && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    ⚡ Live AI
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ConversationModeSelector;