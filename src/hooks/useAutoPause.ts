import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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

interface EnhancedSessionData {
  messages: Message[];
  lastTopic?: string;
  userConcerns?: string[];
  conversationFlow: {
    phase: 'exploration' | 'analysis' | 'action_planning';
    progress: number;
    nextSteps: string[];
  };
  userPreferences?: {
    communicationStyle?: string;
    preferredApproach?: string;
  };
  insights?: {
    keyFindings: string[];
    patterns: string[];
    recommendations: string[];
  };
  pausedAt: string;
  pauseReason: 'manual' | 'auto' | 'network' | 'visibility';
  [key: string]: any; // Add index signature for Supabase Json compatibility
}

interface UseAutoPauseOptions {
  conversation: Conversation | null;
  messages: Message[];
  userId: string | undefined;
  onPause: () => void;
  onNavigateToSummary?: () => void;
}

export const useAutoPause = ({
  conversation,
  messages,
  userId,
  onPause,
  onNavigateToSummary
}: UseAutoPauseOptions) => {
  const pauseTriggeredRef = useRef(false);
  const lastSaveRef = useRef<string>('');

  // Enhanced pause function with rich context preservation
  const pauseConversationWithContext = useCallback(async (
    pauseReason: 'manual' | 'auto' | 'network' | 'visibility' = 'manual'
  ) => {
    if (!conversation || !userId || messages.length === 0 || pauseTriggeredRef.current) {
      return false;
    }

    pauseTriggeredRef.current = true;

    try {
      // Extract context from messages for intelligent resume
      const lastUserMessages = messages
        .filter(m => m.role === 'user')
        .slice(-3)
        .map(m => m.content);
      
      const lastTopic = extractTopicFromMessages(messages);
      const userConcerns = extractUserConcerns(messages);

      // Create enhanced session data
      const enhancedSessionData: EnhancedSessionData = {
        messages,
        lastTopic,
        userConcerns,
        conversationFlow: {
          phase: determineConversationPhase(messages),
          progress: calculateProgress(messages),
          nextSteps: extractNextSteps(messages)
        },
        insights: {
          keyFindings: [],
          patterns: [],
          recommendations: []
        },
        pausedAt: new Date().toISOString(),
        pauseReason
      };

      // Update conversation status to paused and save session data
      const { error: convError } = await supabase
        .from('conversations')
        .update({
          status: 'paused',
          session_data: enhancedSessionData
        })
        .eq('id', conversation.id);

      if (convError) throw convError;

      // Also save to paused_conversations for backward compatibility
      const { error: pausedError } = await supabase
        .from('paused_conversations')
        .upsert({
          user_id: userId,
          message_history: JSON.stringify(messages),
          conversation_title: conversation.title,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (pausedError) throw pausedError;

      // Show appropriate toast based on pause reason
      const toastMessages = {
        manual: "Conversation paused successfully",
        auto: "Conversation auto-paused due to inactivity",
        network: "Conversation paused due to network issues",
        visibility: "Conversation paused - tab switched"
      };

      toast({
        title: "Conversation Paused",
        description: toastMessages[pauseReason],
      });

      onPause();
      return true;
    } catch (error) {
      console.error('Error pausing conversation:', error);
      toast({
        title: "Error",
        description: "Failed to pause conversation",
        variant: "destructive",
      });
      return false;
    } finally {
      // Reset the flag after a delay to allow for potential retries
      setTimeout(() => {
        pauseTriggeredRef.current = false;
      }, 2000);
    }
  }, [conversation, userId, messages, onPause]);

  // Auto-pause event handlers
  useEffect(() => {
    if (!conversation || conversation.status !== 'active') return;

    // Visibility change (tab switching, minimizing)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseConversationWithContext('visibility');
      }
    };

    // Network connectivity loss
    const handleOffline = () => {
      pauseConversationWithContext('network');
    };

    // Page unload/refresh
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (messages.length > 0) {
        // Synchronous pause attempt
        pauseConversationWithContext('auto');
        
        const message = 'You have an active conversation. Are you sure you want to leave?';
        event.returnValue = message;
        return message;
      }
    };

    // Mobile-specific: page hide (when app goes to background)
    const handlePageHide = () => {
      pauseConversationWithContext('auto');
    };

    // Set up event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [conversation, messages.length, pauseConversationWithContext]);

  return {
    pauseConversationWithContext
  };
};

// Helper functions for context extraction
function extractTopicFromMessages(messages: Message[]): string {
  const recentMessages = messages.slice(-5);
  const userMessages = recentMessages.filter(m => m.role === 'user');
  
  if (userMessages.length === 0) return 'General conversation';
  
  // Simple topic extraction based on common keywords
  const lastUserMessage = userMessages[userMessages.length - 1].content.toLowerCase();
  
  if (lastUserMessage.includes('work') || lastUserMessage.includes('job')) return 'Work-related topics';
  if (lastUserMessage.includes('relationship') || lastUserMessage.includes('family')) return 'Relationships';
  if (lastUserMessage.includes('stress') || lastUserMessage.includes('anxiety')) return 'Mental health';
  if (lastUserMessage.includes('goal') || lastUserMessage.includes('future')) return 'Goals and planning';
  
  return 'Personal development';
}

function extractUserConcerns(messages: Message[]): string[] {
  const concerns: string[] = [];
  const userMessages = messages.filter(m => m.role === 'user');
  
  userMessages.forEach(msg => {
    const content = msg.content.toLowerCase();
    if (content.includes('worried') || content.includes('concern')) concerns.push('anxiety');
    if (content.includes('difficult') || content.includes('hard')) concerns.push('challenges');
    if (content.includes('relationship') || content.includes('conflict')) concerns.push('relationships');
    if (content.includes('work') || content.includes('career')) concerns.push('professional');
  });
  
  return [...new Set(concerns)];
}

function determineConversationPhase(messages: Message[]): 'exploration' | 'analysis' | 'action_planning' {
  if (messages.length < 5) return 'exploration';
  if (messages.length < 15) return 'analysis';
  return 'action_planning';
}

function calculateProgress(messages: Message[]): number {
  return Math.min(100, (messages.length / 20) * 100);
}

function extractNextSteps(messages: Message[]): string[] {
  const aiMessages = messages.filter(m => m.role === 'assistant');
  const nextSteps: string[] = [];
  
  aiMessages.forEach(msg => {
    if (msg.content.toLowerCase().includes('next step') || 
        msg.content.toLowerCase().includes('recommend') ||
        msg.content.toLowerCase().includes('try')) {
      nextSteps.push('Continue exploring current topic');
    }
  });
  
  return nextSteps.length > 0 ? nextSteps : ['Resume conversation'];
}