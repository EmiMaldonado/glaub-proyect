import { useState, useEffect } from 'react';

interface TherapeuticStage {
  name: string;
  description: string;
  keywords: string[];
  progressWeight: number;
}

interface EmotionalState {
  primary: string;
  intensity: number;
  stability: number;
}

interface TherapeuticProgress {
  overall: number;
  selfAwareness: number;
  emotionalRegulation: number;
  cognitiveInsight: number;
  behavioralChange: number;
}

interface ConversationContext {
  stage: TherapeuticStage;
  emotionalState: EmotionalState;
  progress: TherapeuticProgress;
  keyInsights: string[];
  needsAttention: string[];
}

const THERAPEUTIC_STAGES: TherapeuticStage[] = [
  {
    name: 'Establecimiento de Rapport',
    description: 'Construyendo confianza y conexión',
    keywords: ['hola', 'primera vez', 'nuevo', 'conocer', 'presentar'],
    progressWeight: 0.1
  },
  {
    name: 'Exploración Inicial',
    description: 'Entendiendo el contexto y situación actual',
    keywords: ['problema', 'situación', 'pasando', 'siento', 'últimamente'],
    progressWeight: 0.2
  },
  {
    name: 'Identificación de Patrones',
    description: 'Reconociendo patrones de pensamiento y comportamiento',
    keywords: ['siempre', 'nunca', 'patrón', 'repetir', 'frecuentemente'],
    progressWeight: 0.3
  },
  {
    name: 'Insight y Comprensión',
    description: 'Desarrollando autoconocimiento y perspectiva',
    keywords: ['entiendo', 'comprendo', 'cuenta', 'perspectiva', 'conectar'],
    progressWeight: 0.5
  },
  {
    name: 'Estrategias y Cambio',
    description: 'Desarrollando herramientas y planificando cambios',
    keywords: ['hacer', 'cambiar', 'estrategia', 'plan', 'acción', 'diferente'],
    progressWeight: 0.8
  },
  {
    name: 'Consolidación',
    description: 'Integrando aprendizajes y preparando seguimiento',
    keywords: ['aprendido', 'mejor', 'próxima', 'seguir', 'aplicar'],
    progressWeight: 1.0
  }
];

export const useTherapeuticAnalysis = () => {
  const [conversationContext, setConversationContext] = useState<ConversationContext>({
    stage: THERAPEUTIC_STAGES[0],
    emotionalState: { primary: 'neutral', intensity: 0.5, stability: 0.7 },
    progress: {
      overall: 0,
      selfAwareness: 0,
      emotionalRegulation: 0,
      cognitiveInsight: 0,
      behavioralChange: 0
    },
    keyInsights: [],
    needsAttention: []
  });

  const analyzeConversationFlow = (messages: any[], currentMinutes: number) => {
    if (!messages.length) return conversationContext;

    const recentMessages = messages.slice(-5); // Last 5 messages
    const allUserMessages = messages.filter(m => m.role === 'user');
    
    // Determine current therapeutic stage
    const currentStage = determineTherapeuticStage(allUserMessages);
    
    // Analyze emotional state
    const emotionalState = analyzeEmotionalState(recentMessages);
    
    // Calculate therapeutic progress
    const progress = calculateTherapeuticProgress(allUserMessages, currentMinutes);
    
    // Extract key insights
    const keyInsights = extractKeyInsights(allUserMessages);
    
    // Identify areas needing attention
    const needsAttention = identifyAttentionAreas(emotionalState, progress, currentMinutes);

    const newContext: ConversationContext = {
      stage: currentStage,
      emotionalState,
      progress,
      keyInsights,
      needsAttention
    };

    setConversationContext(newContext);
    return newContext;
  };

  const determineTherapeuticStage = (userMessages: any[]): TherapeuticStage => {
    if (userMessages.length === 0) return THERAPEUTIC_STAGES[0];
    
    const messageCount = userMessages.length;
    const totalContent = userMessages.map(m => m.content.toLowerCase()).join(' ');
    
    // Score each stage based on keywords and conversation length
    const stageScores = THERAPEUTIC_STAGES.map(stage => {
      const keywordMatches = stage.keywords.filter(keyword => 
        totalContent.includes(keyword)
      ).length;
      
      const lengthBonus = Math.min(messageCount / 10, 1) * stage.progressWeight;
      return { stage, score: keywordMatches + lengthBonus };
    });

    // Return the stage with highest score
    const bestStage = stageScores.reduce((prev, current) => 
      prev.score > current.score ? prev : current
    );

    return bestStage.stage;
  };

  const analyzeEmotionalState = (recentMessages: any[]): EmotionalState => {
    if (!recentMessages.length) {
      return { primary: 'neutral', intensity: 0.5, stability: 0.7 };
    }

    const userMessages = recentMessages.filter(m => m.role === 'user');
    const content = userMessages.map(m => m.content.toLowerCase()).join(' ');

    // Emotion detection with intensity
    const emotions = {
      anxious: (content.match(/ansi|preocup|nervios|estrés|miedo/g) || []).length,
      sad: (content.match(/triste|deprim|llor|dolor|pena/g) || []).length,
      angry: (content.match(/enojado|molest|ira|rabia|frustrad/g) || []).length,
      happy: (content.match(/feliz|alegr|content|bien|mejor/g) || []).length,
      confused: (content.match(/confund|perdid|no sé|no entiendo/g) || []).length,
      hopeful: (content.match(/esperanz|optimist|positiv|mejorar/g) || []).length
    };

    // Find primary emotion
    const primaryEmotion = Object.entries(emotions).reduce((a, b) => 
      emotions[a[0]] > emotions[b[0]] ? a : b
    )[0];

    // Calculate intensity (0-1)
    const totalEmotions = Object.values(emotions).reduce((a, b) => a + b, 0);
    const intensity = Math.min(totalEmotions / 5, 1);

    // Calculate stability based on emotion consistency
    const messageEmotions = userMessages.map(msg => {
      const msgContent = msg.content.toLowerCase();
      return Object.entries(emotions).map(([emotion, _]) => {
        return (msgContent.match(new RegExp(emotion === 'anxious' ? 'ansi|preocup|nervios' : 
                                            emotion === 'sad' ? 'triste|deprim|dolor' :
                                            emotion === 'angry' ? 'enojado|molest|ira' :
                                            emotion === 'happy' ? 'feliz|alegr|bien' :
                                            emotion === 'confused' ? 'confund|perdid' :
                                            'esperanz|optimist|positiv', 'g')) || []).length;
      });
    });

    const stability = messageEmotions.length > 1 ? 
      1 - (Math.abs(messageEmotions[0][0] - messageEmotions[messageEmotions.length - 1][0]) / 5) : 
      0.7;

    return {
      primary: totalEmotions > 0 ? primaryEmotion : 'neutral',
      intensity,
      stability: Math.max(0.1, stability)
    };
  };

  const calculateTherapeuticProgress = (userMessages: any[], minutes: number): TherapeuticProgress => {
    const content = userMessages.map(m => m.content.toLowerCase()).join(' ');
    const messageCount = userMessages.length;

    // Self-awareness indicators
    const selfAwarenessKeywords = ['me doy cuenta', 'entiendo que', 'creo que', 'siento que', 'pienso que'];
    const selfAwareness = Math.min(
      (selfAwarenessKeywords.filter(k => content.includes(k)).length * 0.2) + (messageCount * 0.05),
      1
    );

    // Emotional regulation indicators
    const regulationKeywords = ['calmarme', 'controlar', 'respirar', 'relajar', 'manejar'];
    const emotionalRegulation = Math.min(
      (regulationKeywords.filter(k => content.includes(k)).length * 0.25) + (minutes * 0.02),
      1
    );

    // Cognitive insight indicators
    const insightKeywords = ['conexión', 'patrón', 'relación', 'causa', 'consecuencia', 'porque'];
    const cognitiveInsight = Math.min(
      (insightKeywords.filter(k => content.includes(k)).length * 0.2) + (messageCount * 0.03),
      1
    );

    // Behavioral change indicators
    const changeKeywords = ['cambiar', 'hacer diferente', 'intentar', 'practicar', 'aplicar'];
    const behavioralChange = Math.min(
      (changeKeywords.filter(k => content.includes(k)).length * 0.3) + (minutes * 0.01),
      1
    );

    const overall = (selfAwareness + emotionalRegulation + cognitiveInsight + behavioralChange) / 4;

    return {
      overall,
      selfAwareness,
      emotionalRegulation,
      cognitiveInsight,
      behavioralChange
    };
  };

  const extractKeyInsights = (userMessages: any[]): string[] => {
    if (!userMessages.length) return [];

    const insights: string[] = [];
    const content = userMessages.map(m => m.content.toLowerCase()).join(' ');

    // Pattern recognition insights
    if (content.includes('siempre') || content.includes('nunca')) {
      insights.push('Patrones de pensamiento absoluto identificados');
    }

    // Emotional awareness insights
    if (content.match(/me siento|siento que|estoy/)) {
      insights.push('Expresión emocional activa');
    }

    // Relationship insights
    if (content.match(/familia|pareja|amigos|trabajo/)) {
      insights.push('Contexto relacional relevante');
    }

    // Change motivation
    if (content.match(/cambiar|mejorar|diferente/)) {
      insights.push('Motivación para el cambio presente');
    }

    return insights.slice(0, 4); // Limit to top 4 insights
  };

  const identifyAttentionAreas = (
    emotionalState: EmotionalState, 
    progress: TherapeuticProgress, 
    minutes: number
  ): string[] => {
    const areas: string[] = [];

    // High emotional intensity
    if (emotionalState.intensity > 0.8) {
      areas.push('Alta intensidad emocional - necesita contención');
    }

    // Low emotional stability
    if (emotionalState.stability < 0.3) {
      areas.push('Fluctuaciones emocionales - explorar disparadores');
    }

    // Low overall progress after significant time
    if (minutes > 10 && progress.overall < 0.3) {
      areas.push('Progreso limitado - considerar cambio de enfoque');
    }

    // Time management
    if (minutes > 12 && progress.overall < 0.6) {
      areas.push('Tiempo limitado - priorizar objetivos');
    }

    // High anxiety indicators
    if (emotionalState.primary === 'anxious' && emotionalState.intensity > 0.6) {
      areas.push('Niveles altos de ansiedad - técnicas de regulación');
    }

    return areas.slice(0, 3); // Limit to top 3 areas
  };

  const generateIntelligentAlert = (minutes: number): { type: 'warning' | 'question' | 'reflection', message: string } | null => {
    const context = conversationContext;

    // 14-minute contextual warning
    if (minutes >= 14) {
      if (context.needsAttention.length > 0) {
        return {
          type: 'question',
          message: `Nos queda poco tiempo. ${context.needsAttention[0]}. ¿Te gustaría que exploremos esto más profundamente?`
        };
      } else if (context.progress.overall > 0.7) {
        return {
          type: 'reflection',
          message: 'Hemos hecho un gran trabajo hoy. ¿Qué es lo más importante que te llevas de nuestra conversación?'
        };
      } else {
        return {
          type: 'warning',
          message: 'Tenemos un minuto para cerrar. ¿Hay algo específico en lo que te gustaría que nos enfoquemos?'
        };
      }
    }

    // Mid-session insights (7-8 minutes)
    if (minutes >= 7 && minutes < 8 && context.progress.overall < 0.4) {
      return {
        type: 'question',
        message: 'Veo que estamos explorando temas importantes. ¿Qué sientes que necesitas entender mejor?'
      };
    }

    return null;
  };

  return {
    conversationContext,
    analyzeConversationFlow,
    generateIntelligentAlert
  };
};