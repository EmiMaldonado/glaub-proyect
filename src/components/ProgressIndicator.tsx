import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Heart, Eye, Target, User } from 'lucide-react';

interface ProgressIndicatorProps {
  progress: {
    overall: number;
    selfAwareness: number;
    emotionalRegulation: number;
    cognitiveInsight: number;
    behavioralChange: number;
  };
  stage: {
    name: string;
    description: string;
  };
  minutes: number;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ progress, stage, minutes }) => {
  const formatProgress = (value: number) => Math.round(value * 100);

  const getProgressColor = (value: number) => {
    if (value >= 0.8) return 'text-green-600';
    if (value >= 0.6) return 'text-blue-600';
    if (value >= 0.4) return 'text-yellow-600';
    return 'text-gray-500';
  };

  const getProgressBg = (value: number) => {
    if (value >= 0.8) return 'bg-green-500';
    if (value >= 0.6) return 'bg-blue-500';
    if (value >= 0.4) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const progressAreas = [
    { 
      key: 'selfAwareness', 
      label: 'Autoconocimiento', 
      value: progress.selfAwareness,
      icon: User,
      description: 'Comprensión de pensamientos y emociones'
    },
    { 
      key: 'emotionalRegulation', 
      label: 'Regulación Emocional', 
      value: progress.emotionalRegulation,
      icon: Heart,
      description: 'Capacidad de manejar emociones'
    },
    { 
      key: 'cognitiveInsight', 
      label: 'Insight Cognitivo', 
      value: progress.cognitiveInsight,
      icon: Eye,
      description: 'Reconocimiento de patrones de pensamiento'
    },
    { 
      key: 'behavioralChange', 
      label: 'Cambio Conductual', 
      value: progress.behavioralChange,
      icon: Target,
      description: 'Motivación y acciones para el cambio'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Overall Progress */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Progreso Terapéutico</h3>
        </div>
        <div className="relative w-24 h-24 mx-auto mb-2">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-muted-foreground/20"
            />
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 10}`}
              strokeDashoffset={`${2 * Math.PI * 10 * (1 - progress.overall)}`}
              className="text-primary transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-lg font-bold ${getProgressColor(progress.overall)}`}>
              {formatProgress(progress.overall)}%
            </span>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">
          {stage.name}
        </Badge>
      </div>

      {/* Individual Progress Areas */}
      <div className="space-y-3">
        {progressAreas.map(({ key, label, value, icon: Icon, description }) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{label}</span>
                  <span className={`text-sm font-semibold ${getProgressColor(value)}`}>
                    {formatProgress(value)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              </div>
            </div>
            <div className="relative">
              <Progress value={value * 100} className="h-2" />
              <div 
                className={`absolute top-0 left-0 h-2 rounded-full transition-all duration-500 ${getProgressBg(value)}`}
                style={{ width: `${value * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Session Info */}
      <div className="pt-3 border-t border-border">
        <div className="text-xs text-muted-foreground text-center">
          <p>Sesión de {minutes} minutos</p>
          <p className="mt-1">{stage.description}</p>
        </div>
      </div>
    </div>
  );
};

export default ProgressIndicator;