import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pause, Play } from 'lucide-react';
import { useSessionManager } from '@/hooks/useSessionManager';

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
    endSession,
    updateActivity,
    loadSessionFromLocal
  } = useSessionManager();
  
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create new conversation and get AI first message
  const createNewConversation = async () => {
    if (!user) return;

    try {
      // Count existing conversations to get the next number
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
          title: `Conversation ${conversationNumber}`,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;
      
      // Start new session
      startNewSession(newConversation as Conversation);

      // Get user's profile for personalization
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, display_name')
        .eq('user_id', user.id)
        .single();

      // Get AI first message with context
      await sendAIFirstMessage(newConversation.id, profile?.display_name || profile?.full_name || 'User');

    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Could not create new conversation",
        variant: "destructive",
      });
    }
  };

  // Send AI first message with context and check if truly first session
  const sendAIFirstMessage = async (conversationId: string, userName: string) => {
    try {
      setIsLoading(true);
      
      // Check if user has any previous completed conversations to determine if this is their first session ever
      const { data: previousCompletedConversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', user?.id)
        .eq('status', 'completed')
        .limit(1);

      let isFirstSessionEver = !previousCompletedConversations || previousCompletedConversations.length === 0;
      
      // Send a proper conversation starter instead of system prompts
      let conversationStarter;
      
      if (isFirstSessionEver) {
        // First session ever - send a simple greeting that will trigger the personality discovery
        conversationStarter = "Hello";
      } else {
        // Returning user - send a simple greeting that will trigger recall of previous sessions
        conversationStarter = "Hi, I'm back for another session";
      }
      
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: conversationStarter,
          conversationId: conversationId,
          userId: user?.id,
          isFirstMessage: isFirstSessionEver
        }
      });

      if (response.error) {
        console.error('AI chat error:', response.error);
        throw new Error(response.error.message || 'Failed to get AI response');
      }

      if (response.data?.error) {
        console.error('AI chat function error:', response.data.error);
        throw new Error(response.data.error);
      }
    } catch (error) {
      console.error('Error sending AI first message:', error);
      toast({
        title: "Error",
        description: "Could not initialize conversation with AI. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sending user messages
  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || !conversation || isLoading || isPaused) return;

    setIsLoading(true);
    updateActivity(); // Update last activity

    // Add user message immediately for instant feedback
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText.trim(),
      created_at: new Date().toISOString(),
    };
    
    addMessageToSession(userMessage);
    setTextInput(''); // Clear input immediately

    try {
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: messageText.trim(),
          conversationId: conversation.id,
          userId: user?.id
        }
      });

      if (response.error) {
        console.error('Supabase function error:', response.error);
        throw new Error(response.error.message || 'Failed to send message');
      }

      if (response.data?.error) {
        console.error('AI chat function error:', response.data.error);
        throw new Error(response.data.error);
      }

      // The AI response will be added automatically via real-time subscription
      console.log('✅ Message sent successfully', response.data?.debug);

    } catch (error) {
      console.error('Error sending message:', error);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize conversation on mount
  useEffect(() => {
    if (!user) return;
    
    const initializeConversation = async () => {
      setIsInitializing(true);
      
      try {
        if (continueConversation === 'true') {
          await handleContinuePausedConversation();
        } else {
          // Check for existing session first
          const existingSession = loadSessionFromLocal();
          if (existingSession && existingSession.conversation) {
            console.log('📂 Restored existing session');
            updateActivity();
          } else {
            await createNewConversation();
          }
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
  }, [user, continueConversation]);

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
          addMessageToSession(newMessage);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation, addMessageToSession]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle continue paused conversation
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

      // Delete the paused conversation since we're continuing it
      await supabase
        .from('paused_conversations')
        .delete()
        .eq('id', pausedConv.id);

      // Generate AI welcome back message
      await sendAIWelcomeBackMessage(newConversation.id, previousMessages);

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

  // Send AI welcome back message with conversation summary
  const sendAIWelcomeBackMessage = async (conversationId: string, previousMessages: Message[]) => {
    try {
      setIsLoading(true);

      // Send a simple message to continue the conversation
      const welcomeMessage = "I'm continuing our previous conversation";

      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: welcomeMessage,
          conversationId: conversationId,
          userId: user?.id,
          isFirstMessage: false
        }
      });

      if (response.error) {
        console.error('Supabase function error:', response.error);
        throw new Error(response.error.message || 'Failed to continue conversation');
      }

      if (response.data?.error) {
        console.error('AI chat function error:', response.data.error);
        throw new Error(response.data.error);
      }
    } catch (error) {
      console.error('Error sending welcome back message:', error);
      toast({
        title: "Error",
        description: "Could not continue conversation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle pause session
  const handlePauseSession = async () => {
    if (!conversation || !user) return;

    await pauseSession();
  };

  // Handle resume session
  const handleResumeSession = () => {
    if (!conversation || !user) return;

    resumePausedSession();
  };

  // Handle end session
  const handleEndSession = async () => {
    if (!conversation) return;

    const success = await endSession();
    if (success) {
      navigate(`/session-summary?conversation_id=${conversation.id}`);
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
        <div className="flex items-center justify-between max-w-4xl mx-auto">
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
              <span className="text-sm text-green-600 font-medium">● Active Session</span>
            )}
            {isPaused && (
              <span className="text-sm text-amber-600 font-medium">⏸ Paused Session</span>
            )}
          </div>
        </div>
      </header>

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-hidden p-4">
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {/* Paused State Banner */}
              {isPaused && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center space-x-2 text-amber-700">
                    <Pause className="h-5 w-5" />
                    <span className="font-medium">Session Paused</span>
                  </div>
                  <p className="text-sm text-amber-600 mt-1">
                    Click Resume to continue your conversation
                  </p>
                </div>
              )}

              {messages.length === 0 && !isLoading && (
                <div className="text-center text-muted-foreground py-8">
                  <p>Your conversation will appear here...</p>
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
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted px-4 py-3 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <LoadingSpinner />
                      <span className="text-sm text-muted-foreground">Writing...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t bg-background p-4 space-y-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !isLoading && !isPaused) {
                      handleSendMessage(textInput);
                    }
                  }}
                  placeholder={isPaused ? "Session is paused..." : "Write your message..."}
                  className="flex-1 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isLoading || isPaused}
                />
                <Button
                  onClick={() => handleSendMessage(textInput)}
                  disabled={!textInput.trim() || isLoading || isPaused}
                >
                  Send
                </Button>
              </div>
              
              {/* Session Controls */}
              <div className="flex items-center justify-center space-x-2">
                {!isPaused ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePauseSession}
                    disabled={!conversation || messages.length === 0}
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResumeSession}
                    disabled={!conversation}
                    className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewConversation}
                >
                  New Chat
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleEndSession}
                  disabled={!conversation || messages.length === 0}
                >
                  End Session
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatConversation;