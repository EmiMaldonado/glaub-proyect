import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useTherapeuticAnalysis } from '@/hooks/useTherapeuticAnalysis';
import SessionStatusPanel from '@/components/SessionStatusPanel';
import ConversationInterface from '@/components/ConversationInterface';
import ModernChatInterface from '@/components/ModernChatInterface';
import ConversationSummaryPanel from '@/components/ConversationSummaryPanel';
import ConfirmationModal from '@/components/ConfirmationModal';
import RealtimeChat from '@/components/RealtimeChat';
import { SessionEndConfirmation, NavigationWarning } from '@/components/SessionAlerts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [textInput, setTextInput] = useState('');
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('text');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [hasShownWarning, setHasShownWarning] = useState(false);
  const [autoTTS, setAutoTTS] = useState(true);
  const [intelligentAlertShown, setIntelligentAlertShown] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [chatMode, setChatMode] = useState<'traditional' | 'realtime'>('realtime');
  const [isRealtimeSpeaking, setIsRealtimeSpeaking] = useState(false);
  const [currentAIMessage, setCurrentAIMessage] = useState('');
  const [conversationSummary, setConversationSummary] = useState('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showSessionEndConfirmation, setShowSessionEndConfirmation] = useState(false);
  const [showNavigationWarning, setShowNavigationWarning] = useState(false);
  const [interactionProgress, setInteractionProgress] = useState(23);
  const [sessionQuality, setSessionQuality] = useState({
    audioQuality: 0.85,
    connectionStability: 0.92,
    responseTime: 120
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIntervalRef = useRef<NodeJS.Timeout>();
  const { speak, stop, isSpeaking, isLoading: ttsLoading } = useTextToSpeech();
  const { conversationContext, analyzeConversationFlow, generateIntelligentAlert } = useTherapeuticAnalysis();

  // Parse categorized summary from the conversation summary (must be before any conditional returns)
  const categorizedSummary: { insights: string[]; summary: string[]; strengths: string[]; followUp: string[] } = React.useMemo(() => {
    if (!conversationSummary) return { insights: [], summary: [], strengths: [], followUp: [] };
    
    const lines = conversationSummary.split('\n');
    let currentSection = '';
    const sections = {
      insights: [] as string[],
      summary: [] as string[],
      strengths: [] as string[],
      followUp: [] as string[]
    };
    
    lines.forEach(line => {
      if (line.includes('Insights:') || line.includes('insights')) {
        currentSection = 'insights';
      } else if (line.includes('Resumen') || line.includes('summary')) {
        currentSection = 'summary';
      } else if (line.includes('Puntos') || line.includes('strengths') || line.includes('Fortalezas')) {
        currentSection = 'strengths';
      } else if (line.includes('Recomendaciones') || line.includes('Seguimiento') || line.includes('follow')) {
        currentSection = 'followUp';
      } else if (line.trim() && currentSection && currentSection in sections) {
        (sections as any)[currentSection].push(line.trim());
      }
    });
    
    return sections;
  }, [conversationSummary]);

  // Toggle TTS functionality
  const handleToggleTTS = () => {
    setAutoTTS(!autoTTS);
    console.log('TTS toggled:', !autoTTS);
    toast({
      title: autoTTS ? "🔇 Síntesis de voz desactivada" : "🔊 Síntesis de voz activada",
      description: autoTTS ? "Los mensajes no se reproducirán automáticamente" : "Los mensajes se reproducirán automáticamente",
    });
  };

  // Handle input mode change
  const handleInputModeChange = (mode: 'voice' | 'text') => {
    setInputMode(mode);
    console.log('Input mode changed to:', mode);
    toast({
      title: "Modo de entrada actualizado",
      description: `Ahora puedes usar ${mode === 'voice' ? 'solo voz' : 'solo texto'}`,
    });
  };

  // Navigation warning handler
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSessionActive && messages.length > 0) {
        e.preventDefault();
        e.returnValue = '';
        setShowNavigationWarning(true);
        return '';
      }
    };

    const handlePopState = () => {
      if (isSessionActive && messages.length > 0) {
        setShowNavigationWarning(true);
        // Push the current state back to prevent navigation
        window.history.pushState(null, '', window.location.pathname);
      }
    };

    if (isSessionActive) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('popstate', handlePopState);
      
      // Push initial state to handle back button
      window.history.pushState(null, '', window.location.pathname);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isSessionActive, messages.length]);

  // Update interaction progress based on messages
  useEffect(() => {
    const messageCount = messages.length;
    const minRequired = 10; // Minimum messages for full interaction
    const progress = Math.min(100, Math.max(23, (messageCount / minRequired) * 100));
    setInteractionProgress(progress);
  }, [messages]);

  // Handle text input
  const handleTextInputChange = (text: string) => {
    setTextInput(text);
  };

  const handleSendTextMessage = () => {
    if (!textInput.trim()) return;
    handleSendMessage(textInput.trim());
    setTextInput('');
  };

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
            handleEndSessionRequest();
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

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend || !conversation || isLoading) return;

    // Console log for debugging
    console.log('Message sent:', textToSend);

    setIsLoading(true);
    setIsTyping(true);
    
    // Stop any current TTS playback
    stop();

    try {
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: textToSend,
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

  const handleEndSessionRequest = () => {
    setShowSessionEndConfirmation(true);
  };

  const handleConfirmEndSession = () => {
    setShowSessionEndConfirmation(false);
    handleEndSession();
  };

  const handleNavigationStay = () => {
    setShowNavigationWarning(false);
  };

  const handleNavigationLeave = () => {
    setShowNavigationWarning(false);
    setIsSessionActive(false);
    navigate('/dashboard');
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
    setCurrentTranscription(text);
    // Simulate processing delay then send message
    setTimeout(() => {
      handleSendMessage(text);
      setCurrentTranscription('');
    }, 500);
  };

  const handleSendSummary = () => {
    setShowConfirmationModal(true);
  };

  const handleConfirmSendSummary = (data: {
    recipient: 'user' | 'manager';
    categories: string[];
    additionalNotes?: string;
  }) => {
    console.log('Summary confirmation data:', data);
    
    toast({
      title: "📧 Resumen enviado",
      description: `Resumen enviado exitosamente a ${data.recipient === 'user' ? 'tu correo' : 'tu terapeuta'}`,
    });
    
    // Here you would implement the actual sending logic
    // For now, we just show the confirmation
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
    <div className="h-screen">
      <ModernChatInterface
        messages={messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.created_at
        }))}
        isRecording={isRecording}
        isLoading={isLoading}
        isAISpeaking={isSpeaking}
        inputMode={inputMode}
        textInput={textInput}
        interactionProgress={interactionProgress}
        userName={user?.email?.split('@')[0] || "Usuario"}
        onSendMessage={handleSendMessage}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onTextInputChange={handleTextInputChange}
        onModeSelect={handleInputModeChange}
        onEndSession={handleEndSessionRequest}
      />

      {/* Session Management Alerts */}
      <SessionEndConfirmation
        isOpen={showSessionEndConfirmation}
        onClose={() => setShowSessionEndConfirmation(false)}
        onConfirm={handleConfirmEndSession}
      />

      <NavigationWarning
        isOpen={showNavigationWarning}
        onStay={handleNavigationStay}
        onLeave={handleNavigationLeave}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
        onConfirm={handleConfirmSendSummary}
        categorizedSummary={categorizedSummary}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar conversación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente toda la conversación y sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConversation} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Conversation;