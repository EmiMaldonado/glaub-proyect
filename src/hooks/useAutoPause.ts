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
  updateSessionState?: (updater: (prev: any) => any) => void;
  onConversationPaused?: (conversationId: string) => void;
  pauseSessionFunction?: () => Promise<boolean>; // NEW: Direct connection to useSessionManager.pauseSession
}

export const useAutoPause = ({
  conversation,
  messages,
  userId,
  onPause,
  onNavigateToSummary,
  updateSessionState,
  onConversationPaused,
  pauseSessionFunction
}: UseAutoPauseOptions) => {
  const pauseTriggeredRef = useRef(false);
  const lastSaveRef = useRef<string>('');
  const isUnmountingRef = useRef(false);

  // Enhanced pause function with audio control and session manager integration
  const pauseConversationWithContext = useCallback(async (
    pauseReason: 'manual' | 'auto' | 'network' | 'visibility' = 'manual'
  ) => {
    if (!conversation || !userId || pauseTriggeredRef.current || isUnmountingRef.current) {
      console.log('🚫 pauseConversationWithContext blocked:', { 
        conversation: !!conversation, 
        userId: !!userId, 
        pauseTriggered: pauseTriggeredRef.current,
        isUnmounting: isUnmountingRef.current 
      });
      return false;
    }

    pauseTriggeredRef.current = true;
    console.log(`🔄 pauseConversationWithContext: Starting ${pauseReason} pause`);

    try {
      // CRITICAL: Stop all voice audio FIRST
      const { stopAllVoiceAudio } = await import('./useTextToSpeech');
      stopAllVoiceAudio();
      console.log('🔇 pauseConversationWithContext: Voice audio stopped');

      // Use the connected pauseSession function if available (preferred)
      if (pauseSessionFunction) {
        console.log('🔗 Using connected pauseSession function');
        const success = await pauseSessionFunction();
        if (success) {
          console.log('✅ Connected pauseSession succeeded');
          onPause();
          return true;
        } else {
          console.log('❌ Connected pauseSession failed, falling back to database update');
        }
      }

      // Fallback: Direct database update (legacy behavior)
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

      // CRITICAL: Update local session state immediately
      if (updateSessionState) {
        updateSessionState((prev: any) => ({
          ...prev,
          isPaused: true,
          lastActivity: new Date().toISOString()
        }));
      }

      // Notify conversation state change for dashboard refresh
      if (onConversationPaused) {
        onConversationPaused(conversation.id);
      }

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
  }, [conversation, userId, messages, onPause, updateSessionState, onConversationPaused]);

  // Cleanup flag management
  useEffect(() => {
    isUnmountingRef.current = false;
    return () => {
      isUnmountingRef.current = true;
      console.log('🧹 useAutoPause: Component unmounting');
    };
  }, []);

  // Auto-pause event handlers with comprehensive audio control
  useEffect(() => {
    if (!conversation || conversation.status !== 'active') return;

    console.log('🔧 useAutoPause: Setting up event listeners');

    // Visibility change (tab switching, minimizing)
    const handleVisibilityChange = async () => {
      if (document.hidden && !isUnmountingRef.current) {
        console.log('👁️ Visibility change detected - pausing conversation');
        await pauseConversationWithContext('visibility');
      }
    };

    // Network connectivity loss
    const handleOffline = async () => {
      if (!isUnmountingRef.current) {
        console.log('📶 Network offline detected - pausing conversation');
        await pauseConversationWithContext('network');
      }
    };

    // Page unload/refresh
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      if (messages.length > 0 && !isUnmountingRef.current) {
        console.log('🚪 Page unload detected - attempting emergency pause');
        
        // Stop audio immediately (synchronous)
        const { stopAllVoiceAudio } = await import('./useTextToSpeech');
        stopAllVoiceAudio();
        
        // Attempt pause (may not complete due to page unload)
        pauseConversationWithContext('auto');
        
        const message = 'You have an active conversation. Are you sure you want to leave?';
        event.returnValue = message;
        return message;
      }
    };

    // Mobile-specific: page hide (when app goes to background)
    const handlePageHide = async () => {
      if (!isUnmountingRef.current) {
        console.log('📱 Page hide detected - pausing conversation');
        await pauseConversationWithContext('auto');
      }
    };

    // Set up event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    console.log('✅ useAutoPause: Event listeners registered');

    return () => {
      console.log('🧹 useAutoPause: Cleaning up event listeners');
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