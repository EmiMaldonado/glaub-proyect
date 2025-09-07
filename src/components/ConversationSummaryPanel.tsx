import React from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Brain, Heart, TrendingUp, Target, Send, FileText, AlertCircle, CheckCircle } from 'lucide-react';

interface ConversationSummaryPanelProps {
  conversationSummary: string;
  conversationContext: any;
  oceanSignals?: any;
  sessionTime: number;
  messagesCount: number;
  isSessionCompleted: boolean;
  onSendSummary: () => void;
  formatTime: (seconds: number) => string;
}

const ConversationSummaryPanel: React.FC<ConversationSummaryPanelProps> = ({
  conversationSummary,
  conversationContext,
  oceanSignals,
  sessionTime,
  messagesCount,
  isSessionCompleted,
  onSendSummary,
  formatTime
}) => {
  const categorizedSummary = React.useMemo(() => {
    if (!conversationSummary) return null;
    
    // Parse the conversation summary into categories
    const lines = conversationSummary.split('\n');
    let currentSection = '';
    const sections: Record<string, string[]> = {
      insights: [],
      summary: [],
      strengths: [],
      followUp: []
    };
    
    lines.forEach(line => {
      if (line.includes('Insights:') || line.includes('insights')) {
        currentSection = 'insights';
      } else if (line.includes('Resumen') || line.includes('summary')) {
        currentSection = 'summary';
      } else if (line.includes('Puntos') || line.includes('strengths') || line.includes('Fortalezas')) {
        currentSection = 'strengths';
      } else if (line.includes('Recomendaciones') || line.includes('Seguimiento') || line.includes('follow')) {
        currentSection = 'followUp';
      } else if (line.trim() && currentSection) {
        sections[currentSection].push(line.trim());
      }
    });
    
    return sections;
  }, [conversationSummary]);

  const formatProgress = (value: number) => Math.round(value * 100);

  return (
    <div className="w-96 bg-card/30 backdrop-blur-sm border-l border-border h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Resumen e Insights</h3>
        </div>
      </div>
      
      <ScrollArea className="h-[calc(100vh-5rem)]">
        <div className="p-4 space-y-6">
          
          {/* Session Overview */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-medium">Información de Sesión</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duración</span>
                <span className="font-medium">{formatTime(sessionTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Intercambios</span>
                <span className="font-medium">{messagesCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado</span>
                <Badge variant={isSessionCompleted ? "default" : "secondary"} className="text-xs">
                  {isSessionCompleted ? "Completada" : "En Progreso"}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Real-time Progress */}
          {conversationContext && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-medium">Progreso en Tiempo Real</h4>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progreso General</span>
                    <span className="font-medium">{formatProgress(conversationContext.progress?.overall || 0)}%</span>
                  </div>
                  <Progress value={(conversationContext.progress?.overall || 0) * 100} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Autoconocimiento</span>
                    <span className="font-medium">{formatProgress(conversationContext.progress?.selfAwareness || 0)}%</span>
                  </div>
                  <Progress value={(conversationContext.progress?.selfAwareness || 0) * 100} className="h-1.5" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Regulación Emocional</span>
                    <span className="font-medium">{formatProgress(conversationContext.progress?.emotionalRegulation || 0)}%</span>
                  </div>
                  <Progress value={(conversationContext.progress?.emotionalRegulation || 0) * 100} className="h-1.5" />
                </div>
              </div>
            </Card>
          )}

          {/* Key Insights */}
          {conversationContext?.keyInsights?.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-medium">Insights Principales</h4>
              </div>
              <div className="space-y-2">
                {conversationContext.keyInsights.map((insight: string, index: number) => (
                  <div key={index} className="text-xs p-2 rounded-md bg-primary/5 border border-primary/10">
                    <span className="text-foreground">• {insight}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Categorized Summary - Only when session is completed */}
          {isSessionCompleted && categorizedSummary && (
            <>
              {/* Insights Category */}
              {categorizedSummary.insights.length > 0 && (
                <Card className="p-4 border-blue-200 bg-blue-50/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="h-4 w-4 text-blue-600" />
                    <h4 className="text-sm font-medium text-blue-800">Insights Terapéuticos</h4>
                  </div>
                  <div className="space-y-1">
                    {categorizedSummary.insights.map((item, index) => (
                      <p key={index} className="text-xs text-blue-700 leading-relaxed">
                        {item}
                      </p>
                    ))}
                  </div>
                </Card>
              )}

              {/* Summary Category */}
              {categorizedSummary.summary.length > 0 && (
                <Card className="p-4 border-green-200 bg-green-50/30">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-green-600" />
                    <h4 className="text-sm font-medium text-green-800">Resumen de Conversación</h4>
                  </div>
                  <div className="space-y-1">
                    {categorizedSummary.summary.map((item, index) => (
                      <p key={index} className="text-xs text-green-700 leading-relaxed">
                        {item}
                      </p>
                    ))}
                  </div>
                </Card>
              )}

              {/* Strengths Category */}
              {categorizedSummary.strengths.length > 0 && (
                <Card className="p-4 border-purple-200 bg-purple-50/30">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="h-4 w-4 text-purple-600" />
                    <h4 className="text-sm font-medium text-purple-800">Puntos Fuertes</h4>
                  </div>
                  <div className="space-y-1">
                    {categorizedSummary.strengths.map((item, index) => (
                      <p key={index} className="text-xs text-purple-700 leading-relaxed">
                        {item}
                      </p>
                    ))}
                  </div>
                </Card>
              )}

              {/* Follow-up Category */}
              {categorizedSummary.followUp.length > 0 && (
                <Card className="p-4 border-orange-200 bg-orange-50/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-orange-600" />
                    <h4 className="text-sm font-medium text-orange-800">Plan de Seguimiento</h4>
                  </div>
                  <div className="space-y-1">
                    {categorizedSummary.followUp.map((item, index) => (
                      <p key={index} className="text-xs text-orange-700 leading-relaxed">
                        {item}
                      </p>
                    ))}
                  </div>
                </Card>
              )}

              {/* Send Summary Button */}
              <Card className="p-4 border-primary/20 bg-primary/5">
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    ¿Deseas enviar este resumen a tu terapeuta o manager?
                  </p>
                  <Button 
                    onClick={onSendSummary}
                    className="w-full gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Enviar Resumen
                  </Button>
                </div>
              </Card>
            </>
          )}

          {/* OCEAN Personality Signals */}
          {oceanSignals && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Heart className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-medium">Análisis de Personalidad</h4>
              </div>
              <div className="space-y-3">
                {Object.entries(oceanSignals).map(([trait, value]: [string, any]) => (
                  <div key={trait} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground capitalize">
                        {trait === 'openness' ? 'Apertura' :
                         trait === 'conscientiousness' ? 'Responsabilidad' :
                         trait === 'extraversion' ? 'Extraversión' :
                         trait === 'agreeableness' ? 'Amabilidad' :
                         'Neuroticismo'}
                      </span>
                      <span className="font-medium">{Math.round(value * 100)}%</span>
                    </div>
                    <Progress value={value * 100} className="h-1.5" />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Empty State */}
          {!conversationSummary && !isSessionCompleted && (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <h4 className="text-lg font-medium mb-2">Sesión en Progreso</h4>
              <p className="text-sm max-w-sm mx-auto leading-relaxed">
                Los insights y el resumen aparecerán aquí conforme avance tu conversación terapéutica.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ConversationSummaryPanel;