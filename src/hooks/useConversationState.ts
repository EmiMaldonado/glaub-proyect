import { useState, useCallback } from 'react';
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
  session_data?: any;
  insights?: any;
  ocean_signals?: any;
}

interface ConversationState {
  hasActiveConversation: boolean;
  hasPausedConversation: boolean;
  pausedConversationId: string | null;
  conversationContext?: string;
  pausedAt?: string;
  lastTopic?: string;
}

export const useConversationState = () => {
  const [conversationState, setConversationState] = useState<ConversationState>({
    hasActiveConversation: false,
    hasPausedConversation: false,
    pausedConversationId: null
  });

  const [isLoading, setIsLoading] = useState(false);

  // Get conversation state for dashboard
  const getConversationState = useCallback(async (userId: string): Promise<ConversationState> => {
    try {
      setIsLoading(true);
      console.log('🔍 [ConversationState] Fetching conversation state for user:', userId);

      // Check for paused conversations in the conversations table
      const { data: pausedConv, error: pausedError } = await supabase
        .from('conversations')
        .select('id, title, session_data, created_at, started_at')
        .eq('user_id', userId)
        .eq('status', 'paused')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pausedError) throw pausedError;
      console.log('📊 [ConversationState] Paused conversation found:', pausedConv);

      // Also check the old paused_conversations table for backward compatibility
      const { data: oldPausedConv, error: oldPausedError } = await supabase
        .from('paused_conversations')
        .select('id, conversation_title, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (oldPausedError) throw oldPausedError;

      // Check for active conversations
      const { data: activeConv, error: activeError } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (activeError) throw activeError;

      let state: ConversationState = {
        hasActiveConversation: !!activeConv,
        hasPausedConversation: false,
        pausedConversationId: null
      };

      // Prioritize new paused conversations system
      if (pausedConv) {
        const sessionData = pausedConv.session_data as any;
        state = {
          ...state,
          hasPausedConversation: true,
          pausedConversationId: pausedConv.id,
          conversationContext: pausedConv.title,
          lastTopic: sessionData?.lastTopic,
          pausedAt: sessionData?.pausedAt
        };
        console.log('✅ [ConversationState] Found paused conversation:', pausedConv.id);
      } else if (oldPausedConv) {
        // Fallback to old system
        state = {
          ...state,
          hasPausedConversation: true,
          pausedConversationId: oldPausedConv.id,
          conversationContext: oldPausedConv.conversation_title,
          pausedAt: oldPausedConv.created_at
        };
        console.log('✅ [ConversationState] Found old paused conversation:', oldPausedConv.id);
      } else {
        console.log('❌ [ConversationState] No paused conversations found');
      }

      console.log('🔄 [ConversationState] Final state:', state);
      setConversationState(state);
      return state;
    } catch (error) {
      console.error('Error getting conversation state:', error);
      const fallbackState: ConversationState = {
        hasActiveConversation: false,
        hasPausedConversation: false,
        pausedConversationId: null
      };
      setConversationState(fallbackState);
      return fallbackState;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Resume paused conversation
  const resumeConversation = useCallback(async (conversationId: string, userId: string) => {
    try {
      setIsLoading(true);

      // Get the paused conversation with session data
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (convError) throw convError;

      // Update status from 'paused' to 'active'
      const sessionData = conversation.session_data as any;
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ 
          status: 'active',
          session_data: {
            ...(sessionData || {}),
            resumedAt: new Date().toISOString()
          }
        })
        .eq('id', conversationId);

      if (updateError) throw updateError;

      toast({
        title: "Conversation Resumed",
        description: "Welcome back! Your conversation continues where you left off.",
      });

      return conversation;
    } catch (error) {
      console.error('Error resuming conversation:', error);
      toast({
        title: "Resume Failed",
        description: "Could not resume conversation. Please try starting a new one.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Start new conversation (clears paused conversations)
  const startNewConversation = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);

      // Clear any existing paused conversations
      await supabase
        .from('conversations')
        .update({ status: 'terminated' })
        .eq('user_id', userId)
        .eq('status', 'paused');

      // Also clear old paused conversations table
      await supabase
        .from('paused_conversations')
        .delete()
        .eq('user_id', userId);

      // Count existing conversations for numbering
      const { count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const conversationNumber = (count || 0) + 1;

      // Create new conversation
      const { data: newConversation, error } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          title: `Conversation ${conversationNumber}`,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation state
      setConversationState({
        hasActiveConversation: true,
        hasPausedConversation: false,
        pausedConversationId: null
      });

      return newConversation;
    } catch (error) {
      console.error('Error starting new conversation:', error);
      toast({
        title: "Error",
        description: "Could not start new conversation",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Generate resume message with context
  const generateResumeMessage = useCallback((sessionData: any, userName: string): string => {
    if (!sessionData) {
      return `Hi ${userName}! Welcome back. How would you like to continue our conversation?`;
    }

    const { lastTopic, userConcerns, pausedAt } = sessionData;
    
    let resumeMessage = `Hi ${userName}! Welcome back to our conversation`;
    
    if (lastTopic) {
      resumeMessage += ` where we were discussing ${lastTopic}`;
    }
    
    if (userConcerns && userConcerns.length > 0) {
      resumeMessage += `. We were exploring your concerns about ${userConcerns.join(' and ')}`;
    }
    
    if (pausedAt) {
      const pausedDate = new Date(pausedAt);
      const now = new Date();
      const hoursDiff = Math.floor((now.getTime() - pausedDate.getTime()) / (1000 * 60 * 60));
      
      if (hoursDiff < 24) {
        resumeMessage += ` from earlier today`;
      } else {
        resumeMessage += ` from ${Math.floor(hoursDiff / 24)} day(s) ago`;
      }
    }
    
    resumeMessage += '. How are you feeling now, and what would you like to focus on?';
    
    return resumeMessage;
  }, []);

  // Force refresh conversation state
  const refetchConversationState = useCallback(async (userId: string) => {
    await getConversationState(userId);
  }, [getConversationState]);

  return {
    conversationState,
    isLoading,
    getConversationState,
    resumeConversation,
    startNewConversation,
    generateResumeMessage,
    refetchConversationState
  };
};