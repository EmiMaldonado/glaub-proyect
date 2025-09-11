import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import RealtimeChatInterface from '@/components/RealtimeChat';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useConversationTimer } from '@/hooks/useConversationTimer';

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

const VoiceConversation: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sessionTranscripts, setSessionTranscripts] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Session timer
  const {
    formattedTime,
    formattedTimeRemaining,
    progressPercentage,
    isActive: isTimerActive,
    start: startTimer,
    pause: pauseTimer,
    reset: resetTimer
  } = useConversationTimer({
    maxDurationMinutes: 15,
    onTimeWarning: () => {
      toast({
        title: "⏰ Tiempo casi agotado",
        description: "Te queda 1 minuto de conversación",
      });
    },
    onTimeUp: handleEndSession
  });

  // Reset all state for new conversation
  const resetConversationState = () => {
    setMessages([]);
    setSessionTranscripts([]);
    setIsSpeaking(false);
    setIsLoading(false);
    setConversation(null);
    resetTimer();
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
          title: `Sesión de Voz ${new Date().toLocaleDateString()}`,
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
        description: "No se pudo crear la nueva conversación",
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
          message: `Inicia una nueva sesión de terapia por voz con ${userName}. Saluda de manera cálida y profesional, pregunta cómo se siente hoy y qué le gustaría explorar en esta sesión. Mantén un tono conversacional apropiado para comunicación por voz.`,
          conversationId: conversationId,
          userId: user?.id,
          isFirstMessage: true,
          modalityType: 'voice'
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }
    } catch (error) {
      console.error('Error sending AI first message:', error);
      toast({
        title: "Error",
        description: "No se pudo inicializar la conversación con IA",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle transcription updates from RealtimeChat
  const handleTranscriptionUpdate = async (text: string, isUser: boolean) => {
    if (!conversation || !text.trim()) return;

    try {
      // Save transcription as message to database
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          role: isUser ? 'user' : 'assistant',
          content: text.trim(),
          metadata: { source: 'realtime_voice', timestamp: new Date().toISOString() }
        });

      if (error) {
        console.error('Error saving transcription:', error);
      } else {
        console.log('Transcription saved:', { isUser, text: text.substring(0, 50) + '...' });
        
        // Add to session transcripts for immediate display
        const newMessage: Message = {
          id: `temp-${Date.now()}`,
          role: isUser ? 'user' : 'assistant',
          content: text.trim(),
          created_at: new Date().toISOString()
        };
        
        setSessionTranscripts(prev => [...prev, newMessage]);
      }
    } catch (error) {
      console.error('Error handling transcription:', error);
    }
  };

  // Handle speaking state changes
  const handleSpeakingChange = (speaking: boolean) => {
    setIsSpeaking(speaking);
    if (speaking && !isTimerActive) {
      startTimer();
    }
  };

  // Initialize conversation on component mount
  useEffect(() => {
    if (!user) return;
    createNewConversation();
  }, [user]);

  // Real-time message updates (for any other messages not from realtime)
  useEffect(() => {
    if (!conversation) return;

    const channel = supabase
      .channel('voice-messages')
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
          // Only add if it's not already in session transcripts (avoid duplicates)
          setSessionTranscripts(prev => {
            const exists = prev.some(msg => 
              msg.content === newMessage.content && 
              Math.abs(new Date(msg.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 1000
            );
            return exists ? prev : [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation]);

  // Scroll to bottom when transcripts update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionTranscripts]);

  // Handle end session
  async function handleEndSession() {
    if (!conversation) return;

    try {
      pauseTimer();
      
      await supabase
        .from('conversations')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_minutes: Math.floor(progressPercentage / 100 * 15)
        })
        .eq('id', conversation.id);

      toast({
        title: "✅ Sesión completada",
        description: "La sesión de voz ha sido guardada",
      });

      navigate('/dashboard');
    } catch (error) {
      console.error('Error ending session:', error);
      toast({
        title: "Error",
        description: "No se pudo finalizar la sesión",
        variant: "destructive",
      });
    }
  }

  // Handle new conversation
  const handleNewConversation = () => {
    createNewConversation();
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-muted-foreground">Iniciando nueva sesión de voz...</p>
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
            <h1 className="text-lg font-medium">Sesión de Voz</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-muted-foreground">
              {formattedTime} / {formattedTimeRemaining} restante
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewConversation}
              disabled={isLoading}
            >
              Nueva Sesión
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEndSession}
              disabled={!conversation}
            >
              Finalizar
            </Button>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-background border-b px-4 py-2">
        <div className="max-w-4xl mx-auto">
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-hidden p-4">
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            {/* Transcripts */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {sessionTranscripts.map((message) => (
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
                    <span className="text-xs opacity-70">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
              
              {isSpeaking && (
                <div className="flex justify-start">
                  <div className="bg-blue-100 px-4 py-3 rounded-lg border-2 border-blue-200">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-sm text-blue-700">IA hablando...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Realtime Voice Interface */}
            <div className="border-t bg-background p-6">
              <RealtimeChatInterface
                onTranscriptionUpdate={handleTranscriptionUpdate}
                onSpeakingChange={handleSpeakingChange}
                conversationId={conversation?.id}
                userId={user?.id}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceConversation;