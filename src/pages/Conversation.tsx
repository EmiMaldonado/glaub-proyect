import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Send, Clock, Pause, Play, Square, MessageCircle, Brain, Trash2, Volume2, VolumeX } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import VoiceInput from '@/components/VoiceInput';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

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

const Conversation: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [hasShownWarning, setHasShownWarning] = useState(false);
  const [autoTTS, setAutoTTS] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIntervalRef = useRef<NodeJS.Timeout>();
  const { speak, stop, isSpeaking, isLoading: ttsLoading } = useTextToSpeech();

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize or resume conversation
  useEffect(() => {
    if (!user) return;

    const initializeConversation = async () => {
      try {
        // Check for active conversation
        const { data: activeConversations } = await supabase
          .from('conversations')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1);

        if (activeConversations && activeConversations.length > 0) {
          // Resume existing conversation
          const conv = activeConversations[0] as Conversation;
          setConversation(conv);
          setSessionTime(conv.duration_minutes * 60);
          
          // Load messages
          const { data: convMessages } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true });
            
          if (convMessages) {
            setMessages(convMessages as Message[]);
          }
        } else {
          // Create new conversation
          const { data: newConversation, error } = await supabase
            .from('conversations')
            .insert({
              user_id: user.id,
              title: `Conversación ${new Date().toLocaleDateString()}`,
              status: 'active'
            })
            .select()
            .single();

          if (error) throw error;
          setConversation(newConversation as Conversation);
        }
      } catch (error) {
        console.error('Error initializing conversation:', error);
        toast({
          title: "Error",
          description: "No se pudo inicializar la conversación",
          variant: "destructive",
        });
      }
    };

    initializeConversation();
  }, [user]);

  // Session timer
  useEffect(() => {
    if (isSessionActive && conversation) {
      sessionIntervalRef.current = setInterval(() => {
        setSessionTime(prev => {
          const newTime = prev + 1;
          const minutes = Math.floor(newTime / 60);
          
          // Show warning at 14 minutes
          if (minutes >= 14 && !hasShownWarning) {
            setHasShownWarning(true);
            toast({
              title: "⏰ Tiempo casi agotado",
              description: "Te queda 1 minuto de conversación",
            });
          }
          
          // Auto-end at 15 minutes
          if (minutes >= 15) {
            handleEndSession();
            return prev;
          }
          
          return newTime;
        });
      }, 1000);
    } else {
      if (sessionIntervalRef.current) {
        clearInterval(sessionIntervalRef.current);
      }
    }

    return () => {
      if (sessionIntervalRef.current) {
        clearInterval(sessionIntervalRef.current);
      }
    };
  }, [isSessionActive, conversation, hasShownWarning]);

  // Real-time message updates
  useEffect(() => {
    if (!conversation) return;

    const channel = supabase
      .channel('messages-changes')
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
          if (newMessage.role === 'assistant') {
            setIsTyping(false);
            // Auto-speak AI responses if enabled
            if (autoTTS && newMessage.content) {
              speak(newMessage.content);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation, autoTTS, speak]);

  const handleStartSession = () => {
    setIsSessionActive(true);
    toast({
      title: "💬 Sesión iniciada",
      description: "Tienes 15 minutos para conversar",
    });
  };

  const handlePauseSession = async () => {
    setIsSessionActive(false);
    if (conversation) {
      await supabase
        .from('conversations')
        .update({ 
          status: 'paused',
          duration_minutes: Math.floor(sessionTime / 60)
        })
        .eq('id', conversation.id);
    }
    toast({
      title: "⏸️ Sesión pausada",
      description: "Puedes reanudar cuando quieras",
    });
  };

  const handleResumeSession = async () => {
    setIsSessionActive(true);
    if (conversation) {
      await supabase
        .from('conversations')
        .update({ status: 'active' })
        .eq('id', conversation.id);
    }
    toast({
      title: "▶️ Sesión reanudada",
      description: "Continuando conversación...",
    });
  };

  const handleEndSession = async () => {
    setIsSessionActive(false);
    if (conversation) {
      await supabase
        .from('conversations')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_minutes: Math.floor(sessionTime / 60)
        })
        .eq('id', conversation.id);
    }
    toast({
      title: "✅ Sesión completada",
      description: "Gracias por conversar. Revisa tus insights en el dashboard.",
    });
    navigate('/dashboard');
  };

  const handleSendMessage = async (e?: React.FormEvent, textToSend?: string) => {
    e?.preventDefault();
    const messageToSend = textToSend || currentMessage.trim();
    if (!messageToSend || !conversation || isLoading) return;

    setCurrentMessage('');
    setIsLoading(true);
    setIsTyping(true);
    
    // Stop any current TTS playback
    stop();

    try {
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: messageToSend,
          conversationId: conversation.id,
          userId: user?.id
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Message will be added via real-time subscription
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceTranscription = (text: string) => {
    handleSendMessage(undefined, text);
  };

  const handleClearConversation = async () => {
    if (!conversation || isLoading) return;

    try {
      setIsLoading(true);
      
      // Stop any current TTS playback
      stop();

      // Call the database function to clear messages
      const { error } = await supabase.rpc('clear_conversation_messages', {
        conversation_uuid: conversation.id
      });

      if (error) throw error;

      // Clear local state
      setMessages([]);
      setConversation(prev => prev ? { ...prev, insights: null, ocean_signals: null } : null);

      toast({
        title: "🗑️ Conversación limpiada",
        description: "Se han eliminado todos los mensajes",
      });
    } catch (error) {
      console.error('Error clearing conversation:', error);
      toast({
        title: "Error",
        description: "No se pudo limpiar la conversación",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeRemaining = () => {
    const maxSeconds = (conversation?.max_duration_minutes || 15) * 60;
    return Math.max(0, maxSeconds - sessionTime);
  };

  if (!conversation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/10">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Session Header */}
        <Card className="mb-6 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold">{conversation.title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={conversation.status === 'active' ? 'default' : 'secondary'}>
                  {conversation.status}
                </Badge>
                <Button
                  onClick={() => setAutoTTS(!autoTTS)}
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                >
                  {autoTTS ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
                <Button
                  onClick={handleClearConversation}
                  variant="outline"
                  size="sm"
                  disabled={isLoading || messages.length === 0}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="font-mono text-lg">
                  {formatTime(getTimeRemaining())}
                </span>
              </div>
              
              {!isSessionActive && conversation.status === 'active' && (
                <Button onClick={handleStartSession} size="sm">
                  <Play className="h-4 w-4 mr-1" />
                  Iniciar
                </Button>
              )}
              
              {isSessionActive && (
                <Button onClick={handlePauseSession} variant="outline" size="sm">
                  <Pause className="h-4 w-4 mr-1" />
                  Pausar
                </Button>
              )}
              
              {!isSessionActive && conversation.status === 'paused' && (
                <Button onClick={handleResumeSession} size="sm">
                  <Play className="h-4 w-4 mr-1" />
                  Reanudar
                </Button>
              )}
              
              <Button onClick={handleEndSession} variant="outline" size="sm">
                <Square className="h-4 w-4 mr-1" />
                Terminar
              </Button>
            </div>
          </div>
        </Card>

        {/* Chat Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Messages */}
          <Card className="lg:col-span-3 h-[600px] flex flex-col">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">¡Hola! Soy tu psicólogo virtual</p>
                    <p>Estoy aquí para escucharte y entenderte. ¿Cómo te sientes hoy?</p>
                  </div>
                )}
                
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3 max-w-[80%]">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div ref={messagesEndRef} />
            </ScrollArea>
            
            {/* Message Input */}
            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder={isSessionActive ? "Escribe tu mensaje o usa el micrófono..." : "Inicia la sesión para comenzar"}
                  disabled={!isSessionActive || isLoading}
                  className="flex-1"
                />
                <VoiceInput
                  onTranscription={handleVoiceTranscription}
                  disabled={!isSessionActive || isLoading}
                />
                <Button 
                  type="submit" 
                  disabled={!isSessionActive || !currentMessage.trim() || isLoading}
                  size="icon"
                >
                  {isLoading ? (
                    <LoadingSpinner />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
              {(isSpeaking || ttsLoading) && (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Volume2 className="h-4 w-4 animate-pulse" />
                  <span>{ttsLoading ? 'Preparando audio...' : 'Reproduciendo respuesta...'}</span>
                  <Button
                    onClick={stop}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                  >
                    Detener
                  </Button>
                </div>
              )}
            </div>
          </Card>
          
          {/* Insights Panel */}
          <Card className="p-4 h-[600px]">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Insights</h3>
            </div>
            
            {conversation.ocean_signals && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Personalidad OCEAN</h4>
                  <div className="space-y-2 text-sm">
                    {Object.entries(conversation.ocean_signals).map(([trait, score]) => (
                      <div key={trait} className="flex justify-between">
                        <span className="capitalize">{trait}</span>
                        <span className="text-muted-foreground">
                          {Math.round((score as number) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {messages.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Progreso de la Sesión</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Mensajes: {messages.length}</p>
                  <p>Tiempo transcurrido: {formatTime(sessionTime)}</p>
                  <p>Estado emocional: Explorando...</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Conversation;