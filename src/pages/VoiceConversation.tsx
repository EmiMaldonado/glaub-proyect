import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useSessionManager } from '@/hooks/useSessionManager';
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
  const [searchParams] = useSearchParams();
  const resumeConversationId = searchParams.get('resume');
  const { speak, isSpeaking: isTTSSpeaking } = useTextToSpeech();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sessionTranscripts, setSessionTranscripts] = useState<Message[]>([]);
  const [currentAIResponse, setCurrentAIResponse] = useState<string>('');
  
  // Session manager
  const { pauseSession } = useSessionManager();

  // Handle stop session (user-initiated) with immediate audio control
  const handleStopSession = async () => {
    try {
      console.log('🔄 handleStopSession: Starting pause with audio stop');
      
      // Stop all voice audio IMMEDIATELY
      const { stopAllVoiceAudio } = await import('@/hooks/useTextToSpeech');
      stopAllVoiceAudio();
      console.log('🔇 handleStopSession: Voice audio stopped');
      
      // Then pause the session
      const success = await pauseSession();
      if (success) {
        toast({
          title: "🔄 Session Paused",
          description: "Voice stopped and conversation paused. You can continue later from the dashboard",
        });
        navigate('/dashboard');
      } else {
        throw new Error('Failed to pause session');
      }
    } catch (error) {
      console.error('❌ Error pausing session:', error);
      toast({
        title: "Error",
        description: "Could not pause the session properly",
        variant: "destructive",
      });
    }
  };

  // Session timer
  const {
    sessionTime,
    formattedTime,
    formattedTimeRemaining,
    progressPercentage,
    isActive: isTimerActive,
    extensionsUsed,
    currentMaxDuration,
    start: startTimer,
    pause: pauseTimer,
    reset: resetTimer,
    extendSession,
    stopSession
  } = useConversationTimer({
    maxDurationMinutes: 5,
    onTimeWarning: () => {
      toast({
        title: "⏰ Time Almost Up",
        description: "You have 1 minute of conversation remaining",
      });
    },
    onTimeUp: handleStopSession // Use pause instead of complete for timer expiry
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

  // Resume existing paused conversation
  const resumeExistingConversation = async (conversationId: string) => {
    if (!user) return;

    try {
      setIsInitializing(true);
      resetConversationState();

      // Load the paused conversation
      const { data: existingConversation, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .eq('status', 'paused')
        .single();

      if (error) throw error;
      
      if (!existingConversation) {
        toast({
          title: "Conversation Not Found",
          description: "The paused conversation could not be found.",
          variant: "destructive",
        });
        navigate('/dashboard');
        return;
      }

      // Update conversation status to active
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ status: 'active' })
        .eq('id', conversationId);

      if (updateError) throw updateError;

      setConversation(existingConversation as Conversation);

      // Load existing messages
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      let formattedMessages: Message[] = [];
      if (existingMessages) {
        formattedMessages = existingMessages.map(msg => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          created_at: msg.created_at,
          metadata: msg.metadata
        }));
        setSessionTranscripts(formattedMessages);
      }

      // Resume AI conversation without providing a summary - let AI handle naturally
      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: "Continue the conversation naturally - this is a resumed session.",
          conversationId: conversationId,
          userId: user.id,
          isFirstMessage: false,
          modalityType: 'voice'
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.message) {
        setCurrentAIResponse(response.data.message);
        speak(response.data.message);
      }

      toast({
        title: "✅ Session Resumed",
        description: "Your conversation has been resumed successfully",
      });

    } catch (error) {
      console.error('Error resuming conversation:', error);
      toast({
        title: "Error",
        description: "Could not resume conversation. Starting a new one instead.",
        variant: "destructive",
      });
      createNewConversation();
    } finally {
      setIsInitializing(false);
    }
  };

  // Create new conversation and get AI first message
  const createNewConversation = async () => {
    if (!user) return;

    try {
      setIsInitializing(true);
      resetConversationState();

      // Clear any existing paused conversation first (only one paused conversation allowed)
      await supabase
        .from('paused_conversations')
        .delete()
        .eq('user_id', user.id);

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

  // Send AI first message with context and check if truly first session
  const sendAIFirstMessage = async (conversationId: string, userName: string) => {
    try {
      // Check if user has any previous completed conversations to determine if this is their first session ever
      const { data: previousCompletedConversations } = await supabase
        .from('conversations')
        .select('id, insights, ocean_signals, ended_at')
        .eq('user_id', user?.id)
        .eq('status', 'completed')
        .order('ended_at', { ascending: false })
        .limit(3);

      let isFirstSessionEver = !previousCompletedConversations || previousCompletedConversations.length === 0;
      
      let initialMessage;
      
      if (isFirstSessionEver) {
        // First session ever - use the standard Glai introduction
        initialMessage = "Start the first conversation with this user using the standard Glai introduction and personality discovery protocol.";
      } else {
        // Returning user - recall previous conversations and ask about new topics
        initialMessage = "This is a returning user. Greet them warmly, recall what you discussed in previous sessions, and ask if there are other topics they'd like to explore today.";
      }

      const response = await supabase.functions.invoke('ai-chat', {
        body: {
          message: initialMessage,
          conversationId: conversationId,
          userId: user?.id,
          isFirstMessage: isFirstSessionEver,
          modalityType: 'voice'
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Set the AI's first message for display and speak it
      if (response.data?.message) {
        setCurrentAIResponse(response.data.message);
        // Play the AI's first message as voice
        speak(response.data.message);
      }

    } catch (error) {
      console.error('Error sending AI first message:', error);
      toast({
        title: "Error",
        description: "Could not initialize conversation with AI",
        variant: "destructive",
      });
    }
  };

  // Handle transcription updates from NewVoiceInterface
  const handleTranscriptionUpdate = async (text: string, isUser: boolean) => {
    if (!conversation || !text.trim()) return;

    // Start timer when user first speaks (sends their first message)
    if (isUser && !isTimerActive) {
      startTimer();
      console.log('🕒 Timer started on first user message');
    }

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

        // Update current AI response if it's from AI - don't speak here to avoid duplication
        if (!isUser) {
          setCurrentAIResponse(text.trim());
        }
      }
    } catch (error) {
      console.error('Error handling transcription:', error);
    }
  };

  // Handle speaking state changes (keeping for potential future use)
  const handleSpeakingChange = (speaking: boolean) => {
    setIsSpeaking(speaking);
  };

  // Handle extend session
  const handleExtendSession = () => {
    extendSession();
  };

  // Handle end session (explicit finish - timer expiry or user finish button)
  const handleEndSession = async () => {
    if (!conversation) return;

    try {
      console.log('🏁 handleEndSession: Starting completion with audio stop');
      
      // Stop all voice audio IMMEDIATELY
      const { stopAllVoiceAudio } = await import('@/hooks/useTextToSpeech');
      stopAllVoiceAudio();
      console.log('🔇 handleEndSession: Voice audio stopped');
      
      pauseTimer();
      
      // Calculate actual duration based on timer
      const actualDuration = Math.ceil((Date.now() - new Date(conversation.started_at).getTime()) / (1000 * 60));
      
      // Check minimum duration requirement for insights (1 minute)
      const shouldGenerateInsights = actualDuration >= 1 && sessionTranscripts.length > 2;

      await supabase
        .from('conversations')
        .update({ 
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_minutes: actualDuration
        })
        .eq('id', conversation.id);

      if (shouldGenerateInsights) {
        console.log('✅ Session meets criteria for insights generation');
        
        const sessionData = {
          messages: sessionTranscripts,
          duration: actualDuration,
          userId: user?.id,
          conversationId: conversation.id
        };

        toast({
          title: "🎯 Session Complete!",
          description: `Session completed (${actualDuration} min). Generating insights...`,
        });

        // Generate insights via edge function
        const response = await supabase.functions.invoke('session-analysis', {
          body: sessionData
        });

        if (response.data) {
          navigate(`/session-summary?id=${conversation.id}`);
        } else {
          console.log('⚠️ Insights generation failed, going to dashboard');
          navigate('/dashboard');
        }
      } else {
        console.log(`⚠️ Session too short for insights: ${actualDuration} min, ${sessionTranscripts.length} messages`);
        toast({
          title: "Session Complete",
          description: `Session was too brief (${actualDuration} min) for detailed insights`,
        });
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('❌ Error ending session:', error);
      toast({
        title: "Session Ended",
        description: "Session completed but there was an issue processing it",
        variant: "destructive",
      });
      navigate('/dashboard');
    }
  };

  // Handle back navigation
  const handleBack = () => {
    navigate('/dashboard');
  };

  // Initialize conversation on component mount
  useEffect(() => {
    if (!user) return;
    
    if (resumeConversationId) {
      resumeExistingConversation(resumeConversationId);
    } else {
      createNewConversation();
    }
  }, [user, resumeConversationId]);

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

          // Update current AI response if it's from AI - don't speak here to avoid duplication
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
          <div className="animate-pulse">
            <div className="w-16 h-16 bg-[#6889b4] rounded-full mx-auto mb-4 animate-bounce"></div>
          </div>
          <div className="space-y-2">
            <p className="text-gray-600 font-medium">Starting new voice session...</p>
            <p className="text-sm text-gray-500">Setting up AI assistant and preparing conversation</p>
          </div>
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
        onExtendSession={handleExtendSession}
        onStopSession={handleStopSession}
        onBack={handleBack}
        progressPercentage={isTimerActive ? progressPercentage : 0}
        formattedTime={isTimerActive ? formattedTime : "00:00"}
        formattedTimeRemaining={isTimerActive ? formattedTimeRemaining : "05:00"}
        extensionsUsed={extensionsUsed}
        currentAIResponse={currentAIResponse}
        canFinishSession={isTimerActive && (sessionTime >= 60)}
      />
    </VoiceErrorBoundary>
  );
};

export default VoiceConversation;
