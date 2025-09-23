import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pause, Play, Power } from 'lucide-react';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useAutoPause } from '@/hooks/useAutoPause';
import { useConversationState } from '@/hooks/useConversationState';

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

const ChatConversation: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const continueConversation = searchParams.get('continue');
  const {
    conversation,
    messages,
    hasActiveSession,
    isPaused,
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
  } = useSessionManager();

  const { generateResumeMessage, refetchConversationState } = useConversationState();
  
  // TEMPORARILY DISABLE auto-pause during initialization to avoid conflicts
  const [autoResumeEnabled, setAutoResumeEnabled] = useState(false);
  
  // Enhanced auto-pause system with unified state management and audio control
  const { pauseConversationWithContext } = useAutoPause({
    conversation: autoResumeEnabled ? conversation : null, // Disable during init
    messages: autoResumeEnabled ? messages : [],
    userId: autoResumeEnabled ? user?.id : undefined,
    onPause: () => {
      navigate('/dashboard');
    },
    updateSessionState,
    onConversationPaused: (conversationId) => {
      if (user?.id && autoResumeEnabled) {
        syncWithDatabaseState(conversationId);
        refetchConversationState(user.id);
      }
    },
    pauseSessionFunction: pauseSession
  });
  
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isWaitingForAI, setIsWaitingForAI] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  // DEBUGGING: Verificar estado de Supabase
  const checkSupabaseConnection = () => {
    const connectionStatus = supabase.realtime.connection?.readyState;
    const connectionMap: { [key: number]: string } = {
      0: 'CONNECTING',
      1: 'OPEN', 
      2: 'CLOSING',
      3: 'CLOSED'
    };
    
    console.log('🔌 Supabase connection status:', connectionStatus, connectionMap[connectionStatus || 3]);
    return connectionStatus === 1;
  };

  // Setup real-time subscription with proper cleanup and validation
  const setupRealtimeSubscription = async (conversationId: string) => {
    // CRITICAL: Validate conversationId before proceeding
    if (!conversationId || conversationId === 'undefined' || conversationId === 'null') {
      console.error('❌ Invalid conversationId for subscription:', conversationId);
      return;
    }

    // Clean up existing subscription
    if (channelRef.current) {
      console.log('🔕 Cleaning up existing subscription');
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('🔔 Setting up real-time subscription for:', conversationId);
    
    // Verify connection
    const isConnected = checkSupabaseConnection();
    if (!isConnected) {
      console.warn('⚠️ Supabase not connected, waiting...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Create subscription
    const channel = supabase
      .channel(`chat-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          console.log('📨 Real-time message received:', newMessage.role, newMessage.id);
          
          addMessageToSession(newMessage);
          
          if (newMessage.role === 'assistant') {
            console.log('✅ AI message received, clearing waiting state');
            setIsWaitingForAI(false);
          }
        }
      )
      .subscribe((status) => {
        console.log('🔔 Subscription status:', status, 'for:', conversationId);
      });

    channelRef.current = channel;
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Real-time subscription ready for:', conversationId);
  };

  // FIXED: Create new conversation with single-call protection
  const createNewConversation = async () => {
    if (!user || isLoading) {
      console.log('❌ Cannot create conversation: no user or loading');
      return;
    }

    // Prevent multiple simultaneous calls
    if (isLoading) {
      console.log('⚠️ Already creating conversation, skipping duplicate call');
      return;
    }

    try {
      setIsLoading(true);
      setIsWaitingForAI(true);
      
      console.log('🚀 SINGLE CALL - Creating new conversation for user:', user.id);
      
      // Clean up existing state
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Clear paused conversations when creating new
      console.log('🗑️ Clearing existing paused conversations');
      await supabase
        .from('paused_conversations')
        .delete()
        .eq('user_id', user.id);
      
      // Count conversations for numbering
      const { count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const conversationNumber = (count || 0) + 1;
      
      // Create conversation in database
      const { data: newConversation, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: `Chat Conversation ${conversationNumber}`,
          status: 'active'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      // CRITICAL: Validate conversation was created with ID
      if (!newConversation?.id) {
        console.error('❌ No conversation ID returned:', newConversation);
        throw new Error('Failed to create conversation - no ID returned');
      }
      
      console.log('✅ Conversation created with ID:', newConversation.id);
      
      // Start session manager with new conversation
      startNewSession(newConversation as Conversation);

      // Setup subscription
      await setupRealtimeSubscription(newConversation.id);

      // CRITICAL: Add longer delay before AI message to ensure session is fully established
      console.log('⏰ Waiting for session to stabilize before AI message...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // Increased to 3 seconds

      // Send AI first message with VALIDATED conversationId
      await sendAIFirstMessage(newConversation.id);

    } catch (error) {
      console.error('❌ Error creating conversation:', error);
      setIsWaitingForAI(false);
      toast({
        title: "Error",
        description: "Could not create new conversation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // FIXED: Send AI first message with proper parameter validation
  const sendAIFirstMessage = async (conversationId: string) => {
    // CRITICAL: Validate conversationId before making request
    if (!conversationId || conversationId === 'undefined' || conversationId === 'null') {
      console.error('❌ Invalid conversationId for AI message:', conversationId);
      setIsWaitingForAI(false);
      toast({
        title: "Error",
        description: "Invalid conversation ID. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      console.error('❌ No user ID available');
      setIsWaitingForAI(false);
      return;
    }

    // CRITICAL: Verify conversation exists in session manager
    if (!conversation || conversation.id !== conversationId) {
      console.error('❌ Conversation state mismatch:', {
        sessionConversationId: conversation?.id,
        requestedId: conversationId
      });
      setIsWaitingForAI(false);
      toast({
        title: "Error",
        description: "Conversation state not ready. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🤖 Sending AI first message...');
      console.log('📝 ConversationId:', conversationId);
      console.log('👤 UserId:', user.id);
      console.log('🔍 Session state verified:', conversation.id);
      
      setIsWaitingForAI(true);
      
      // Get session context
      const { data: allConversations } = await supabase
        .from('conversations')
        .select('id, title, status, ended_at, insights, ocean_signals')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const completedConversations = allConversations?.filter(c => c.status === 'completed') || [];
      const isFirstSessionEver = completedConversations.length === 0;

      let initialMessage;
      let sessionContext;
      
      if (isFirstSessionEver) {
        initialMessage = "Start the first conversation with this user using the standard Glai introduction and personality discovery protocol.";
        sessionContext = {
          isFirstSession: true,
          sessionNumber: 1,
          modalityExperience: 'new_user'
        };
      } else {
        const voiceConversations = completedConversations.filter(c => 
          c.title?.toLowerCase().includes('voice') || 
          c.title?.toLowerCase().includes('session')
        );
        const hasUsedVoice = voiceConversations.length > 0;
        
        initialMessage = `This is session ${allConversations?.length || 1} with this returning user (${completedConversations.length} completed sessions). ${hasUsedVoice ? 'The user has previously used voice conversations and is now trying chat mode.' : 'Welcome them back to chat mode.'} Ask if there are new topics they'd like to explore today.`;
        sessionContext = {
          isFirstSession: false,
          sessionNumber: allConversations?.length || 1,
          completedSessions: completedConversations.length,
          hasUsedVoice
        };
      }

      console.log('📊 Session context:', sessionContext);
      console.log('💬 Initial message:', initialMessage);

      // FIXED: Proper parameter structure for Edge Function
      const requestBody = {
        message: initialMessage,
        conversationId: conversationId, // Ensure this is explicitly set
        userId: user.id, // Ensure this is explicitly set
        isFirstMessage: isFirstSessionEver,
        sessionContext: sessionContext,
        aiInitiated: true
      };

      console.log('🚀 Calling ai-chat function with body:', JSON.stringify(requestBody, null, 2));
      
      const response = await supabase.functions.invoke('ai-chat', {
        body: requestBody
      });

      console.log('📥 AI chat response:', response);

      if (response.error) {
        console.error('❌ Supabase function error:', response.error);
        throw new Error(response.error.message || 'AI function failed');
      }

      if (response.data?.error) {
        console.error('❌ AI chat function error:', response.data.error);
        throw new Error(response.data.error);
      }

      console.log('✅ AI function called successfully');

      // Check for AI response with backoff
      let checkAttempts = 0;
      const maxAttempts = 8;
      
      const checkLoop = async () => {
        checkAttempts++;
        console.log(`🔍 Checking for AI response (${checkAttempts}/${maxAttempts})`);
        
        const foundMessage = await checkForNewMessages(conversationId);
        
        if (foundMessage) {
          console.log('✅ AI message found');
          return;
        }
        
        if (checkAttempts < maxAttempts) {
          const delay = 2000 + (checkAttempts * 1000);
          setTimeout(checkLoop, delay);
        } else {
          console.error('❌ AI response timeout');
          setIsWaitingForAI(false);
          toast({
            title: "AI Response Delayed",
            description: "Please try typing a message to continue.",
            variant: "default",
          });
        }
      };

      setTimeout(checkLoop, 1000);

    } catch (error) {
      console.error('❌ Error in sendAIFirstMessage:', error);
      setIsWaitingForAI(false);
      toast({
        title: "Error",
        description: "AI couldn't start the conversation. Please type a message to begin.",
        variant: "destructive",
      });
    }
  };

  // Check for new messages fallback
  const checkForNewMessages = async (conversationId: string) => {
    try {
      console.log('🔍 Checking database for messages in:', conversationId);
      
      const { data: dbMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (dbMessages && dbMessages.length > 0) {
        const currentMessageIds = messages.map(m => m.id);
        const convertedMessages: Message[] = dbMessages.map((msg: any) => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          created_at: msg.created_at,
          metadata: msg.metadata
        }));

        let newMessagesAdded = 0;
        convertedMessages.forEach(msg => {
          if (!currentMessageIds.includes(msg.id)) {
            console.log('➕ Adding missing message:', msg.role, msg.content.substring(0, 50));
            addMessageToSession(msg);
            newMessagesAdded++;
          }
        });

        if (newMessagesAdded > 0) {
          console.log(`✅ Added ${newMessagesAdded} new messages`);
          setIsWaitingForAI(false);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error checking messages:', error);
      return false;
    }
  };

  // FIXED: Handle sending user messages with proper validation
  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;

    // CRITICAL: Validate conversation state
    if (!conversation?.id) {
      console.error('❌ No conversation ID available:', conversation);
      toast({
        title: "Error",
        description: "No active conversation. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      console.error('❌ No user ID available');
      return;
    }

    if (isLoading || isPaused) return;

    console.log('📤 Sending message:', messageText.trim());
    console.log('🔑 Using conversation ID:', conversation.id);
    console.log('👤 Using user ID:', user.id);

    setIsLoading(true);
    setIsWaitingForAI(true);
    updateActivity();

    const isFirstMessage = messages.length === 0;
    
    // Add user message to UI immediately
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText.trim(),
      created_at: new Date().toISOString(),
    };
    
    addMessageToSession(userMessage);
    setTextInput('');

    try {
      // FIXED: Ensure parameters are properly structured
      const requestBody = {
        message: messageText.trim(),
        conversationId: conversation.id, // Explicitly pass conversationId
        userId: user.id, // Explicitly pass userId
        isFirstMessage: isFirstMessage
      };

      console.log('🚀 Sending to ai-chat:', JSON.stringify(requestBody, null, 2));

      const response = await supabase.functions.invoke('ai-chat', {
        body: requestBody
      });

      if (response.error) {
        console.error('❌ Function error:', response.error);
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        console.error('❌ AI error:', response.data.error);
        throw new Error(response.data.error);
      }

      console.log('✅ Message sent successfully');

      // Check for AI response
      let attempts = 0;
      const checkResponse = async () => {
        attempts++;
        const found = await checkForNewMessages(conversation.id);
        
        if (!found && attempts < 5) {
          setTimeout(checkResponse, 6000);
        } else if (!found) {
          setIsWaitingForAI(false);
          toast({
            title: "AI Response Delayed",
            description: "Please try again if no response appears.",
            variant: "default",
          });
        }
      };

      setTimeout(checkResponse, 4000);

    } catch (error) {
      console.error('❌ Error sending message:', error);
      setIsWaitingForAI(false);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not send message",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // FIXED: Initialize conversation with complete isolation from other hooks
  const hasInitializedRef = useRef(false);
  const isCreatingConversationRef = useRef(false);
  
  useEffect(() => {
    if (!user?.id) return;
    if (hasInitializedRef.current) {
      console.log('⚠️ Initialization already completed, skipping...');
      return;
    }
    if (isCreatingConversationRef.current) {
      console.log('⚠️ Already creating conversation, skipping...');
      return;
    }
    
    const initializeConversation = async () => {
      if (hasInitializedRef.current || isCreatingConversationRef.current) return;
      
      hasInitializedRef.current = true;
      isCreatingConversationRef.current = true;
      setIsInitializing(true);
      
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const resumeId = urlParams.get('resume');
        
        console.log('🔍 ISOLATED INITIALIZATION:', {
          userId: user.id,
          continueConversation,
          resumeId,
          url: window.location.href,
          timestamp: new Date().toISOString()
        });
        
        // DISABLE OTHER HOOKS TEMPORARILY
        console.log('🛑 Disabling other hooks during initialization');
        
        if (continueConversation === 'true') {
          console.log('🔄 Handling continue paused conversation');
          await handleContinuePausedConversation();
        } else if (resumeId) {
          console.log('🔄 Handling resume by ID:', resumeId);
          await handleResumeById(resumeId);
        } else {
          console.log('🤖 Creating ISOLATED new chat conversation');
          await createNewConversation();
        }
      } catch (error) {
        console.error('❌ Initialization error:', error);
        hasInitializedRef.current = false;
        isCreatingConversationRef.current = false;
        toast({
          title: "Error", 
          description: "Could not initialize conversation",
          variant: "destructive",
        });
      } finally {
        setIsInitializing(false);
        isCreatingConversationRef.current = false;
        console.log('✅ Isolated initialization completed');
        
        // ENABLE OTHER HOOKS AFTER INITIALIZATION
        setTimeout(() => {
          console.log('🔓 Re-enabling hooks after successful initialization');
          setAutoResumeEnabled(true);
        }, 2000);
      }
    };

    // DELAY INITIALIZATION to avoid conflicts with other components
    console.log('⏰ Delaying initialization to avoid hook conflicts...');
    setTimeout(initializeConversation, 1000);
    
  }, [user?.id]); // Only depend on user.id

  // Setup subscription when conversation changes
  useEffect(() => {
    if (!conversation?.id) return;

    console.log('🔄 Setting up subscription for conversation:', conversation.id);
    setupRealtimeSubscription(conversation.id);

    return () => {
      if (channelRef.current) {
        console.log('🔕 Cleaning up subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversation?.id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle resume by conversation ID
  const handleResumeById = async (conversationId: string) => {
    if (!user) return;

    try {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (conversation.status !== 'paused') {
        toast({
          title: "Invalid conversation",
          description: "This conversation is not available for resume",
          variant: "destructive",
        });
        await createNewConversation();
        return;
      }

      const { data: dbMessages } = await supabase  
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      const messages: Message[] = (dbMessages || []).map((msg: any) => ({
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
        { 
          lastTopic: conversation.title, 
          pausedAt: conversation.session_data?.pausedAt 
        },
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
      toast({
        title: "Error",
        description: "Could not resume conversation. Starting new one instead.",
        variant: "destructive",
      });
      await createNewConversation();
    }
  };

  // Handle continue paused conversation (legacy)
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
        toast({
          title: "No paused conversation found",
          description: "Starting a new conversation instead",
        });
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
      toast({
        title: "Error",
        description: "Could not continue paused conversation. Starting new one instead.",
        variant: "destructive",
      });
      await createNewConversation();
    }
  };

  // Handle pause session
  const handlePauseSession = async () => {
    if (!conversation || !user) return;

    try {
      console.log('🔄 Pausing session...');
      
      const { stopAllVoiceAudio } = await import('@/hooks/useTextToSpeech');
      stopAllVoiceAudio();
      
      const success = await pauseSession();
      if (success) {
        toast({
          title: "🔄 Conversation Paused",
          description: "Conversation paused successfully",
        });
        navigate('/dashboard');
      } else {
        toast({
          title: "Error",
          description: "Failed to pause conversation",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Pause error:', error);
      toast({
        title: "Error",
        description: "An error occurred while pausing",
        variant: "destructive",
      });
    }
  };

  // Handle resume session
  const handleResumeSession = () => {
    if (!conversation || !user) return;
    resumePausedSession();
  };

  // Handle end session
  const handleEndSession = async () => {
    if (!conversation) return;

    const userMessageCount = messages.filter(msg => msg.role === 'user').length;
    
    if (userMessageCount < 5) {
      toast({
        title: "Minimum Messages Required",
        description: `You need to send at least 5 messages before ending the session. You've sent ${userMessageCount} message${userMessageCount === 1 ? '' : 's'}.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const actualDuration = Math.ceil((Date.now() - new Date(conversation.started_at).getTime()) / (1000 * 60));
      const shouldGenerateInsights = actualDuration >= 1 && userMessageCount >= 5;

      const success = await completeSession();
      
      if (success && shouldGenerateInsights) {
        toast({
          title: "🎯 Session Complete!",
          description: `Session completed (${actualDuration} min). Generating insights...`,
        });

        try {
          const response = await supabase.functions.invoke('session-analysis', {
            body: {
              conversationId: conversation.id,
              userId: user?.id
            }
          });

          if (response.data) {
            navigate(`/session-summary?conversation_id=${conversation.id}`);
          } else {
            navigate('/dashboard');
          }
        } catch (analysisError) {
          toast({
            title: "Session Completed",
            description: "Session saved but analysis failed. Check dashboard for insights.",
            variant: "default",
          });
          navigate('/dashboard');
        }
      } else if (success) {
        toast({
          title: "Session Complete",
          description: `Session completed but was too brief (${actualDuration} min) for detailed insights`,
        });
        navigate('/dashboard');
      } else {
        throw new Error('Failed to complete session');
      }
    } catch (error) {
      console.error('❌ Error completing session:', error);
      toast({
        title: "⚠️ Completion Issues", 
        description: "Session may not be fully processed, but navigating to dashboard.",
        variant: "default",
      });
      setTimeout(() => navigate('/dashboard'), 1000);
    }
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-muted-foreground">Starting conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-medium">Therapeutic Chat</h1>
          </div>
          <div className="flex items-center space-x-2">
            {hasActiveSession && !isPaused && (
              <>
                <span className="text-sm text-amber-600 font-medium">⏸ Paused Session</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResumeSession}
                  className="text-sm"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Resume
                </Button>
              </>
            )}
            {hasActiveSession && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEndSession}
                disabled={messages.filter(msg => msg.role === 'user').length < 5}
                className="text-sm text-red-600 hover:text-red-700 disabled:text-gray-400"
              >
                <Power className="h-4 w-4 mr-1" />
                End
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col w-full">
        <div className="flex-1 overflow-hidden">
          <div className="w-full h-full flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4">
              {/* Paused State Banner */}
              {isPaused && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center space-x-2 text-amber-700">
                    <Pause className="h-5 w-5" />
                    <span className="font-medium">Session Paused</span>
                  </div>
                  <p className="text-sm text-amber-600 mt-1">
                    Your conversation is safely saved. Click Resume to continue.
                  </p>
                  <div className="mt-3 space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResumeSession}
                      className="text-amber-700 border-amber-300 hover:bg-amber-100"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Resume Conversation
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/dashboard')}
                      className="text-amber-600"
                    >
                      Return to Dashboard
                    </Button>
                  </div>
                </div>
              )}

              {/* Waiting for AI state */}
              {messages.length === 0 && isWaitingForAI && (
                <div className="text-center text-muted-foreground py-8">
                  <div className="max-w-md mx-auto space-y-4">
                    <LoadingSpinner />
                    <h3 className="text-lg font-medium text-foreground">AI is starting the conversation...</h3>
                    <p className="text-sm">
                      Your AI therapeutic assistant is preparing your first message. 
                      This should only take a moment.
                    </p>
                    <p className="text-xs opacity-75">
                      All conversations are private and secure.
                    </p>
                  </div>
                </div>
              )}

              {/* No messages and not waiting */}
              {messages.length === 0 && !isWaitingForAI && !isLoading && (
                <div className="text-center text-muted-foreground py-8">
                  <div className="max-w-md mx-auto space-y-4">
                    <h3 className="text-lg font-medium text-foreground">Ready to start your conversation</h3>
                    <p className="text-sm">
                      You can type a message below to begin, or wait for the AI to start automatically.
                    </p>
                    <Button 
                      onClick={() => createNewConversation()}
                      disabled={isLoading}
                      variant="outline"
                      size="sm"
                    >
                      Start AI Conversation
                    </Button>
                  </div>
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}

              {/* AI typing indicator */}
              {isWaitingForAI && messages.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-muted px-4 py-3 rounded-lg max-w-[80%]">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-xs text-muted-foreground">AI is typing...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t bg-background p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(textInput);
                    }
                  }}
                  placeholder={isPaused ? "Resume the conversation to continue..." : "Type your message..."}
                  disabled={isLoading || isPaused || isWaitingForAI}
                  className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Button
                  onClick={() => handleSendMessage(textInput)}
                  disabled={!textInput.trim() || isLoading || isPaused || isWaitingForAI}
                  size="sm"
                >
                  {isLoading ? (
                    <LoadingSpinner />
                  ) : (
                    'Send'
                  )}
                </Button>
              </div>
              
              {isPaused && (
                <p className="text-xs text-amber-600 mt-2 text-center">
                  Resume the conversation to continue messaging
                </p>
              )}
              
              {isWaitingForAI && (
                <p className="text-xs text-blue-600 mt-2 text-center">
                  Waiting for AI response...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatConversation;<span className="text-sm text-green-600 font-medium">● Active Session</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePauseSession}
                  className="text-sm"
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </Button>
              </>
            )}
            {isPaused && (
              <>
