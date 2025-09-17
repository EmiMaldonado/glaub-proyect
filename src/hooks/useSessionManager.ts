import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
}

interface SessionState {
  conversation: Conversation | null;
  messages: Message[];
  lastActivity: string;
  sessionStartTime: string;
  autoSaveEnabled: boolean;
  isPaused: boolean;
}

const SESSION_STORAGE_KEY = 'chat_session_state';
const AUTOSAVE_INTERVAL = 30000; // 30 seconds
const SESSION_TIMEOUT = 900000; // 15 minutes

export const useSessionManager = () => {
  const { user } = useAuth();
  const [sessionState, setSessionState] = useState<SessionState>({
    conversation: null,
    messages: [],
    lastActivity: new Date().toISOString(),
    sessionStartTime: new Date().toISOString(),
    autoSaveEnabled: true,
    isPaused: false
  });
  
  const autoSaveTimerRef = useRef<NodeJS.Timeout>();
  const sessionTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSaveRef = useRef<string>('');

  // Save session to localStorage
  const saveSessionToLocal = useCallback((state: SessionState) => {
    if (!user) return;
    
    try {
      const sessionData = {
        ...state,
        userId: user.id,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
      sessionStorage.setItem(`${SESSION_STORAGE_KEY}_backup`, JSON.stringify(sessionData));
      lastSaveRef.current = sessionData.timestamp;
      
      console.log('💾 Session saved to local storage');
    } catch (error) {
      console.error('Error saving session to localStorage:', error);
    }
  }, [user]);

  // Load session from localStorage
  const loadSessionFromLocal = useCallback((): SessionState | null => {
    if (!user) return null;
    
    try {
      // Try localStorage first, then sessionStorage as backup
      let sessionData = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!sessionData) {
        sessionData = sessionStorage.getItem(`${SESSION_STORAGE_KEY}_backup`);
      }
      
      if (!sessionData) return null;
      
      const parsed = JSON.parse(sessionData);
      
      // Verify session belongs to current user and isn't too old
      if (parsed.userId !== user.id) return null;
      
      const sessionAge = Date.now() - new Date(parsed.timestamp).getTime();
      if (sessionAge > SESSION_TIMEOUT) {
        clearLocalSession();
        return null;
      }
      
      console.log('📂 Session loaded from local storage');
      return {
        conversation: parsed.conversation,
        messages: parsed.messages || [],
        lastActivity: parsed.lastActivity,
        sessionStartTime: parsed.sessionStartTime,
        autoSaveEnabled: parsed.autoSaveEnabled ?? true,
        isPaused: parsed.isPaused ?? false
      };
    } catch (error) {
      console.error('Error loading session from localStorage:', error);
      return null;
    }
  }, [user]);

  // Clear local session
  const clearLocalSession = useCallback(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(`${SESSION_STORAGE_KEY}_backup`);
    console.log('🗑️ Local session cleared');
  }, []);

  // Save session to database
  const saveSessionToDatabase = useCallback(async (state: SessionState, isEmergencySave = false) => {
    if (!user || !state.conversation || state.messages.length === 0) return;

    try {
      await supabase
        .from('paused_conversations')
        .upsert({
          user_id: user.id,
          message_history: JSON.stringify(state.messages),
          conversation_title: state.conversation.title,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (!isEmergencySave) {
        console.log('💽 Session saved to database');
      }
    } catch (error) {
      console.error('Error saving session to database:', error);
    }
  }, [user]);

  // Update session activity
  const updateActivity = useCallback(() => {
    const now = new Date().toISOString();
    setSessionState(prev => {
      const newState = { ...prev, lastActivity: now };
      saveSessionToLocal(newState);
      return newState;
    });
    
    // Reset session timeout
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
    sessionTimeoutRef.current = setTimeout(() => {
      handleSessionTimeout();
    }, SESSION_TIMEOUT);
  }, [saveSessionToLocal]);

  // Handle session timeout
  const handleSessionTimeout = useCallback(async () => {
    if (sessionState.conversation && sessionState.messages.length > 0) {
      await saveSessionToDatabase(sessionState, true);
      toast({
        title: "Session Auto-Saved",
        description: "Your conversation was automatically saved due to inactivity",
      });
    }
    
      setSessionState(prev => ({
        ...prev,
        conversation: null,
        messages: [],
        isPaused: false
      }));
    clearLocalSession();
  }, [sessionState, saveSessionToDatabase, clearLocalSession]);

  // Start new session
  const startNewSession = useCallback((conversation: Conversation) => {
    const newState: SessionState = {
      conversation,
      messages: [],
      lastActivity: new Date().toISOString(),
      sessionStartTime: new Date().toISOString(),
      autoSaveEnabled: true,
      isPaused: false
    };
    
    setSessionState(newState);
    saveSessionToLocal(newState);
    updateActivity();
    
    console.log('🚀 New session started');
  }, [saveSessionToLocal, updateActivity]);

  // Resume existing session
  const resumeSession = useCallback((conversation: Conversation, messages: Message[]) => {
    const newState: SessionState = {
      conversation,
      messages,
      lastActivity: new Date().toISOString(),
      sessionStartTime: new Date().toISOString(),
      autoSaveEnabled: true,
      isPaused: false
    };
    
    setSessionState(newState);
    saveSessionToLocal(newState);
    updateActivity();
    
    console.log('▶️ Session resumed with', messages.length, 'messages');
  }, [saveSessionToLocal, updateActivity]);

  // Add message to session
  const addMessageToSession = useCallback((message: Message) => {
    setSessionState(prev => {
      const newState = {
        ...prev,
        messages: [...prev.messages, message],
        lastActivity: new Date().toISOString()
      };
      saveSessionToLocal(newState);
      return newState;
    });
    updateActivity();
  }, [saveSessionToLocal, updateActivity]);

  // Pause current session
  const pauseSession = useCallback(async () => {
    if (!sessionState.conversation || sessionState.messages.length === 0) return false;

    try {
      await saveSessionToDatabase(sessionState);
      
      toast({
        title: "Session Paused",
        description: "Your conversation is now paused. You can resume anytime.",
      });
      
      setSessionState(prev => ({
        ...prev,
        isPaused: true,
        lastActivity: new Date().toISOString()
      }));
      
      return true;
    } catch (error) {
      console.error('Error pausing session:', error);
      return false;
    }
  }, [sessionState, saveSessionToDatabase]);

  // Resume current session
  const resumePausedSession = useCallback(() => {
    if (!sessionState.isPaused) return false;

    toast({
      title: "Session Resumed",
      description: "Welcome back! Your conversation continues.",
    });

    setSessionState(prev => ({
      ...prev,
      isPaused: false,
      lastActivity: new Date().toISOString()
    }));

    updateActivity();
    return true;
  }, [sessionState.isPaused, updateActivity]);

  // End session
  const endSession = useCallback(async () => {
    if (!sessionState.conversation) return false;

    try {
      const durationMinutes = Math.floor(
        (Date.now() - new Date(sessionState.sessionStartTime).getTime()) / 60000
      );

      await supabase
        .from('conversations')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_minutes: durationMinutes
        })
        .eq('id', sessionState.conversation.id);

      // Clear paused conversation if exists
      await supabase
        .from('paused_conversations')
        .delete()
        .eq('user_id', user?.id);

      clearLocalSession();
      setSessionState(prev => ({
        ...prev,
        conversation: null,
        messages: [],
        isPaused: false
      }));

      toast({
        title: "Session Completed",
        description: "Your conversation has been saved successfully",
      });

      return true;
    } catch (error) {
      console.error('Error ending session:', error);
      return false;
    }
  }, [sessionState, user, clearLocalSession]);

  // Check for existing session on mount
  useEffect(() => {
    if (!user) return;

    const existingSession = loadSessionFromLocal();
    if (existingSession) {
      setSessionState(existingSession);
      updateActivity();
    }
  }, [user, loadSessionFromLocal, updateActivity]);

  // Setup auto-save
  useEffect(() => {
    if (!sessionState.autoSaveEnabled || !sessionState.conversation) return;

    autoSaveTimerRef.current = setInterval(() => {
      if (sessionState.messages.length > 0) {
        saveSessionToDatabase(sessionState);
      }
    }, AUTOSAVE_INTERVAL);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [sessionState, saveSessionToDatabase]);

  // Handle page unload (emergency save)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (sessionState.conversation && sessionState.messages.length > 0) {
        // Synchronous save to localStorage (database save might not complete)
        saveSessionToLocal(sessionState);
        
        // Try emergency database save (may not complete)
        saveSessionToDatabase(sessionState, true);
        
        // Show warning if user tries to leave with unsaved changes
        const message = "You have an active conversation. Are you sure you want to leave?";
        event.returnValue = message;
        return message;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && sessionState.conversation) {
        saveSessionToLocal(sessionState);
        saveSessionToDatabase(sessionState, true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionState, saveSessionToLocal, saveSessionToDatabase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    conversation: sessionState.conversation,
    messages: sessionState.messages,
    hasActiveSession: !!sessionState.conversation && !sessionState.isPaused,
    isPaused: sessionState.isPaused,
    sessionStartTime: sessionState.sessionStartTime,
    lastActivity: sessionState.lastActivity,
    
    // Actions
    startNewSession,
    resumeSession,
    addMessageToSession,
    pauseSession,
    resumePausedSession,
    endSession,
    updateActivity,
    clearLocalSession,
    
    // Utils
    loadSessionFromLocal
  };
};