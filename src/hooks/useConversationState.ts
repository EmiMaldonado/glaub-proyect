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
  insights?: any;
  ocean_signals?: any;
}

interface ConversationState {
  conversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  isInitializing: boolean;
}

export const useConversationState = () => {
  const [state, setState] = useState<ConversationState>({
    conversation: null,
    messages: [],
    isLoading: false,
    isInitializing: false
  });

  // Reset all conversation state
  const resetState = useCallback(() => {
    setState({
      conversation: null,
      messages: [],
      isLoading: false,
      isInitializing: false
    });
  }, []);

  // Update conversation
  const setConversation = useCallback((conversation: Conversation | null) => {
    setState(prev => ({ ...prev, conversation }));
  }, []);

  // Update messages
  const setMessages = useCallback((messages: Message[]) => {
    setState(prev => ({ ...prev, messages }));
  }, []);

  // Add message
  const addMessage = useCallback((message: Message) => {
    setState(prev => ({ ...prev, messages: [...prev.messages, message] }));
  }, []);

  // Update loading state
  const setIsLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  }, []);

  // Update initializing state
  const setIsInitializing = useCallback((isInitializing: boolean) => {
    setState(prev => ({ ...prev, isInitializing }));
  }, []);

  // Create new conversation
  const createNewConversation = useCallback(async (
    userId: string, 
    title: string, 
    modalityType: 'text' | 'voice' = 'text'
  ) => {
    try {
      setIsInitializing(true);
      resetState();

      const { data: newConversation, error } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          title,
          status: 'active',
          session_data: { modality: modalityType }
        })
        .select()
        .single();

      if (error) throw error;
      
      setConversation(newConversation as Conversation);
      return newConversation as Conversation;

    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Could not create new conversation",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsInitializing(false);
    }
  }, [resetState, setConversation, setIsInitializing]);

  // End conversation
  const endConversation = useCallback(async (conversationId: string, durationMinutes: number = 0) => {
    try {
      await supabase
        .from('conversations')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_minutes: durationMinutes
        })
        .eq('id', conversationId);

      toast({
        title: "✅ Session completed",
        description: "Conversation saved",
      });

    } catch (error) {
      console.error('Error ending conversation:', error);
      toast({
        title: "Error",
        description: "Could not finalize session",
        variant: "destructive",
      });
      throw error;
    }
  }, []);

  // Send message to AI
  const sendMessageToAI = useCallback(async (
    message: string,
    conversationId: string,
    userId: string,
    options: {
      isFirstMessage?: boolean;
      modalityType?: 'text' | 'voice' | 'realtime';
    } = {}
  ) => {
    try {
      setIsLoading(true);

      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message,
          conversationId,
          userId,
          ...options
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!options.isFirstMessage) {
        toast({
          title: "✅ Message sent",
          description: "The message has been processed successfully",
        });
      }

      return response.data;

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Could not send message",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading]);

  return {
    // State
    conversation: state.conversation,
    messages: state.messages,
    isLoading: state.isLoading,
    isInitializing: state.isInitializing,
    
    // Actions
    resetState,
    setConversation,
    setMessages,
    addMessage,
    setIsLoading,
    setIsInitializing,
    createNewConversation,
    endConversation,
    sendMessageToAI
  };
};