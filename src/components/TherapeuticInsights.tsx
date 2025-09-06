import React from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Brain, Heart, Eye, TrendingUp, AlertCircle } from 'lucide-react';

interface TherapeuticInsightsProps {
  conversationContext: {
    stage: {
      name: string;
      description: string;
    };
    emotionalState: {
      primary: string;
      intensity: number;
      stability: number;
    };
    progress: {
      overall: number;
      selfAwareness: number;
      emotionalRegulation: number;
      cognitiveInsight: number;
      behavioralChange: number;
    };
    keyInsights: string[];
    needsAttention: string[];
  };
  oceanSignals?: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
}

const TherapeuticInsights: React.FC<TherapeuticInsightsProps> = ({ 
  conversationContext, 
  oceanSignals 
}) => {
  const getEmotionColor = (emotion: string) => {
    switch (emotion) {
      case 'happy': return 'bg-green-500/20 text-green-700 border-green-200';
      case 'sad': return 'bg-blue-500/20 text-blue-700 border-blue-200';
      case 'anxious': return 'bg-yellow-500/20 text-yellow-700 border-yellow-200';
      case 'angry': return 'bg-red-500/20 text-red-700 border-red-200';
      case 'confused': return 'bg-purple-500/20 text-purple-700 border-purple-200';
      case 'hopeful': return 'bg-emerald-500/20 text-emerald-700 border-emerald-200';
      default: return 'bg-gray-500/20 text-gray-700 border-gray-200';
    }
  };

  const formatProgress = (value: number) => Math.round(value * 100);

  return (
    <div className="w-80 bg-card border-l border-border h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <Brain className="h-8 w-8 text-primary mx-auto mb-2" />
          <h3 className="text-lg font-semibold text-foreground">Análisis Terapéutico</h3>
          <p className="text-sm text-muted-foreground">Insights en Tiempo Real</p>
        </div>

        {/* Therapeutic Stage */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">Etapa Actual</h4>
          </div>
          <div className="space-y-2">
            <Badge variant="secondary" className="text-xs">
              {conversationContext.stage.name}
            </Badge>
            <p className="text-xs text-muted-foreground">
              {conversationContext.stage.description}
            </p>
          </div>
        </Card>

        {/* Emotional State */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">Estado Emocional</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Emoción Principal</span>
              <Badge 
                variant="outline" 
                className={`text-xs ${getEmotionColor(conversationContext.emotionalState.primary)}`}
              >
                {conversationContext.emotionalState.primary}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Intensidad</span>
                <span className="font-medium">
                  {formatProgress(conversationContext.emotionalState.intensity)}%
                </span>
              </div>
              <Progress value={conversationContext.emotionalState.intensity * 100} className="h-1.5" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Estabilidad</span>
                <span className="font-medium">
                  {formatProgress(conversationContext.emotionalState.stability)}%
                </span>
              </div>
              <Progress value={conversationContext.emotionalState.stability * 100} className="h-1.5" />
            </div>
          </div>
        </Card>

        {/* Therapeutic Progress */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-medium">Progreso Terapéutico</h4>
          </div>
          <div className="space-y-3">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-foreground">Progreso General</span>
                <span className="font-semibold text-primary">
                  {formatProgress(conversationContext.progress.overall)}%
                </span>
              </div>
              <Progress value={conversationContext.progress.overall * 100} className="h-2" />
            </div>

            {/* Individual Progress Areas */}
            <div className="space-y-2 pt-2 border-t border-border">
              {[
                { key: 'selfAwareness', label: 'Autoconocimiento', value: conversationContext.progress.selfAwareness },
                { key: 'emotionalRegulation', label: 'Regulación Emocional', value: conversationContext.progress.emotionalRegulation },
                { key: 'cognitiveInsight', label: 'Insight Cognitivo', value: conversationContext.progress.cognitiveInsight },
                { key: 'behavioralChange', label: 'Cambio Conductual', value: conversationContext.progress.behavioralChange }
              ].map(({ key, label, value }) => (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{formatProgress(value)}%</span>
                  </div>
                  <Progress value={value * 100} className="h-1" />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Key Insights */}
        {conversationContext.keyInsights.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium">Insights Clave</h4>
            </div>
            <div className="space-y-2">
              {conversationContext.keyInsights.map((insight, index) => (
                <div key={index} className="text-xs p-2 rounded-md bg-primary/5 border border-primary/10">
                  <span className="text-muted-foreground">• {insight}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Attention Areas */}
        {conversationContext.needsAttention.length > 0 && (
          <Card className="p-4 border-yellow-200 bg-yellow-50/50">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <h4 className="text-sm font-medium text-yellow-800">Áreas de Atención</h4>
            </div>
            <div className="space-y-2">
              {conversationContext.needsAttention.map((area, index) => (
                <div key={index} className="text-xs p-2 rounded-md bg-yellow-100/50 border border-yellow-200/50">
                  <span className="text-yellow-700">⚠ {area}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* OCEAN Personality Signals */}
        {oceanSignals && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium">Señales OCEAN</h4>
            </div>
            <div className="space-y-2">
              {Object.entries(oceanSignals).map(([trait, value]) => (
                <div key={trait} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground capitalize">
                      {trait === 'openness' ? 'Apertura' :
                       trait === 'conscientiousness' ? 'Responsabilidad' :
                       trait === 'extraversion' ? 'Extraversión' :
                       trait === 'agreeableness' ? 'Amabilidad' :
                       'Neuroticismo'}
                    </span>
                    <span className="font-medium">{formatProgress(value)}%</span>
                  </div>
                  <Progress value={value * 100} className="h-1" />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TherapeuticInsights;