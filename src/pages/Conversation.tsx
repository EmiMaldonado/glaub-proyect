import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Send, Clock, Pause, Play, Square, MessageCircle, Brain, Trash2, Volume2, VolumeX, AlertTriangle } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import VoiceInput from '@/components/VoiceInput';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useTherapeuticAnalysis } from '@/hooks/useTherapeuticAnalysis';
import TherapeuticInsights from '@/components/TherapeuticInsights';

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
  const [intelligentAlertShown, setIntelligentAlertShown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIntervalRef = useRef<NodeJS.Timeout>();
  const { speak, stop, isSpeaking, isLoading: ttsLoading } = useTextToSpeech();
  const { conversationContext, analyzeConversationFlow, generateIntelligentAlert } = useTherapeuticAnalysis();

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

  // Enhanced session timer with intelligent alerts
  useEffect(() => {
    if (isSessionActive && conversation) {
      sessionIntervalRef.current = setInterval(() => {
        setSessionTime(prev => {
          const newTime = prev + 1;
          const minutes = Math.floor(newTime / 60);
          
          // Analyze conversation flow continuously
          analyzeConversationFlow(messages, minutes);
          
          // Generate intelligent alerts
          const alert = generateIntelligentAlert(minutes);
          if (alert && !intelligentAlertShown && minutes >= 14) {
            setIntelligentAlertShown(true);
            
            toast({
              title: alert.type === 'warning' ? "⏰ Tiempo casi agotado" : 
                     alert.type === 'question' ? "🤔 Momento de reflexión" : 
                     "💭 Cierre de sesión",
              description: alert.message,
              duration: alert.type === 'reflection' ? 8000 : 5000,
            });
          }
          
          // Standard 14-minute warning fallback
          if (minutes >= 14 && !hasShownWarning && !alert) {
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
  }, [isSessionActive, conversation, hasShownWarning, messages, intelligentAlertShown, analyzeConversationFlow, generateIntelligentAlert]);

  // Real-time message updates with therapeutic analysis
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
          setMessages(prev => {
            const updated = [...prev, newMessage];
            // Update therapeutic analysis with new message
            const minutes = Math.floor(sessionTime / 60);
            analyzeConversationFlow(updated, minutes);
            return updated;
          });
          
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
  }, [conversation, autoTTS, speak, sessionTime, analyzeConversationFlow]);

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

    // Console log for debugging
    console.log('Message sent:', messageToSend);

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

      // Show success toast
      toast({
        title: "✅ Mensaje enviado",
        description: "El mensaje ha sido procesado correctamente",
      });

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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex h-screen">
          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col bg-background/80 backdrop-blur-sm">
          {/* Header */}
          <div className="border-b bg-card/50 backdrop-blur-sm px-8 py-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <MessageCircle className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold">{conversation.title}</h1>
                  <div className="flex items-center gap-4 text-base text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      <span className="font-medium">{formatTime(getTimeRemaining())} restantes</span>
                    </div>
                    <Badge variant={conversation.status === 'active' ? 'default' : 'secondary'} className="h-7 px-3 text-sm font-medium">
                      {conversation.status}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {/* Session Controls */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setAutoTTS(!autoTTS)}
                  variant="ghost"
                  size="default"
                  className="h-11 px-4"
                >
                  {autoTTS ? <Volume2 className="h-5 w-5 mr-2" /> : <VolumeX className="h-5 w-5 mr-2" />}
                  <span className="hidden sm:inline">Audio</span>
                </Button>
                <Button
                  onClick={handleClearConversation}
                  variant="ghost"
                  size="default"
                  disabled={isLoading || messages.length === 0}
                  className="h-11 px-4"
                >
                  <Trash2 className="h-5 w-5 mr-2" />
                  <span className="hidden sm:inline">Limpiar</span>
                </Button>
                
                {!isSessionActive && conversation.status === 'active' && (
                  <Button onClick={handleStartSession} size="default" className="h-11 px-6">
                    <Play className="h-5 w-5 mr-2" />
                    Iniciar
                  </Button>
                )}
                
                {isSessionActive && (
                  <Button onClick={handlePauseSession} variant="outline" size="default" className="h-11 px-6">
                    <Pause className="h-5 w-5 mr-2" />
                    Pausar
                  </Button>
                )}
                
                {!isSessionActive && conversation.status === 'paused' && (
                  <Button onClick={handleResumeSession} size="default" className="h-11 px-6">
                    <Play className="h-5 w-5 mr-2" />
                    Reanudar
                  </Button>
                )}
                
                <Button onClick={handleEndSession} variant="outline" size="default" className="h-11 px-6">
                  <Square className="h-5 w-5 mr-2" />
                  Terminar
                </Button>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4">
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.length === 0 && (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">¡Hola! Soy tu psicólogo virtual</h3>
                  <p className="text-muted-foreground">Estoy aquí para escucharte y entenderte. ¿Cómo te sientes hoy?</p>
                </div>
              )}
              
              {messages.map((message) => (
                <div key={message.id} className="flex gap-3">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {message.role === 'user' ? 'Tú' : 'AI'}
                  </div>
                  
                  {/* Message Content */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {message.role === 'user' ? 'Tú' : 'Psicólogo Virtual'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className={`rounded-lg p-3 max-w-3xl ${
                      message.role === 'user'
                        ? 'bg-primary/10 border border-primary/20'
                        : 'bg-muted/50'
                    }`}>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium shrink-0">
                    AI
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Psicólogo Virtual</span>
                      <span className="text-xs text-muted-foreground">escribiendo...</span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 max-w-3xl">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Input Section */}
          <div className="border-t bg-card/50 backdrop-blur-sm p-4">
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <div className="flex-1 relative">
                  <Textarea
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    placeholder="Escribe tu mensaje aquí..."
                    className="min-h-[60px] max-h-[120px] resize-none pr-12"
                    disabled={isLoading || !isSessionActive}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  {isLoading && (
                    <div className="absolute right-3 top-3">
                      <LoadingSpinner />
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={isLoading || !currentMessage.trim() || !isSessionActive}
                  className="h-[60px] px-6"
                >
                  {isLoading ? (
                    <LoadingSpinner />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar
                    </>
                  )}
                </Button>
              </form>
              
              {!isSessionActive && (
                <div className="mt-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    Inicia la sesión para comenzar a conversar
                  </p>
                </div>
              )}
            </div>
          </div>
          
        </div>
        
        {/* Insights Sidebar */}
        <div className="w-80 border-l bg-card/30 backdrop-blur-sm">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Insights de Sesión</h3>
            </div>
          </div>
          
          <ScrollArea className="h-[calc(100vh-5rem)]">
            <div className="p-4 space-y-6">
              {conversation.ocean_signals && (
                <div>
                  <h4 className="text-sm font-medium mb-3">Personalidad OCEAN</h4>
                  <div className="space-y-3">
                    {Object.entries(conversation.ocean_signals).map(([trait, score]) => (
                      <div key={trait} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize font-medium">{trait}</span>
                          <span className="text-muted-foreground">
                            {Math.round((score as number) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.round((score as number) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {messages.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3">Progreso de la Sesión</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mensajes</span>
                      <span className="font-medium">{messages.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tiempo transcurrido</span>
                      <span className="font-medium">{formatTime(sessionTime)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estado</span>
                      <span className="font-medium">En progreso</span>
                    </div>
                  </div>
                </div>
              )}
              
              {messages.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Los insights aparecerán conforme conversemos</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default Conversation;