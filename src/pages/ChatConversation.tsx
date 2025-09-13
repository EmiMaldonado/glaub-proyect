import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

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
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reset all state for new conversation
  const resetConversationState = () => {
    setMessages([]);
    setTextInput('');
    setIsLoading(false);
    setConversation(null);
  };

  // Create new conversation and get AI first message
  const createNewConversation = async () => {
    if (!user) return;

    try {
      setIsInitializing(true);
      resetConversationState();

      // Create new conversation
      const { data: newConversation, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: `Chat ${new Date().toLocaleDateString()}`,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;
      setConversation(newConversation as Conversation);

      // Get user's profile for personalization
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, display_name')
        .eq('user_id', user.id)
        .single();

      // Get AI first message with context
      await sendAIFirstMessage(newConversation.id, profile?.display_name || profile?.full_name || 'Usuario');

    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Could not create new conversation",
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  };

  // Send AI first message with context
  const sendAIFirstMessage = async (conversationId: string, userName: string) => {
    try {
      setIsLoading(true);
      
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: `Start a new therapeutic conversation session with ${userName}. Greet them warmly and professionally, ask how they're feeling today and what they'd like to explore in this session.`,
          conversationId: conversationId,
          userId: user?.id,
          isFirstMessage: true
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }
    } catch (error) {
      console.error('Error sending AI first message:', error);
      toast({
        title: "Error",
        description: "Could not initialize conversation with AI",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sending user messages
  const handleSendMessage = async (messageText: string) => {
    if (!messageText.trim() || !conversation || isLoading) return;

    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: messageText.trim(),
          conversationId: conversation.id,
          userId: user?.id
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Could not send message",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize conversation on component mount
  useEffect(() => {
    if (!user) return;
    createNewConversation();
  }, [user]);

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
          setMessages(prev => [...prev, newMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle end session
  const handleEndSession = async () => {
    if (!conversation) return;

    try {
      await supabase
        .from('conversations')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString()
        })
        .eq('id', conversation.id);

      toast({
        title: "✅ Session Completed",
        description: "The conversation has been saved",
      });

      navigate(`/session-summary?conversation_id=${conversation.id}`);
    } catch (error) {
      console.error('Error ending session:', error);
      toast({
        title: "Error",
        description: "Could not end the session",
        variant: "destructive",
      });
    }
  };

  // Handle new conversation
  const handleNewConversation = () => {
    createNewConversation();
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-muted-foreground">Starting new conversation...</p>
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
            {/* Session controls moved below input */}
          </div>
        </div>
      </header>

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-hidden p-4">
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.slice(1).map((message) => (
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
                    if (e.key === 'Enter' && !isLoading) {
                      handleSendMessage(textInput);
                      setTextInput('');
                    }
                  }}
                  placeholder="Write your message..."
                  className="flex-1 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isLoading}
                />
                <Button
                  onClick={() => {
                    handleSendMessage(textInput);
                    setTextInput('');
                  }}
                  disabled={!textInput.trim() || isLoading}
                >
                  Send
                </Button>
              </div>
              
              {/* Session Controls */}
              <div className="flex items-center justify-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewConversation}
                  disabled={isLoading}
                >
                  Pause Session & Continue Later
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEndSession}
                  disabled={!conversation}
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