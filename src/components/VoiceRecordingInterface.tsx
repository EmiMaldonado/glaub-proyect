import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Square, Play, AlertTriangle, User } from 'lucide-react';
import VoiceInput from '@/components/VoiceInput';
import LoadingSpinner from '@/components/LoadingSpinner';

interface VoiceRecordingInterfaceProps {
  isRecording: boolean;
  isSessionActive: boolean;
  isLoading: boolean;
  currentAIMessage: string;
  isAISpeaking: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onEndSession: () => void;
  onVoiceTranscription: (text: string) => void;
  formatTime: (seconds: number) => string;
  sessionTime: number;
}

const VoiceRecordingInterface: React.FC<VoiceRecordingInterfaceProps> = ({
  isRecording,
  isSessionActive,
  isLoading,
  currentAIMessage,
  isAISpeaking,
  onStartRecording,
  onStopRecording,
  onEndSession,
  onVoiceTranscription,
  formatTime,
  sessionTime
}) => {
  const getRecordingButtonConfig = () => {
    if (!isSessionActive) {
      return {
        onClick: onStartRecording,
        variant: 'default' as const,
        size: 'lg' as const,
        className: 'h-32 w-32 rounded-full text-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300',
        icon: <Mic className="h-12 w-12" />,
        text: 'Start Session',
        description: 'Press to start your therapy session'
      };
    }
    
    if (isRecording) {
      return {
        onClick: onStopRecording,
        variant: 'destructive' as const,
        size: 'lg' as const,
        className: 'h-32 w-32 rounded-full text-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 animate-pulse',
        icon: <Square className="h-12 w-12" />,
        text: 'Grabando...',
        description: 'Presiona para pausar la grabación'
      };
    }
    
    return {
      onClick: onStartRecording,
      variant: 'outline' as const,
      size: 'lg' as const,
      className: 'h-32 w-32 rounded-full text-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 border-2',
      icon: <Mic className="h-12 w-12" />,
      text: 'Continuar',
      description: 'Presiona para continuar hablando'
    };
  };

  const buttonConfig = getRecordingButtonConfig();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8">
      
      {/* Session Timer */}
      {isSessionActive && (
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {formatTime(sessionTime)}
        </Badge>
      )}

      {/* Main Recording Button */}
      <div className="relative">
        <Button
          {...buttonConfig}
          disabled={isLoading}
        >
          <div className="flex flex-col items-center gap-2">
            {buttonConfig.icon}
          </div>
        </Button>
        
        {/* Recording Animation */}
        {isRecording && (
          <>
            <div className="absolute -inset-6 border-4 border-red-500 rounded-full animate-ping opacity-20"></div>
            <div className="absolute -inset-12 border-2 border-red-400 rounded-full animate-ping opacity-10 animation-delay-300"></div>
          </>
        )}
      </div>

      {/* Status Text */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">{buttonConfig.text}</h2>
        <p className="text-muted-foreground max-w-md text-center">
          {buttonConfig.description}
        </p>
      </div>

      {/* Voice Input Component (hidden but functional) */}
      <div className="hidden">
        <VoiceInput 
          onTranscription={onVoiceTranscription}
          disabled={!isSessionActive || isLoading}
        />
      </div>

      {/* AI Response Section */}
      {currentAIMessage && (
        <Card className="p-6 bg-primary/5 border-primary/20 max-w-2xl w-full">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <User className={`h-5 w-5 text-primary ${isAISpeaking ? 'animate-pulse' : ''}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-semibold text-primary">Psicólogo Virtual</p>
                {isAISpeaking && (
                  <Badge variant="secondary" className="text-xs animate-pulse">
                    Hablando...
                  </Badge>
                )}
              </div>
              <p className="text-sm leading-relaxed text-foreground">{currentAIMessage}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex items-center justify-center gap-3 text-muted-foreground">
          <LoadingSpinner />
          <span className="text-sm">Procesando tu mensaje...</span>
        </div>
      )}

      {/* Session Controls */}
      {isSessionActive && (
        <div className="flex items-center gap-4 pt-4">
          <Button 
            onClick={onEndSession}
            variant="outline"
            className="h-12 px-6 gap-2"
          >
            <Square className="h-4 w-4" />
            End Session
          </Button>
        </div>
      )}

      {/* Warning for long sessions */}
      {sessionTime > 14 * 60 && (
        <Card className="p-4 bg-yellow-50/50 border-yellow-200 max-w-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              The session will end soon. Prepare for closure.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default VoiceRecordingInterface;