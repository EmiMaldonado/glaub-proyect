import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  status: 'active' | 'paused' | 'completed' | 'terminated';
  started_at: string;
  max_duration_minutes: number;
}

interface AutoPauseConfig {
  conversation: Conversation | null;
  messages: Message[];
  userId?: string;
  onPause: () => void;
  updateSessionState: (updates: any) => void;
  onConversationPaused: (conversationId: string) => void;
  pauseSessionFunction: () => Promise<boolean>;
}

interface AutoPauseHook {
  pauseConversationWithContext: () => Promise<void>;
}

export const useAutoPause = (config: AutoPauseConfig): AutoPauseHook => {
  const {
    conversation,
    messages,
    userId,
    onPause,
    updateSessionState,
    onConversationPaused,
    pauseSessionFunction
  } = config;

  // Referencias estables para evitar re-renders infinitos
  const isPausingRef = useRef<boolean>(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const setupComplete = useRef<boolean>(false);

  // Configuración de timeouts
  const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutos de inactividad
  const MAX_SESSION_DURATION = 60 * 60 * 1000; // 60 minutos máximo
  
  const pauseConversationWithContext = useCallback(async (): Promise<void> => {
    if (!conversation || !userId || isPausingRef.current || conversation.status !== 'active') {
      return;
    }

    try {
      isPausingRef.current = true;
      console.log('🔄 Auto-pausing conversation:', conversation.id);

      // Crear contexto de la conversación
      const conversationContext = {
        lastTopic: conversation.title || 'Ongoing conversation',
        messageCount: messages.length,
        lastMessageTime: messages.length > 0 ? messages[messages.length - 1].created_at : null,
        sessionDuration: Math.ceil((Date.now() - new Date(conversation.started_at).getTime()) / 60000)
      };

      // Guardar en paused_conversations
      const { error: pausedError } = await supabase
        .from('paused_conversations')
        .upsert({
          user_id: userId,
          conversation_id: conversation.id,
          conversation_title: conversation.title || 'Chat Session',
          message_history: messages,
          context: conversationContext,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (pausedError) {
        console.error('❌ Error saving paused conversation:', pausedError);
      }

      // Actualizar estado de conversación
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ 
          status: 'paused',
          session_data: {
            pausedAt: new Date().toISOString(),
            reason: 'auto_pause',
            context: conversationContext
          }
        })
        .eq('id', conversation.id);

      if (updateError) {
        console.error('❌ Error updating conversation status:', updateError);
      }

      // Actualizar estado local
      updateSessionState({
        status: 'paused',
        pausedAt: new Date().toISOString()
      });

      // Notificar pausa
      onConversationPaused(conversation.id);
      onPause();

      console.log('✅ Conversation auto-paused successfully');

    } catch (error) {
      console.error('❌ Error in auto-pause:', error);
    } finally {
      isPausingRef.current = false;
    }
  }, [conversation?.id, conversation?.status, messages.length, userId, onPause, updateSessionState, onConversationPaused]);

  // Verificar condiciones de auto-pause
  const checkAutoPauseConditions = useCallback((): boolean => {
    if (!conversation || conversation.status !== 'active') {
      return false;
    }

    const now = Date.now();
    const sessionStart = new Date(conversation.started_at).getTime();
    const sessionDuration = now - sessionStart;
    
    // Verificar duración máxima
    const maxDuration = conversation.max_duration_minutes 
      ? conversation.max_duration_minutes * 60 * 1000 
      : MAX_SESSION_DURATION;

    if (sessionDuration >= maxDuration) {
      console.log('🕐 Max session duration reached');
      return true;
    }

    // Verificar inactividad
    const inactivityDuration = now - lastActivityRef.current;
    if (inactivityDuration >= INACTIVITY_TIMEOUT) {
      console.log('😴 Inactivity timeout reached');
      return true;
    }

    return false;
  }, [conversation]);

  // Actualizar última actividad cuando llegan mensajes
  useEffect(() => {
    if (messages.length > 0) {
      lastActivityRef.current = Date.now();
    }
  }, [messages.length]);

  // Setup de auto-pause (SOLO UNA VEZ)
  useEffect(() => {
    if (!conversation || conversation.status !== 'active' || setupComplete.current) {
      return;
    }

    console.log('🔧 useAutoPause: Initial setup for conversation:', conversation.id);
    setupComplete.current = true;

    const scheduleCheck = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        if (checkAutoPauseConditions()) {
          pauseConversationWithContext();
        } else {
          scheduleCheck(); // Reprogramar siguiente check
        }
      }, 30000); // Check cada 30 segundos
    };

    scheduleCheck();

    // Cleanup
    return () => {
      console.log('🧹 useAutoPause: Cleanup for conversation:', conversation.id);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setupComplete.current = false;
    };
  }, [conversation?.id]); // SOLO cambiar cuando cambia la conversación

  return {
    pauseConversationWithContext
  };
};
