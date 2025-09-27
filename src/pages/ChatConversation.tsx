import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pause, Play, Power, Bot } from 'lucide-react';
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
  const {
    user
  } = useAuth();
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
  const {
    generateResumeMessage
  } = useConversationState();

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
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [messages]);
  const createNewConversation = async () => {
    if (!user || isLoading) return;
    try {
      setIsLoading(true);
      const {
        count
      } = await supabase.from('conversations').select('*', {
        count: 'exact',
        head: true
      }).eq('user_id', user.id);
      const conversationNumber = (count || 0) + 1;
      const {
        data: newConversation,
        error
      } = await supabase.from('conversations').insert({
        user_id: user.id,
        title: `Chat Conversation ${conversationNumber}`,
        status: 'active'
      }).select().single();
      if (error || !newConversation?.id) {
        throw new Error('Failed to create conversation');
      }
      startNewSession(newConversation as Conversation);
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Could not create new conversation",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const handleResumeById = async (conversationId: string) => {
    if (!user) return;
    try {
      const {
        data: conversation,
        error
      } = await supabase.from('conversations').select('*').eq('id', conversationId).eq('user_id', user.id).single();
      if (error) throw error;
      const {
        data: dbMessages
      } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', {
        ascending: true
      });
      const messages: Message[] = (dbMessages || []).map((msg: any) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        created_at: msg.created_at,
        metadata: msg.metadata
      }));
      await supabase.from('conversations').update({
        status: 'active'
      }).eq('id', conversationId);
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
      created_at: new Date().toISOString()
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
        created_at: new Date().toISOString()
      };
      addMessageToSession(aiMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not send message",
        variant: "destructive"
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
        description: "Your conversation has been saved. You can resume it later."
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Error pausing session:', error);
      toast({
        title: "Error",
        description: "Could not pause session",
        variant: "destructive"
      });
    }
  };
  const handleEndSession = async () => {
    if (!conversation?.id || !user?.id) return;
    try {
      await completeSession();
      toast({
        title: "Session Completed",
        description: "Your conversation has been saved."
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Error ending session:', error);
      toast({
        title: "Error",
        description: "Could not end session",
        variant: "destructive"
      });
    }
  };
  if (isInitializing) {
    return <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>;
  }
  return <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="py-2 relative px-[24px] mx-[24px]">
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="text-muted-foreground hover:text-foreground p-0 absolute left-0">
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
            <h1 className="text-lg font-medium text-foreground text-center w-full">
              Chat conversation
            </h1>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden relative">
        <div className="h-full overflow-y-auto">
          <div className="p-6 space-y-4 min-h-full flex flex-col justify-center bg-muted/50">
            {messages.length === 0 && <div className="text-center text-muted-foreground">
                <div className="mb-4 flex justify-center">
                  <Bot className="w-12 h-12 text-primary" />
                </div>
                <h3 className="text-2xl font-medium text-foreground mb-2">Hi {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there'},</h3>
                <p className="text-sm opacity-75 mx-[30px]">I'm Glai, and I'm ready to chat. How can I help you today?</p>
              </div>}

            {messages.map(message => <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground shadow-sm'}`}>
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>)}

            {isLoading && <div className="flex justify-start">
                <div className="bg-card px-4 py-3 rounded-2xl shadow-sm max-w-[80%]">
                  <div className="flex items-center space-x-2">
                    <LoadingSpinner />
                    <span className="text-sm">AI is thinking...</span>
                  </div>
                </div>
              </div>}
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-background">
        <div className="py-2 px-6">
          {/* Input Field */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 relative">
              <input type="text" value={textInput} onChange={e => setTextInput(e.target.value)} onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (textInput.trim()) {
                  handleSendMessage(textInput);
                }
              }
            }} placeholder="Type your message here ..." className="w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary bg-background" disabled={isLoading || isPaused || !conversation?.id} />
            </div>
            <Button onClick={() => handleSendMessage(textInput)} disabled={isLoading || !textInput.trim() || isPaused || !conversation?.id} className="h-12 w-12 rounded-xl bg-accent hover:bg-accent/90" size="icon">
              {isLoading ? <LoadingSpinner /> : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>}
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-row gap-3">
            <Button variant="outline" onClick={handleEndSession} disabled={!hasActiveSession || isLoading} className="flex-1 h-8 p-2 sm:p-4 rounded-xl border hover:bg-muted/50">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Power className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-xs sm:text-sm">End session</div>
                  <div className="text-xs text-muted-foreground hidden sm:block">Finish the chat and go to analysis</div>
                </div>
              </div>
            </Button>
            
            <Button variant="outline" onClick={handlePauseSession} disabled={!hasActiveSession || isLoading} className="flex-1 h-8 p-2 sm:p-4 rounded-xl border hover:bg-muted/50">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                  <Pause className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-xs sm:text-sm">Pause</div>
                  <div className="text-xs text-muted-foreground hidden sm:block">Save your conversation and return later</div>
                </div>
              </div>
            </Button>
          </div>
        </div>
      </div>

      <div ref={messagesEndRef} />
    </div>;
};
export default ChatConversation;