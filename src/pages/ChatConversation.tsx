import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pause, Play, Power } from 'lucide-react';
import { useSessionManager } from '@/hooks/useSessionManager';
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef<boolean>(false);
  
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isWaitingForAI, setIsWaitingForAI] = useState(false);
  
  const {
    conversation,
    messages,
    hasActiveSession,
    isPaused,
    startNewSession,
    resumeSession,
    addMessageToSession,
    pauseSession,
    completeSession,
    updateActivity
  } = useSessionManager();

  const { generateResumeMessage } = useConversationState();
  
  // Initialize conversation
  useEffect(() => {
    if (!user || hasInitialized.current) return;
    
    hasInitialized.current = true;
    setIsInitializing(false);
    
    if (continueConversation) {
      handleResumeById(continueConversation);
    } else {
      createNewConversation();
    }
  }, [user, continueConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createNewConversation = async () => {
    if (!user || isLoading) return;

    try {
      setIsLoading(true);
      
      const { count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const conversationNumber = (count || 0) + 1;
      
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
      
      startNewSession(newConversation as Conversation);

    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Could not create new conversation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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

    } catch (error) {
      console.error('Error resuming conversation:', error);
      await createNewConversation();
    }
  };

  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || !conversation?.id || !user?.id || isLoading || isPaused) return;

    setIsLoading(true);
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

      // Add AI response
      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.data?.message || 'I received your message.',
        created_at: new Date().toISOString(),
      };
      
      addMessageToSession(aiMessage);

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not send message",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePauseSession = async () => {
    if (!conversation?.id || !user?.id) return;

    try {
      await pauseSession();
      toast({
        title: "Session Paused",
        description: "Your conversation has been saved. You can resume it later.",
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Error pausing session:', error);
      toast({
        title: "Error",
        description: "Could not pause session",
        variant: "destructive",
      });
    }
  };

  const handleEndSession = async () => {
    if (!conversation?.id || !user?.id) return;

    try {
      await completeSession();
      toast({
        title: "Session Completed",
        description: "Your conversation has been saved.",
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Error ending session:', error);
      toast({
        title: "Error",
        description: "Could not end session",
        variant: "destructive",
      });
    }
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Header */}
      <div className="bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Button>
            <div>
              <h1 className="font-semibold text-foreground">
                {conversation?.title || 'Chat Conversation'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {hasActiveSession ? 'Active session' : 'Session inactive'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePauseSession}
              disabled={!hasActiveSession || isLoading}
            >
              <Pause className="w-4 h-4" />
              Pause
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEndSession}
              disabled={!hasActiveSession || isLoading}
            >
              <Power className="w-4 h-4" />
              End
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <h3 className="text-lg font-medium text-foreground">Ready to start your conversation</h3>
                <p className="text-sm mt-2 opacity-75">Type a message below to begin</p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[80%] px-3 py-2 sm:px-4 sm:py-3 rounded-lg ${
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
                <div className="bg-muted px-3 py-2 sm:px-4 sm:py-3 rounded-lg max-w-[80%]">
                  <div className="flex items-center space-x-2">
                    <LoadingSpinner />
                    <span className="text-sm">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-background border-t p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-2 sm:gap-3">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (textInput.trim()) {
                  handleSendMessage(textInput);
                }
              }
            }}
            placeholder="Type your message here..."
            className="flex-1 px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading || isPaused || !conversation?.id}
          />
          <Button
            onClick={() => handleSendMessage(textInput)}
            disabled={isLoading || !textInput.trim() || isPaused || !conversation?.id}
            className="px-4 py-2 sm:px-6 sm:py-3"
            size="default"
          >
            {isLoading ? (
              <LoadingSpinner />
            ) : (
              'Send'
            )}
          </Button>
        </div>
      </div>

      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatConversation;