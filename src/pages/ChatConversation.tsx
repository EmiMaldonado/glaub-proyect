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
  
  // Enhanced auto-pause system
  const { pauseConversationWithContext } = useAutoPause({
    conversation,
    messages,
    userId: user?.id,
    onPause: () => {
      navigate('/dashboard');
    },
    updateSessionState,
    onConversationPaused: (conversationId) => {
      if (user?.id) {
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

  // Setup real-time subscription
  const setupRealtimeSubscription = async (conversationId: string) => {
    if (!conversationId || conversationId === 'undefined') return;

    // Clean up existing subscription
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('🔔 Setting up real-time subscription for:', conversationId);

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
        console.log('🔔 Subscription status:', status);
      });

    channelRef.current = channel;
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  // SIMPLIFIED: Create conversation and let AI start automatically
  const createNewConversation = async () => {
    if (!user || isLoading) return;

    try {
      setIsLoading(true);
      setIsWaitingForAI(true);
      
      console.log('🚀 Creating new conversation for user:', user.id);
      
      // Clean up
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      // Clear paused conversations
      await supabase
        .from('paused_conversations')
        .delete()
        .eq('user_id', user.id);
      
      // Count conversations
      const { count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const conversationNumber = (count || 0) + 1;
      
      // Create conversation
      const { data: newConversation, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: `Chat Conversation ${conversationNumber}`,
          status: 'active'
        })
        .select()
        .single();

      if (error || !newConversation?.id) {
        throw new Error('Failed to create conversation');
      }
      
      console.log('✅ Conversation created:', newConversation.id);
      
      // Start session
      startNewSession(newConversation as Conversation);
      
      // Setup subscription
      await setupRealtimeSubscription(newConversation.id);
      
      // SIMPLIFIED: Just send a simple start message, let the AI handle context
      console.log('🤖 Starting AI conversation...');
      
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: "Start the conversation. Check if this is the user's first session and respond appropriately.",
          conversationId: newConversation.id,
          userId: user.id,
          isFirstMessage: true,
          aiInitiated: true
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'AI function failed');
      }

      console.log('✅ AI conversation started');
      
      // Simple fallback check
      setTimeout(async () => {
        if (isWaitingForAI) {
          await checkForNewMessages(newConversation.id);
        }
      }, 5000);

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

  // Check for new messages fallback
  const checkForNewMessages = async (conversationId: string) => {
    try {
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
            addMessageToSession(msg);
            newMessagesAdded++;
          }
        });

        if (newMessagesAdded > 0) {
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

  // Handle sending user messages
  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || !conversation?.id || !user?.id || isLoading || isPaused) return;

    setIsLoading(true);
    setIsWaitingForAI(true);
    updateActivity();

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText.trim(),
      created_at: new Date().toISOString(),
    };
    
    addMessageToSession(userMessage);
    setTextInput('');

    try {
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: messageText.trim(),
          conversationId: conversation.id,
          userId: user.id,
          isFirstMessage: messages.length === 0
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Check for response
      setTimeout(async () => {
        if (isWaitingForAI) {
          await checkForNewMessages(conversation.id);
          setTimeout(() => {
            if (isWaitingForAI) {
              setIsWaitingForAI(false);
              toast({
                title: "AI Response Delayed",
                description: "Please try again if no response appears.",
                variant: "default",
              });
            }
          }, 10000);
        }
      }, 4000);

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

  // SIMPLIFIED: Initialize conversation
  useEffect(() => {
    if (!user?.id) return;
    
    let isMounted = true;
    
    const initializeConversation = async () => {
      setIsInitializing(true);
      
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const resumeId = urlParams.get('resume');
        
        console.log('🔍 Initializing conversation:', {
          userId: user.id,
          continueConversation,
          resumeId
        });
        
        if (continueConversation === 'true') {
          await handleContinuePausedConversation();
        } else if (resumeId) {
          await handleResumeById(resumeId);
        } else {
          await createNewConversation();
        }
      } catch (error) {
        console.error('❌ Initialization error:', error);
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    // Small delay to avoid conflicts
    setTimeout(initializeConversation, 500);
    
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Setup subscription when conversation changes
  useEffect(() => {
    if (!conversation?.id) return;
    setupRealtimeSubscription(conversation.id);

    return () => {
      if (channelRef.current) {
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

  // Handle pause session
  const handlePauseSession = async () => {
    if (!conversation || !user) return;

    try {
      const { stopAllVoiceAudio } = await import('@/hooks/useTextToSpeech');
      stopAllVoiceAudio();
      
      const success = await pauseSession();
      if (success) {
        toast({
          title: "Conversation Paused",
          description: "Conversation paused successfully",
        });
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('❌ Pause error:', error);
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
          title: "Session Complete!",
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
      }
    } catch (error) {
      console.error('❌ Error completing session:', error);
      toast({
        title: "Completion Issues", 
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
      {/* FIXED: Header with mobile layout */}
      <header className="bg-background border-b px-4 py-3 sticky top-0 z-10">
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
          
          {/* Desktop: All buttons in one line */}
          <div className="hidden sm:flex items-center space-x-2">
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
        
        {/* FIXED: Mobile - Session status and buttons on separate line */}
        <div className="sm:hidden mt-2 flex flex-col space-y-2">
          {/* Session status */}
          <div className="flex justify-center">
            {hasActiveSession && !isPaused && (
              <span className="text-sm text-green-600 font-medium">● Active Session</span>
            )}
            {isPaused && (
              <span className="text-sm text-amber-600 font-medium">⏸ Paused Session</span>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="flex justify-center space-x-3">
            {hasActiveSession && !isPaused && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePauseSession}
                className="text-sm"
              >
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
            )}
            {isPaused && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResumeSession}
                className="text-sm"
              >
                <Play className="h-4 w-4 mr-1" />
                Resume
              </Button>
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
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 pb-20 sm:pb-4">
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

            {/* FIXED: Input Area with mobile layout */}
            <div className="border-t bg-background p-4 sticky bottom-0 z-10">
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
