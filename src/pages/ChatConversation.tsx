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
  
  // Enhanced auto-pause system with unified state management and audio control
  const { pauseConversationWithContext } = useAutoPause({
    conversation,
    messages,
    userId: user?.id,
    onPause: () => {
      // Navigate to dashboard after auto-pause
      navigate('/dashboard');
    },
    updateSessionState,
    onConversationPaused: (conversationId) => {
      // Sync session state with database
      if (user?.id) {
        syncWithDatabaseState(conversationId);
        refetchConversationState(user.id);
      }
    },
    pauseSessionFunction: pauseSession // CRITICAL: Connect to session manager
  });
  
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create new conversation with AI automatically starting the conversation
  const createNewConversation = async () => {
    if (!user || isLoading) return;

    try {
      setIsLoading(true);
      
      console.log('🚀 Creating new conversation for user:', user.id);
      
      // Clear any existing paused conversation first (only one paused conversation allowed)
      await supabase
        .from('paused_conversations')
        .delete()
        .eq('user_id', user.id);
      
      // Count ALL existing conversations (voice + chat) for unified session numbering
      const { count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      const conversationNumber = (count || 0) + 1;
      
      // Create new conversation with unified numbering
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
        console.error('❌ Database error creating conversation:', error);
        throw error;
      }

      console.log('✅ New conversation created successfully:', newConversation);
      
      // CRITICAL: Verify that the conversation has an ID
      if (!newConversation?.id) {
        console.error('❌ Conversation created but ID is missing:', newConversation);
        throw new Error('Conversation created but ID is missing');
      }
      
      console.log('🔑 Conversation ID confirmed:', newConversation.id);
      
      // Start new session
      startNewSession(newConversation as Conversation);

      // Verify session state was updated correctly
      console.log('📊 Session state after startNewSession - conversation ID:', newConversation.id);

      // AI automatically starts the conversation with OCEAN profiling questions
      await sendAIFirstMessage(newConversation.id);

    } catch (error) {
      console.error('❌ Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Could not create new conversation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Send AI's first message to start the conversation with enhanced session context
  const sendAIFirstMessage = async (conversationId: string) => {
    try {
      console.log('🤖 Sending AI first message for conversation:', conversationId);
      
      // Get comprehensive session history for proper continuity
      const { data: allConversations } = await supabase
        .from('conversations')
        .select('id, title, status, ended_at, insights, ocean_signals')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      const completedConversations = allConversations?.filter(c => c.status === 'completed') || [];
      const totalSessionCount = (allConversations?.length || 0) + 1; // Include current session
      const isFirstSessionEver = completedConversations.length === 0;

      // Analyze conversation history for cross-mode awareness
      const voiceConversations = completedConversations.filter(c => 
        c.title?.toLowerCase().includes('voice') || 
        c.title?.toLowerCase().includes('session')
      );
      const chatConversations = completedConversations.filter(c => 
        c.title?.toLowerCase().includes('conversation') && 
        !c.title?.toLowerCase().includes('voice')
      );

      const hasUsedVoice = voiceConversations.length > 0;
      const hasUsedChat = chatConversations.length > 0;
      
      let sessionContext;
      
      if (isFirstSessionEver) {
        sessionContext = {
          isFirstSession: true,
          sessionNumber: 1,
          totalSessions: 1,
          modalityExperience: 'new_user'
        };
      } else {
        sessionContext = {
          isFirstSession: false,
          sessionNumber: totalSessionCount,
          totalSessions: totalSessionCount,
          completedSessions: completedConversations.length,
          hasUsedVoice,
          hasUsedChat,
          modalityExperience: hasUsedVoice && hasUsedChat ? 'cross_modal' : 
                             hasUsedVoice ? 'voice_to_chat' : 'chat_only'
        };
      }

      // Create context-aware initial message
      let initialMessage;
      
      if (isFirstSessionEver) {
        initialMessage = "Start the first conversation with this user using the standard Glai introduction and personality discovery protocol.";
      } else {
        const modalityContext = sessionContext.modalityExperience === 'voice_to_chat' 
          ? ` The user has previously used voice conversations with you (${voiceConversations.length} voice sessions) and is now trying chat mode for the first time.`
          : sessionContext.modalityExperience === 'cross_modal'
          ? ` The user has experience with both voice and chat modes.`
          : ` The user has used chat mode before.`;

        initialMessage = `This is session ${sessionContext.sessionNumber} with this returning user (${completedConversations.length} completed sessions).${modalityContext} Welcome them back warmly, acknowledge their previous sessions, and ask if there are new topics they'd like to explore today in chat mode.`;
      }

      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: initialMessage,
          conversationId: conversationId,
          userId: user?.id,
          isFirstMessage: isFirstSessionEver,
          sessionContext,
          aiInitiated: true
        }
      });

      if (response.error) {
        console.error('Supabase function error:', response.error);
        throw new Error(response.error.message || 'Failed to start AI conversation');
      }

      if (response.data?.error) {
        console.error('AI chat function error:', response.data.error);
        throw new Error(response.data.error);
      }

      console.log('✅ AI conversation started with session context:', sessionContext);

    } catch (error) {
      console.error('Error starting AI conversation:', error);
      toast({
        title: "Error",
        description: "AI couldn't start the conversation. Please type a message to begin.",
        variant: "destructive",
      });
    }
  };

  // Handle sending user messages - FIXED VERSION with proper validation
  const handleSendMessage = async (messageText: string) => {
    // CRITICAL: Add comprehensive validation
    if (!messageText.trim()) {
      console.log('❌ Cannot send empty message');
      return;
    }

    if (!conversation) {
      console.log('❌ Cannot send message: No conversation object');
      toast({
        title: "Error",
        description: "No active conversation. Please try refreshing the page.",
        variant: "destructive",
      });
      return;
    }

    if (!conversation.id) {
      console.log('❌ Cannot send message: Conversation ID is missing', conversation);
      toast({
        title: "Error",
        description: "Invalid conversation state. Please start a new conversation.",
        variant: "destructive",
      });
      return;
    }

    if (isLoading || isPaused) {
      console.log('❌ Cannot send message: Loading or paused', { isLoading, isPaused });
      return;
    }

    console.log('📤 Sending message with conversation ID:', conversation.id);
    console.log('📝 Message content:', messageText.trim());

    setIsLoading(true);
    updateActivity(); // Update last activity

    // Check if this is the first message in the conversation
    const isFirstMessage = messages.length === 0;
    console.log('🔍 Is first message:', isFirstMessage, 'Current message count:', messages.length);
    
    // Add user message immediately for instant feedback
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText.trim(),
      created_at: new Date().toISOString(),
    };
    
    console.log('💬 Adding user message to session:', userMessage.id);
    addMessageToSession(userMessage);
    setTextInput(''); // Clear input immediately

    try {
      console.log('🚀 Calling ai-chat function with:', {
        conversationId: conversation.id,
        userId: user?.id,
        messageLength: messageText.trim().length,
        isFirstMessage
      });

      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: messageText.trim(),
          conversationId: conversation.id, // This should now always be valid
          userId: user?.id,
          isFirstMessage: isFirstMessage
        }
      });

      if (response.error) {
        console.error('❌ Supabase function error:', response.error);
        throw new Error(response.error.message || 'Failed to send message');
      }

      if (response.data?.error) {
        console.error('❌ AI chat function error:', response.data.error);
        throw new Error(response.data.error);
      }

      // The AI response will be added automatically via real-time subscription
      console.log('✅ Message sent successfully', response.data?.debug);

    } catch (error) {
      console.error('❌ Error sending message:', error);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize conversation on mount - check for active session first
  useEffect(() => {
    if (!user) return;
    
    const initializeConversation = async () => {
      setIsInitializing(true);
      
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const resumeId = urlParams.get('resume');
        
        if (continueConversation === 'true') {
          await handleContinuePausedConversation();
        } else if (resumeId) {
          // Handle new resume system
          await handleResumeById(resumeId);
        } else if (hasActiveSession && conversation) {
          // Continue existing active session - maintain session continuity
          console.log('📋 Continuing active chat session:', conversation.id);
          setIsInitializing(false);
          return;
        } else {
          // Create new conversation only when no active session exists
          console.log('🤖 Creating new chat conversation - AI will start automatically');
          await createNewConversation();
        }
      } catch (error) {
        console.error('Error initializing conversation:', error);
        toast({
          title: "Error", 
          description: "Could not initialize conversation",
          variant: "destructive",
        });
      } finally {
        setIsInitializing(false);
      }
    };

    initializeConversation();
  }, [user, continueConversation, hasActiveSession, conversation]);

  // Real-time message updates
  useEffect(() => {
    if (!conversation) return;

    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          console.log('📨 Received real-time message:', newMessage.role, newMessage.id);
          // Only add AI messages via real-time, user messages are added immediately
          if (newMessage.role === 'assistant') {
            addMessageToSession(newMessage);
          }
        }
      )
      .subscribe();

    console.log('🔔 Real-time subscription active for conversation:', conversation.id);

    return () => {
      supabase.removeChannel(channel);
      console.log('🔕 Real-time subscription cleaned up');
    };
  }, [conversation, addMessageToSession]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle resume by conversation ID (new system)
  const handleResumeById = async (conversationId: string) => {
    if (!user) return;

    try {
      // Get conversation with session data
      const { data: conversation, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      // Check if conversation is paused
      if (conversation.status !== 'paused') {
        toast({
          title: "Invalid conversation",
          description: "This conversation is not available for resume",
          variant: "destructive",
        });
        await createNewConversation();
        return;
      }

      // Get message history
      const { data: dbMessages } = await supabase  
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      // Convert database messages to Message format
      const messages: Message[] = (dbMessages || []).map((msg: any) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        created_at: msg.created_at,
        metadata: msg.metadata
      }));

      // Update conversation status to active
      await supabase
        .from('conversations')
        .update({ status: 'active' })
        .eq('id', conversationId);

      // Resume session with previous messages  
      resumeSession(conversation as Conversation, messages);

      // Generate contextual resume message from AI
      console.log('🤖 AI continuing conversation after resume with context');
      const sessionData = conversation.session_data as any;
      const resumeMessage = generateResumeMessage(
        { 
          lastTopic: sessionData?.lastTopic || conversation.title, 
          pausedAt: sessionData?.pausedAt,
          userConcerns: sessionData?.userConcerns 
        },
        user.email?.split('@')[0] || 'there'
      );
      
      // Add resume message to chat
      const aiResumeMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: resumeMessage,
        created_at: new Date().toISOString(),
        metadata: { isResumeMessage: true }
      };
      
      addMessageToSession(aiResumeMessage);

    } catch (error) {
      console.error('Error resuming conversation:', error);
      toast({
        title: "Error",
        description: "Could not resume conversation. Starting new one instead.",
        variant: "destructive",
      });
      await createNewConversation();
    }
  };

  // Handle continue paused conversation (legacy system - for backward compatibility)
  const handleContinuePausedConversation = async () => {
    if (!user) return;

    try {
      // Get paused conversation messages
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

      // Parse messages
      const previousMessages = typeof pausedConv.message_history === 'string' 
        ? JSON.parse(pausedConv.message_history)
        : pausedConv.message_history;

      // Create new active conversation for continuation
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

      // Resume session with previous messages
      resumeSession(newConversation as Conversation, previousMessages);

      // Generate contextual resume message from AI
      console.log('🤖 AI continuing conversation after resume with context');
      const resumeMessage = generateResumeMessage(
        { lastTopic: pausedConv.conversation_title, pausedAt: pausedConv.created_at },
        user.email?.split('@')[0] || 'there'
      );
      
      // Add resume message to chat
      const aiResumeMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: resumeMessage,
        created_at: new Date().toISOString(),
        metadata: { isResumeMessage: true }
      };
      
      addMessageToSession(aiResumeMessage);

      // Delete the paused conversation since we're continuing it
      await supabase
        .from('paused_conversations')
        .delete()
        .eq('id', pausedConv.id);

    } catch (error) {
      console.error('Error continuing paused conversation:', error);
      toast({
        title: "Error",
        description: "Could not continue paused conversation. Starting new one instead.",
        variant: "destructive",
      });
      await createNewConversation();
    }
  };

  // Handle pause session with audio control and unified state management
  const handlePauseSession = async () => {
    if (!conversation || !user) return;

    try {
      console.log('🔄 handlePauseSession: Starting pause with audio stop');
      
      // Stop all voice audio IMMEDIATELY
      const { stopAllVoiceAudio } = await import('@/hooks/useTextToSpeech');
      stopAllVoiceAudio();
      console.log('🔇 handlePauseSession: Voice audio stopped');
      
      // Use the session manager's pause function directly (already has audio control)
      const success = await pauseSession();
      if (success) {
        toast({
          title: "🔄 Conversation Paused",
          description: "Voice stopped and conversation paused successfully",
        });
        navigate('/dashboard');
      } else {
        toast({
          title: "Error",
          description: "Failed to pause conversation. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Pause error:', error);
      toast({
        title: "Error",
        description: "An error occurred while pausing the conversation",
        variant: "destructive",
      });
    }
  };

  // Handle resume session
  const handleResumeSession = () => {
    if (!conversation || !user) return;

    resumePausedSession();
  };

  // Handle end session (explicit finish conversation)
  const handleEndSession = async () => {
    if (!conversation) return;

    // Count user messages (not AI messages)
    const userMessageCount = messages.filter(msg => msg.role === 'user').length;
    
    // Require minimum 5 user messages before allowing completion
    if (userMessageCount < 5) {
      toast({
        title: "Minimum Messages Required",
        description: `You need to send at least 5 messages before ending the session. You've sent ${userMessageCount} message${userMessageCount === 1 ? '' : 's'}.`,
        variant: "destructive",
      });
      return;
    }

    console.log('🏁 handleEndSession: Attempting to complete chat session');
    
    try {
      // Calculate actual duration based on conversation start time
      const actualDuration = Math.ceil((Date.now() - new Date(conversation.started_at).getTime()) / (1000 * 60));
      
      // Check minimum duration requirement for insights (1 minute)
      const shouldGenerateInsights = actualDuration >= 1 && userMessageCount >= 5;

      const success = await completeSession();
      
      if (success && shouldGenerateInsights) {
        console.log('✅ Session meets criteria for insights generation');
        
        toast({
          title: "🎯 Session Complete!",
          description: `Session completed (${actualDuration} min). Generating insights...`,
        });

        try {
          // Generate insights via edge function
          const response = await supabase.functions.invoke('session-analysis', {
            body: {
              conversationId: conversation.id,
              userId: user?.id
            }
          });

          if (response.error) {
            console.error('❌ Session analysis failed:', response.error);
            throw new Error(response.error.message);
          }

          if (response.data) {
            console.log('✅ Session analysis completed successfully');
            navigate(`/session-summary?conversation_id=${conversation.id}`);
          } else {
            console.log('⚠️ Session analysis returned no data');
            navigate('/dashboard');
          }
        } catch (analysisError) {
          console.error('❌ Session analysis failed:', analysisError);
          toast({
            title: "Session Completed",
            description: "Session saved but analysis failed. Check dashboard for insights.",
            variant: "default",
          });
          navigate('/dashboard');
        }
      } else if (success) {
        console.log(`⚠️ Session too short for insights: ${actualDuration} min, ${userMessageCount} messages`);
        toast({
          title: "Session Complete",
          description: `Session completed but was too brief (${actualDuration} min) for detailed insights`,
        });
        navigate('/dashboard');
      } else {
        throw new Error('Failed to complete session');
      }
    } catch (error) {
      console.error('❌ handleEndSession: Error completing session:', error);
      
      // Even on completion failure, navigate to dashboard
      toast({
        title: "⚠️ Completion Issues", 
        description: "Session may not be fully processed, but navigating to dashboard.",
        variant: "default",
      });
      
      setTimeout(() => navigate('/dashboard'), 1000);
    }
  };

  // Handle new conversation (clears any session)
  const handleNewConversation = async () => {
    // Clear any existing paused session
    if (user) {
      await supabase
        .from('paused_conversations')
        .delete()
        .eq('user_id', user.id);
    }
    createNewConversation();
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
                <span className="text-sm text-green-600 font-medium">● Active Session</span>
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

              {messages.length === 0 && !isLoading && (
                <div className="text-center text-muted-foreground py-8">
                  <div className="max-w-md mx-auto space-y-4">
                    <h3 className="text-lg font-medium text-foreground">Therapeutic Chat Starting...</h3>
                    <p className="text-sm">
                      Your AI therapeutic assistant is starting the conversation. 
                      It will guide you through personalized questions to understand you better.
                    </p>
                    <p className="text-xs opacity-75">
                      All conversations are private and secure.
                    </p>
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
