import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Activity, Volume2, VolumeX, Settings, Heart, Mic, Keyboard, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SessionStatusPanelProps {
  sessionTime: number;
  isSessionActive: boolean;
  isRecording: boolean;
  autoTTS: boolean;
  inputMode: 'audio' | 'text';
  onToggleTTS: () => void;
  onInputModeChange: (mode: 'audio' | 'text') => void;
  sessionQuality: {
    audioQuality: number;
    connectionStability: number;
    responseTime: number;
  };
  formatTime: (seconds: number) => string;
  getTimeRemaining: () => number;
}

const SessionStatusPanel: React.FC<SessionStatusPanelProps> = ({
  sessionTime,
  isSessionActive,
  isRecording,
  autoTTS,
  inputMode,
  onToggleTTS,
  onInputModeChange,
  sessionQuality,
  formatTime,
  getTimeRemaining
}) => {
  const getStatusColor = () => {
    if (isRecording) return 'text-red-600 bg-red-50 border-red-200';
    if (isSessionActive) return 'text-green-600 bg-green-50 border-green-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getStatusText = () => {
    if (isRecording) return 'Recording';
    if (isSessionActive) return 'Active Session';
    return 'Inactiva';
  };

  const maxDuration = 15 * 60; // 15 minutes in seconds
  const progress = (sessionTime / maxDuration) * 100;

  return (
    <div className="w-60 bg-card border-l border-border h-full overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="text-center">
          <Activity className="h-6 w-6 text-primary mx-auto mb-1" />
          <h3 className="text-sm font-semibold text-foreground">Session Status</h3>
        </div>

        {/* Session Status */}
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-3 w-3 text-primary" />
            <h4 className="text-xs font-medium">Estado Actual</h4>
          </div>
          <div className="space-y-2">
            <Badge className={`w-full justify-center py-1 text-xs ${getStatusColor()}`}>
              {getStatusText()}
            </Badge>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Transcurrido</span>
                <span className="font-medium">{formatTime(sessionTime)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Restante</span>
                <span className="font-medium">{formatTime(getTimeRemaining())}</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          </div>
        </Card>

        {/* Input Mode Selection */}
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="h-3 w-3 text-primary" />
            <h4 className="text-xs font-medium">Modo de Entrada</h4>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1">
              <Button
                onClick={() => onInputModeChange('audio')}
                variant={inputMode === 'audio' ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
              >
                <Mic className="h-3 w-3" />
              </Button>
              <Button
                onClick={() => onInputModeChange('text')}
                variant={inputMode === 'text' ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
              >
                <Keyboard className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-xs text-center text-muted-foreground">
              {inputMode === 'audio' ? 'Solo voz' : 'Solo texto'}
            </div>
          </div>
        </Card>

        {/* Quality Indicators */}
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="h-3 w-3 text-primary" />
            <h4 className="text-xs font-medium">Calidad</h4>
          </div>
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Audio</span>
                <span className="font-medium">{Math.round(sessionQuality.audioQuality * 100)}%</span>
              </div>
              <Progress value={sessionQuality.audioQuality * 100} className="h-1" />
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Conexión</span>
                <span className="font-medium">{Math.round(sessionQuality.connectionStability * 100)}%</span>
              </div>
              <Progress value={sessionQuality.connectionStability * 100} className="h-1" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SessionStatusPanel;