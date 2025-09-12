import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import NewVoiceInterface from '@/components/NewVoiceInterface';
import VoiceErrorBoundary from '@/components/VoiceErrorBoundary';
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
  const [currentAIResponse, setCurrentAIResponse] = useState<string>('');
  
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
        title: "⏰ Time Almost Up",
        description: "You have 1 minute of conversation remaining",
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
    setCurrentAIResponse('');
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
          title: `Voice Session ${new Date().toLocaleDateString()}`,
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
      await sendAIFirstMessage(newConversation.id, profile?.display_name || profile?.full_name || 'User');

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
          message: `Start a new voice therapy session with ${userName}. Greet them warmly and professionally, ask how they're feeling today and what they'd like to explore in this session. Keep a conversational tone appropriate for voice communication.`,
          conversationId: conversationId,
          userId: user?.id,
          isFirstMessage: true,
          modalityType: 'voice'
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Set the AI's first message for display
      if (response.data?.message) {
        setCurrentAIResponse(response.data.message);
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

  // Handle transcription updates from NewVoiceInterface
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

        // Update current AI response if it's from AI
        if (!isUser) {
          setCurrentAIResponse(text.trim());
        }
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

  // Handle end session
  async function handleEndSession() {
    if (!conversation) return;

    try {
      pauseTimer();
      
      // Calculate actual duration based on timer
      const actualDuration = Math.ceil((Date.now() - new Date(conversation.started_at).getTime()) / (1000 * 60));
      
      await supabase
        .from('conversations')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_minutes: actualDuration
        })
        .eq('id', conversation.id);

      toast({
        title: "✅ Session Completed",
        description: "The voice session has been saved",
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
  }

  // Handle back navigation
  const handleBack = () => {
    navigate('/dashboard');
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

          // Update current AI response if it's from AI
          if (newMessage.role === 'assistant') {
            setCurrentAIResponse(newMessage.content);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation]);

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8f9fa]">
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-gray-600">Starting new voice session...</p>
        </div>
      </div>
    );
  }

  return (
    <VoiceErrorBoundary onRetry={createNewConversation}>
      <NewVoiceInterface
        onTranscriptionUpdate={handleTranscriptionUpdate}
        conversationId={conversation?.id}
        userId={user?.id}
        onEndSession={handleEndSession}
        onBack={handleBack}
        progressPercentage={progressPercentage}
        formattedTime={formattedTime}
        formattedTimeRemaining={formattedTimeRemaining}
        currentAIResponse={currentAIResponse}
      />
    </VoiceErrorBoundary>
  );
};

export default VoiceConversation;