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

interface PausedConversation {
  id: string;
  user_id: string;
  message_history: any; // JSON from database
  conversation_title: string;
  created_at: string;
}

export const usePausedConversations = () => {
  const [isLoading, setIsLoading] = useState(false);

  // Save conversation to temporary storage (overwrites any existing paused conversation)
  const pauseConversation = useCallback(async (
    userId: string,
    messages: Message[],
    title: string = 'Paused Conversation'
  ) => {
    try {
      setIsLoading(true);

      // First, delete any existing paused conversation for this user (only keep most recent)
      await supabase
        .from('paused_conversations')
        .delete()
        .eq('user_id', userId);

      // Save the new paused conversation with raw message history only
      const { error } = await supabase
        .from('paused_conversations')
        .insert({
          user_id: userId,
          message_history: JSON.stringify(messages),
          conversation_title: title
        });

      if (error) throw error;

      toast({
        title: "✅ Conversación pausada",
        description: "Tu conversación ha sido guardada. Puedes continuarla desde el dashboard.",
      });

      return true;
    } catch (error) {
      console.error('Error pausing conversation:', error);
      toast({
        title: "Error",
        description: "Could not pause the conversation",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get paused conversation for user
  const getPausedConversation = useCallback(async (userId: string): Promise<PausedConversation | null> => {
    try {
      const { data, error } = await supabase
        .from('paused_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as PausedConversation;
    } catch (error) {
      console.error('Error getting paused conversation:', error);
      return null;
    }
  }, []);

  // Continue paused conversation (one-time use - deletes after retrieval)
  const continuePausedConversation = useCallback(async (userId: string): Promise<Message[] | null> => {
    try {
      setIsLoading(true);

      // Get the paused conversation
      const pausedConv = await getPausedConversation(userId);
      if (!pausedConv) return null;

      // Delete it immediately (one-time use)
      await supabase
        .from('paused_conversations')
        .delete()
        .eq('id', pausedConv.id);

      // Parse and return the message history
      const messages = typeof pausedConv.message_history === 'string' 
        ? JSON.parse(pausedConv.message_history)
        : pausedConv.message_history;
      
      return messages as Message[];
    } catch (error) {
      console.error('Error continuing paused conversation:', error);
      toast({
        title: "Error",
        description: "Could not continue the paused conversation",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getPausedConversation]);

  // Delete paused conversation (used when starting new conversation)
  const clearPausedConversation = useCallback(async (userId: string) => {
    try {
      await supabase
        .from('paused_conversations')
        .delete()
        .eq('user_id', userId);
    } catch (error) {
      console.error('Error clearing paused conversation:', error);
    }
  }, []);

  return {
    pauseConversation,
    getPausedConversation,
    continuePausedConversation,
    clearPausedConversation,
    isLoading
  };
};
