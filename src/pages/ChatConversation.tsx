import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useAutoPause } from '@/hooks/useAutoPause';
import { useConversationState } from '@/hooks/useConversationState';
import LoadingSpinner from '@/components/LoadingSpinner';
import ConversationInterface from '@/components/ConversationInterface';

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
}

const ChatConversation: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Refs for cleanup and tracking
  const subscriptionRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  
  // Session and conversation management
  const {
    sessionState,
    hasActiveSession,
    isPaused,
    conversation,
    messages,
    startNewSession,
    resumeSession,
    addMessageToSession,
    pauseSession,
    completeSession,
    updateActivity
  } = useSessionManager();

  // State management
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAIWaiting, setIsAIWaiting] = useState(false);

  // Auto-pause functionality
  useAutoPause({
    isSessionActive: hasActiveSession,
    onAutoPause: () => {
      console.log('🚫 [ChatConversation] Auto-pause triggered');
      handlePauseSession();
    },
    timeoutMinutes: 2
  });

  // Conversation state management
  const { generateResumeMessage } = useConversationState();

  // Initialize conversation on component mount
  useEffect(() => {
    if (!user || hasInitialized.current) return;
    
    hasInitialized.current = true;
    
    const urlParams = new URLSearchParams(location.search);
    const resumeId = urlParams.get('resume');
    
    if (resumeId) {
      handleResumeById(resumeId);
    } else {
      createNewConversation();
    }
    
    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [user]);

  // Setup realtime subscription for new messages
  const setupRealtimeSubscription = async (conversationId: string) => {
    try {
      // Clean up existing subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }

      channelRef.current = supabase
        .channel(`conversation:${conversationId}`)
        .on('postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          },
          (payload) => {
            console.log('📨 [ChatConversation] New message received via realtime:', payload.new);
            
            const newMessage: Message = {
              id: payload.new.id,
              role: payload.new.role as 'user' | 'assistant',
              content: payload.new.content,
              created_at: payload.new.created_at,
              metadata: payload.new.metadata
            };
            
            addMessageToSession(newMessage);
            setIsAIWaiting(false);
          }
        )
        .subscribe();

      subscriptionRef.current = channelRef.current;
      console.log('✅ [ChatConversation] Realtime subscription established for conversation:', conversationId);

    } catch (error) {
      console.error('❌ [ChatConversation] Error setting up realtime subscription:', error);
    }
  };

  // Fallback to check for new messages directly from database
  const checkForNewMessages = async (conversationId: string, lastMessageId?: string) => {
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (lastMessageId) {
        query = query.gt('created_at', 
          messages.find(m => m.id === lastMessageId)?.created_at || new Date().toISOString()
        );
      }

      const { data: newMessages, error } = await query;
      
      if (error) throw error;
      
      if (newMessages && newMessages.length > 0) {
        console.log('📨 [ChatConversation] Found new messages via fallback check:', newMessages.length);
        
        newMessages.forEach(msg => {
          const message: Message = {
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            created_at: msg.created_at,
            metadata: msg.metadata
          };
          addMessageToSession(message);
        });
        
        setIsAIWaiting(false);
      }
    } catch (error) {
      console.error('❌ [ChatConversation] Error checking for new messages:', error);
    }
  };

  // Create new conversation
  const createNewConversation = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('🆕 [ChatConversation] Creating new conversation...');

      // Count existing conversations for numbering
      const { count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const conversationNumber = (count || 0) + 1;

      // Create new conversation
      const { data: newConversation, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: `Chat ${conversationNumber}`,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ [ChatConversation] New conversation created:', newConversation.id);

      // Initialize session
      startNewSession(newConversation as Conversation, []);
      
      // Setup realtime subscription
      await setupRealtimeSubscription(newConversation.id);

      // Send initial AI message
      await sendAIFirstMessage(newConversation.id);

    } catch (error) {
      console.error('❌ [ChatConversation] Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Failed to start new conversation",
        variant: "destructive",
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Send first AI message to start conversation
  const sendAIFirstMessage = async (conversationId: string) => {
    try {
      console.log('🤖 [ChatConversation] Sending AI first message...');
      
      const userName = user?.email?.split('@')[0] || 'there';
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          conversationId,
          message: `Hello ${userName}! I'm here to provide a supportive space for our conversation. How are you feeling today? What's on your mind?`,
          isFirstMessage: true,
          userName
        }
      });

      if (response.error) throw response.error;
      
      console.log('✅ [ChatConversation] AI first message sent successfully');

    } catch (error) {
      console.error('❌ [ChatConversation] Error sending AI first message:', error);
    }
  };

  // Handle user message sending
  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !conversation?.id || loading) return;

    try {
      setLoading(true);
      setIsAIWaiting(true);
      updateActivity();

      console.log('💬 [ChatConversation] Sending user message...');

      // Add user message to session immediately
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message.trim(),
        created_at: new Date().toISOString()
      };

      addMessageToSession(userMessage);
      setTextInput('');

      // Send to AI
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          conversationId: conversation.id,
          message: message.trim(),
          userName: user?.email?.split('@')[0] || 'User'
        }
      });

      if (error) throw error;

      console.log('✅ [ChatConversation] Message sent to AI successfully');

      // Start fallback check for AI response
      setTimeout(() => {
        if (isAIWaiting) {
          console.log('⏰ [ChatConversation] Starting fallback message check...');
          checkForNewMessages(conversation.id, userMessage.id);
        }
      }, 3000);

    } catch (error: any) {
      console.error('❌ [ChatConversation] Error sending message:', error);
      setIsAIWaiting(false);
      toast({
        title: "Error sending message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Resume conversation by ID
  const handleResumeById = async (conversationId: string) => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('🔄 [ChatConversation] Resuming conversation by ID:', conversationId);

      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (convError) throw convError;

      const { data: conversationMessages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;

      const messages: Message[] = (conversationMessages || []).map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        created_at: msg.created_at,
        metadata: msg.metadata
      }));

      await supabase
        .from('conversations')
        .update({ status: 'active' })
        .eq('id', conversationId);

      resumeSession(conversation as Conversation, messages);
      await setupRealtimeSubscription(conversationId);

      const resumeMessage = generateResumeMessage(
        conversation.session_data || { lastTopic: conversation.title, pausedAt: (conversation.session_data as any)?.pausedAt },
        user.email?.split('@')[0] || 'there'
      );
      
      const aiResumeMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: resumeMessage,
        created_at: new Date().toISOString(),
        metadata: { isResumeMessage: true }
      };
      
      addMessageToSession(aiResumeMessage);

    } catch (error) {
      console.error('❌ Error resuming conversation:', error);
      await createNewConversation();
    } finally {
      setLoading(false);
    }
  };

  // Continue paused conversation
  const handleContinuePausedConversation = async () => {
    if (!user) return;

    try {
      const { data: pausedConv } = await supabase
        .from('paused_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!pausedConv) {
        await createNewConversation();
        return;
      }

      const previousMessages = typeof pausedConv.message_history === 'string' 
        ? JSON.parse(pausedConv.message_history)
        : pausedConv.message_history;

      const { data: newConversation, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: `Continued ${pausedConv.conversation_title}`,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      resumeSession(newConversation as Conversation, previousMessages);
      await setupRealtimeSubscription(newConversation.id);

      const resumeMessage = generateResumeMessage(
        { lastTopic: pausedConv.conversation_title, pausedAt: pausedConv.created_at },
        user.email?.split('@')[0] || 'there'
      );
      
      const aiResumeMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: resumeMessage,
        created_at: new Date().toISOString(),
        metadata: { isResumeMessage: true }
      };
      
      addMessageToSession(aiResumeMessage);

      await supabase
        .from('paused_conversations')
        .delete()
        .eq('id', pausedConv.id);

    } catch (error) {
      console.error('❌ Error continuing paused conversation:', error);
      await createNewConversation();
    }
  };

  // Pause session
  const handlePauseSession = async () => {
    if (!conversation?.id || isPaused) return;

    try {
      console.log('⏸️ [ChatConversation] Pausing session...');
      
      await pauseSession(conversation.id, {
        lastTopic: `Chat session with ${messages.length} messages`,
        pausedAt: new Date().toISOString(),
        messageCount: messages.length
      });

      toast({
        title: "Session Paused",
        description: "Your conversation has been saved. You can resume it from your dashboard.",
      });

      navigate('/dashboard');
    } catch (error) {
      console.error('❌ Error pausing session:', error);
      toast({
        title: "Error",
        description: "Failed to pause session",
        variant: "destructive",
      });
    }
  };

  // Resume session
  const handleResumeSession = async () => {
    if (!conversation?.id || !isPaused) return;

    try {
      console.log('▶️ [ChatConversation] Resuming session...');
      
      await supabase
        .from('conversations')
        .update({ status: 'active' })
        .eq('id', conversation.id);

      // Reinitialize session state
      resumeSession(conversation, messages);

      toast({
        title: "Session Resumed",
        description: "Welcome back! Your conversation continues.",
      });
    } catch (error) {
      console.error('❌ Error resuming session:', error);
      toast({
        title: "Error",
        description: "Failed to resume session",
        variant: "destructive",
      });
    }
  };

  // End session
  const handleEndSession = async () => {
    if (!conversation?.id) return;

    try {
      console.log('🏁 [ChatConversation] Ending session...');

      const completedConversation = await completeSession(conversation.id, {
        endReason: 'user_ended',
        finalMessageCount: messages.length,
        completedAt: new Date().toISOString()
      });

      if (completedConversation) {
        toast({
          title: "Session Completed",
          description: "Your conversation has been saved and analyzed.",
        });
        
        navigate(`/session-recap/${conversation.id}`);
      }
    } catch (error) {
      console.error('❌ Error ending session:', error);
      toast({
        title: "Error",
        description: "Failed to end session properly",
        variant: "destructive",
      });
      navigate('/dashboard');
    }
  };

  // Auto scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (loading && !conversation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ConversationInterface
        messages={messages}
        textInput={textInput}
        setTextInput={setTextInput}
        isRecording={false}
        isLoading={loading}
        isAIWaiting={isAIWaiting}
        inputMode="text"
        sessionActive={hasActiveSession && !isPaused}
        sessionPaused={isPaused}
        onSendMessage={handleSendMessage}
        onStartRecording={() => {}}
        onStopRecording={() => {}}
        onSendTranscription={() => {}}
        onToggleInputMode={() => {}}
        onPauseSession={handlePauseSession}
        onResumeSession={handleResumeSession}
        onEndSession={handleEndSession}
        sessionTime={sessionState?.sessionDuration || 0}
        className="h-screen"
      />
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatConversation;