import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Activity, Volume2, VolumeX, Settings, Heart, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SessionStatusPanelProps {
  sessionTime: number;
  isSessionActive: boolean;
  isRecording: boolean;
  autoTTS: boolean;
  onToggleTTS: () => void;
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
  onToggleTTS,
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
    if (isRecording) return 'Grabando';
    if (isSessionActive) return 'Sesión Activa';
    return 'Inactiva';
  };

  const maxDuration = 15 * 60; // 15 minutes in seconds
  const progress = (sessionTime / maxDuration) * 100;

  return (
    <div className="w-80 bg-card border-r border-border h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <Activity className="h-8 w-8 text-primary mx-auto mb-2" />
          <h3 className="text-lg font-semibold text-foreground">Estado de Sesión</h3>
          <p className="text-sm text-muted-foreground">Control y Monitoreo</p>
        </div>

        {/* Session Status */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">Estado Actual</h4>
          </div>
          <div className="space-y-3">
            <Badge className={`w-full justify-center py-2 ${getStatusColor()}`}>
              {getStatusText()}
            </Badge>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tiempo Transcurrido</span>
                <span className="font-medium">{formatTime(sessionTime)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tiempo Restante</span>
                <span className="font-medium">{formatTime(getTimeRemaining())}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </Card>

        {/* Quality Indicators */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">Calidad de Sesión</h4>
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Calidad de Audio</span>
                <span className="font-medium">{Math.round(sessionQuality.audioQuality * 100)}%</span>
              </div>
              <Progress value={sessionQuality.audioQuality * 100} className="h-1.5" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Conexión</span>
                <span className="font-medium">{Math.round(sessionQuality.connectionStability * 100)}%</span>
              </div>
              <Progress value={sessionQuality.connectionStability * 100} className="h-1.5" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Tiempo de Respuesta</span>
                <span className="font-medium">{sessionQuality.responseTime}ms</span>
              </div>
              <Progress value={Math.max(0, 100 - (sessionQuality.responseTime / 10))} className="h-1.5" />
            </div>
          </div>
        </Card>

        {/* Quick Settings */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">Configuración Rápida</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {autoTTS ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                <span className="text-sm">Síntesis de Voz</span>
              </div>
              <Button
                onClick={onToggleTTS}
                variant={autoTTS ? "default" : "outline"}
                size="sm"
              >
                {autoTTS ? "ON" : "OFF"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Session Guidelines */}
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">Tips de Sesión</h4>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>• Habla de manera clara y pausada</p>
            <p>• Toma tu tiempo para reflexionar</p>
            <p>• No hay respuestas correctas o incorrectas</p>
            <p>• La sesión durará máximo 15 minutos</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SessionStatusPanel;