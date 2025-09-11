import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import VoiceRecorder from '@/components/VoiceRecorder';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mic, MicOff } from 'lucide-react';
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
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentTranscription, setCurrentTranscription] = useState('');
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
    setIsRecording(false);
    setIsLoading(false);
    setCurrentTranscription('');
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

  // Handle voice transcription complete
  const handleTranscriptionComplete = async (transcription: string) => {
    if (!transcription.trim() || !conversation || isLoading) return;

    setCurrentTranscription('');
    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: transcription.trim(),
          conversationId: conversation.id,
          userId: user?.id,
          modalityType: 'voice'
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "✅ Mensaje de voz procesado",
        description: "Tu mensaje ha sido transcrito y enviado",
      });

    } catch (error) {
      console.error('Error sending voice message:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar el mensaje de voz",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle recording state
  const handleStartRecording = () => {
    setIsRecording(true);
    if (!isTimerActive) {
      startTimer();
    }
    toast({
      title: "🎙️ Grabación iniciada",
      description: "Habla claramente hacia el micrófono",
    });
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    toast({
      title: "⏸️ Grabación pausada",
      description: "Procesando tu mensaje de voz...",
    });
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
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
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
                  </div>
                </div>
              ))}
              
              {currentTranscription && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] px-4 py-3 rounded-lg bg-primary/50 text-primary-foreground">
                    <p className="text-sm leading-relaxed">{currentTranscription}</p>
                    <span className="text-xs opacity-70">Transcribiendo...</span>
                  </div>
                </div>
              )}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted px-4 py-3 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <LoadingSpinner />
                      <span className="text-sm text-muted-foreground">Procesando...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Voice Recorder */}
            <div className="border-t bg-background p-6">
              <div className="text-center space-y-4">
                <VoiceRecorder
                  onRecordingStart={handleStartRecording}
                  onRecordingStop={handleStopRecording}
                  onRecordingComplete={(audioBlob) => {
                    console.log('Audio recording completed:', audioBlob);
                  }}
                  onTranscriptionComplete={handleTranscriptionComplete}
                />
                
                <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    {isRecording ? (
                      <MicOff className="h-4 w-4 text-red-500" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                    <span>
                      {isRecording ? 'Grabando...' : 'Presiona para hablar'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceConversation;