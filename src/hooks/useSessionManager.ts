import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  metadata?: any;
}

interface Conversation {
  id: string;
  title: string;
  status: 'active' | 'paused' | 'completed' | 'terminated';
  duration_minutes: number;
  max_duration_minutes: number;
  started_at: string;
  insights?: any;
  ocean_signals?: any;
  session_data?: any;
}

interface SessionState {
  conversation: Conversation | null;
  messages: Message[];
  hasActiveSession: boolean;
  isPaused: boolean;
  lastActivity: number;
}

interface SessionManagerHook extends SessionState {
  startNewSession: (conversation: Conversation) => void;
  resumeSession: (conversation: Conversation, messages: Message[]) => void;
  addMessageToSession: (message: Message) => void;
  pauseSession: () => Promise<boolean>;
  resumePausedSession: () => void;
  completeSession: () => Promise<boolean>;
  endSession: () => void;
  updateActivity: () => void;
  loadSessionFromLocal: () => void;
  updateSessionState: (updates: Partial<SessionState>) => void;
  syncWithDatabaseState: (conversationId: string) => Promise<void>;
}

const STORAGE_KEYS = {
  SESSION: 'therapeutic_session',
  MESSAGES: 'therapeutic_messages',
  LAST_ACTIVITY: 'therapeutic_last_activity'
} as const;

export const useSessionManager = (): SessionManagerHook => {
  const { user } = useAuth();
  
  // Cargar sesión al inicializar (solo una vez)
  useEffect(() => {
    loadSessionFromLocal();
  }, [loadSessionFromLocal]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      isProcessingRef.current = false;
    };
  }, []);

  return {
    conversation: sessionState.conversation,
    messages: sessionState.messages,
    hasActiveSession: sessionState.hasActiveSession,
    isPaused: sessionState.isPaused,
    startNewSession,
    resumeSession,
    addMessageToSession,
    pauseSession,
    resumePausedSession,
    completeSession,
    endSession,
    updateActivity,
    loadSessionFromLocal,
    updateSessionState,
    syncWithDatabaseState
  };
};
  const [sessionState, setSessionState] = useState<SessionState>({
    conversation: null,
    messages: [],
    hasActiveSession: false,
    isPaused: false,
    lastActivity: Date.now()
  });

  // Referencias para evitar stale closures y re-renders
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const lastSyncTime = useRef<number>(0);

  // Debounced save para evitar writes excesivos
  const debouncedSave = useCallback((state: SessionState) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        if (state.conversation) {
          localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(state.conversation));
          localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(state.messages));
          localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, state.lastActivity.toString());
        }
      } catch (error) {
        console.error('❌ Error saving to localStorage:', error);
      }
    }, 1000); // Debounce de 1 segundo
  }, []);

  // Actualizar estado de manera controlada
  const updateSessionState = useCallback((updates: Partial<SessionState>) => {
    setSessionState(prevState => {
      const newState = { ...prevState, ...updates };
      
      // Actualizar flags derivados
      newState.hasActiveSession = newState.conversation?.status === 'active';
      newState.isPaused = newState.conversation?.status === 'paused';
      
      // Guardar en localStorage si hay una conversación activa
      if (newState.conversation) {
        debouncedSave(newState);
      }
      
      return newState;
    });
  }, [debouncedSave]);

  // Iniciar nueva sesión
  const startNewSession = useCallback((conversation: Conversation) => {
    console.log('🚀 Starting new session:', conversation.id);
    
    updateSessionState({
      conversation,
      messages: [],
      hasActiveSession: true,
      isPaused: false,
      lastActivity: Date.now()
    });
  }, [updateSessionState]);

  // Reanudar sesión existente
  const resumeSession = useCallback((conversation: Conversation, messages: Message[]) => {
    console.log('🔄 Resuming session:', conversation.id, 'with', messages.length, 'messages');
    
    updateSessionState({
      conversation,
      messages: [...messages], // Crear nueva referencia
      hasActiveSession: conversation.status === 'active',
      isPaused: conversation.status === 'paused',
      lastActivity: Date.now()
    });
  }, [updateSessionState]);

  // Añadir mensaje a la sesión
  const addMessageToSession = useCallback((message: Message) => {
    setSessionState(prevState => {
      // Evitar duplicados
      const messageExists = prevState.messages.some(m => m.id === message.id);
      if (messageExists) {
        console.log('⚠️ Message already exists:', message.id);
        return prevState;
      }

      const newMessages = [...prevState.messages, message];
      const newState = {
        ...prevState,
        messages: newMessages,
        lastActivity: Date.now()
      };

      // Guardar cambios
      if (prevState.conversation) {
        debouncedSave(newState);
      }

      console.log('📝 Added message:', message.role, message.id, 'Total:', newMessages.length);
      return newState;
    });
  }, [debouncedSave]);

  // Pausar sesión
  const pauseSession = useCallback(async (): Promise<boolean> => {
    if (!sessionState.conversation || !user?.id || isProcessingRef.current) {
      return false;
    }

    try {
      isProcessingRef.current = true;
      console.log('⏸️ Pausing session:', sessionState.conversation.id);

      // Actualizar en la base de datos
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ 
          status: 'paused',
          session_data: {
            ...sessionState.conversation.session_data,
            pausedAt: new Date().toISOString(),
            messageCount: sessionState.messages.length
          }
        })
        .eq('id', sessionState.conversation.id);

      if (updateError) throw updateError;

      // Guardar en paused_conversations
      const { error: pausedError } = await supabase
        .from('paused_conversations')
        .upsert({
          user_id: user.id,
          conversation_id: sessionState.conversation.id,
          conversation_title: sessionState.conversation.title,
          message_history: sessionState.messages,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (pausedError) throw pausedError;

      // Actualizar estado local
      updateSessionState({
        conversation: {
          ...sessionState.conversation,
          status: 'paused'
        },
        isPaused: true,
        hasActiveSession: false
      });

      console.log('✅ Session paused successfully');
      return true;

    } catch (error) {
      console.error('❌ Error pausing session:', error);
      return false;
    } finally {
      isProcessingRef.current = false;
    }
  }, [sessionState.conversation, sessionState.messages, user?.id, updateSessionState]);

  // Reanudar sesión pausada
  const resumePausedSession = useCallback(() => {
    if (!sessionState.conversation) return;

    console.log('▶️ Resuming paused session:', sessionState.conversation.id);
    
    updateSessionState({
      conversation: {
        ...sessionState.conversation,
        status: 'active'
      },
      hasActiveSession: true,
      isPaused: false,
      lastActivity: Date.now()
    });
  }, [sessionState.conversation, updateSessionState]);

  // Completar sesión
  const completeSession = useCallback(async (): Promise<boolean> => {
    if (!sessionState.conversation || !user?.id || isProcessingRef.current) {
      return false;
    }

    try {
      isProcessingRef.current = true;
      console.log('🏁 Completing session:', sessionState.conversation.id);

      const actualDuration = Math.ceil(
        (Date.now() - new Date(sessionState.conversation.started_at).getTime()) / (1000 * 60)
      );

      // Actualizar en la base de datos
      const { error } = await supabase
        .from('conversations')
        .update({ 
          status: 'completed',
          duration_minutes: actualDuration,
          session_data: {
            ...sessionState.conversation.session_data,
            completedAt: new Date().toISOString(),
            finalMessageCount: sessionState.messages.length,
            actualDuration
          }
        })
        .eq('id', sessionState.conversation.id);

      if (error) throw error;

      // Limpiar localStorage
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVITY);

      // Limpiar paused_conversations si existe
      await supabase
        .from('paused_conversations')
        .delete()
        .eq('user_id', user.id);

      console.log('✅ Session completed successfully');
      return true;

    } catch (error) {
      console.error('❌ Error completing session:', error);
      return false;
    } finally {
      isProcessingRef.current = false;
    }
  }, [sessionState.conversation, sessionState.messages, user?.id]);

  // Terminar sesión sin completar
  const endSession = useCallback(() => {
    console.log('🛑 Ending session');
    
    // Limpiar localStorage
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
    localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVITY);
    
    // Resetear estado
    updateSessionState({
      conversation: null,
      messages: [],
      hasActiveSession: false,
      isPaused: false,
      lastActivity: Date.now()
    });
  }, [updateSessionState]);

  // Actualizar actividad
  const updateActivity = useCallback(() => {
    setSessionState(prevState => ({
      ...prevState,
      lastActivity: Date.now()
    }));
  }, []);

  // Cargar sesión desde localStorage
  const loadSessionFromLocal = useCallback(() => {
    try {
      const savedSession = localStorage.getItem(STORAGE_KEYS.SESSION);
      const savedMessages = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      const savedActivity = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY);

      if (savedSession && savedMessages) {
        const conversation: Conversation = JSON.parse(savedSession);
        const messages: Message[] = JSON.parse(savedMessages);
        const lastActivity = savedActivity ? parseInt(savedActivity) : Date.now();

        console.log('📱 Loading session from localStorage:', conversation.id);

        updateSessionState({
          conversation,
          messages,
          hasActiveSession: conversation.status === 'active',
          isPaused: conversation.status === 'paused',
          lastActivity
        });
      }
    } catch (error) {
      console.error('❌ Error loading from localStorage:', error);
    }
  }, [updateSessionState]);

  // Sincronizar con estado de base de datos
  const syncWithDatabaseState = useCallback(async (conversationId: string): Promise<void> => {
    if (!user?.id) return;
    
    const now = Date.now();
    if (now - lastSyncTime.current < 5000) { // Throttle a 5 segundos
      return;
    }
    lastSyncTime.current = now;

    try {
      console.log('🔄 Syncing with database state:', conversationId);

      // Obtener estado actualizado de la conversación
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (convError || !conversation) {
        console.error('❌ Error fetching conversation:', convError);
        return;
      }

      // Obtener mensajes actualizados
      const { data: dbMessages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (msgError) {
        console.error('❌ Error fetching messages:', msgError);
        return;
      }

      const messages: Message[] = (dbMessages || []).map((msg: any) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        created_at: msg.created_at,
        metadata: msg.metadata
      }));

      // Actualizar estado local con datos de la base de datos
      updateSessionState({
        conversation: conversation as Conversation,
        messages,
        hasActiveSession: conversation.status === 'active',
        isPaused: conversation.status === 'paused'
      });

      console.log('✅ Successfully synced with database');

    } catch (error) {
      console.error('❌ Error syncing with database:', error);
    }
  }, [user?.id, updateSessionState]);

  //