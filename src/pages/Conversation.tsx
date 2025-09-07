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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { Send, Clock, Pause, Play, Square, MessageCircle, Brain, Trash2, Volume2, VolumeX, AlertTriangle, Mic, MicOff, StopCircle } from 'lucide-react';
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
  const [isRecording, setIsRecording] = useState(false);
  const [currentAIMessage, setCurrentAIMessage] = useState('');
  const [conversationSummary, setConversationSummary] = useState('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
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
            setCurrentAIMessage(newMessage.content);
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

  const handleStartRecording = () => {
    setIsRecording(true);
    setIsSessionActive(true);
    console.log('Recording started');
    toast({
      title: "🎙️ Grabación iniciada",
      description: "La sesión de terapia ha comenzado",
    });
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    console.log('Recording stopped');
    toast({
      title: "⏸️ Grabación pausada", 
      description: "Puedes reanudar la grabación cuando quieras",
    });
  };

  const handleEndSession = async () => {
    setIsRecording(false);
    setIsSessionActive(false);
    
    // Generate conversation summary
    const summary = generateConversationSummary();
    setConversationSummary(summary);
    
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
    
    console.log('Session ended');
    toast({
      title: "✅ Sesión completada",
      description: "Revisa el resumen y los insights generados",
    });
  };

  const handleDeleteConversation = async () => {
    if (!conversation) return;
    
    try {
      await supabase.rpc('clear_conversation_messages', {
        conversation_uuid: conversation.id
      });
      
      setMessages([]);
      setConversationSummary('');
      setShowDeleteConfirmation(false);
      
      toast({
        title: "🗑️ Conversación eliminada",
        description: "Se ha eliminado toda la información de la conversación",
      });
      
      console.log('Conversation deleted');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la conversación",
        variant: "destructive",
      });
    }
  };

  const generateConversationSummary = () => {
    if (messages.length === 0) return '';
    
    const userMessages = messages.filter(m => m.role === 'user').length;
    const aiMessages = messages.filter(m => m.role === 'assistant').length;
    
    return `## Resumen de la Sesión

**Duración:** ${formatTime(sessionTime)}
**Intercambios:** ${Math.min(userMessages, aiMessages)} mensajes

### Puntos Importantes:
- Se exploraron temas relacionados con el bienestar emocional
- La conversación fluyó de manera natural y constructiva
- Se identificaron patrones de pensamiento y comportamiento

### Insights:
- Mayor autoconciencia desarrollada durante la sesión  
- Identificación de fortalezas personales
- Áreas de crecimiento potencial reconocidas

### Recomendaciones:
- Continuar con la práctica de autorreflexión
- Implementar técnicas de mindfulness diarias
- Mantener un registro de pensamientos y emociones
- Considerar sesiones de seguimiento regulares`;
  };

  const handleVoiceTranscription = (text: string) => {
    handleSendMessage(undefined, text);
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
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          
          {/* Header */}
          <div className="border-b bg-card/50 backdrop-blur-sm px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{conversation.title}</h1>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{formatTime(sessionTime)}</span>
                    </div>
                    <Badge variant={isSessionActive ? 'default' : 'secondary'}>
                      {isSessionActive ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Central Recording Area */}
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-8 max-w-2xl">
              
              {/* Recording Controls */}
              <div className="space-y-6">
                <div className="relative">
                  {!isRecording && !isSessionActive && (
                    <Button
                      onClick={handleStartRecording}
                      size="lg"
                      className="h-24 w-24 rounded-full text-lg font-semibold"
                    >
                      <Mic className="h-8 w-8" />
                    </Button>
                  )}
                  
                  {isRecording && (
                    <div className="relative">
                      <Button
                        onClick={handleStopRecording}
                        variant="outline"
                        size="lg" 
                        className="h-24 w-24 rounded-full border-red-500 text-red-500 hover:bg-red-50 animate-pulse"
                      >
                        <MicOff className="h-8 w-8" />
                      </Button>
                      <div className="absolute -inset-4 border-2 border-red-500 rounded-full animate-ping opacity-20"></div>
                    </div>
                  )}
                  
                  {!isRecording && isSessionActive && (
                    <Button
                      onClick={handleStartRecording}
                      variant="outline"
                      size="lg"
                      className="h-24 w-24 rounded-full"
                    >
                      <Mic className="h-8 w-8" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {!isSessionActive && (
                    <p className="text-lg font-medium">Presiona para iniciar la sesión</p>
                  )}
                  {isRecording && (
                    <p className="text-lg font-medium text-red-600">🔴 Grabando...</p>
                  )}
                  {!isRecording && isSessionActive && (
                    <p className="text-lg font-medium">Presiona para continuar</p>
                  )}
                </div>
              </div>

              {/* AI Current Message */}
              {currentAIMessage && (
                <Card className="p-6 bg-muted/50">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Brain className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-2">Psicólogo Virtual</p>
                      <p className="text-sm leading-relaxed">{currentAIMessage}</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Session Controls */}
              {isSessionActive && (
                <div className="flex items-center justify-center gap-4">
                  <Button 
                    onClick={handleEndSession}
                    variant="outline"
                    className="h-12 px-6"
                  >
                    <StopCircle className="h-4 w-4 mr-2" />
                    Terminar Sesión
                  </Button>
                  
                  <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="h-12 px-6">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar Conversación
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar conversación?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Se eliminará permanentemente toda la conversación y sus datos asociados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConversation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <LoadingSpinner />
                  <span>Procesando mensaje...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Summary and Insights */}
        <div className="w-96 border-l bg-card/30 backdrop-blur-sm">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Resumen e Insights</h3>
            </div>
          </div>
          
          <ScrollArea className="h-[calc(100vh-5rem)]">
            <div className="p-4 space-y-6">
              
              {/* Conversation Summary */}
              {conversationSummary ? (
                <div className="space-y-3">
                  <div className="prose prose-sm max-w-none">
                    <div className="text-xs text-muted-foreground whitespace-pre-line">
                      {conversationSummary}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">El resumen aparecerá al finalizar la sesión</p>
                </div>
              )}

              {/* OCEAN Personality Insights */}
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
              
              {/* Session Progress */}
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
                      <span className="font-medium">
                        {isRecording ? 'Grabando' : isSessionActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                  </div>
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