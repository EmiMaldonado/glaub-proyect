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
  pauseSessionFunction?: () => Promise<boolean>; // Direct connection to useSessionManager.pauseSession
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
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const offlineTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pageHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced pause function with guaranteed navigation and bulletproof error handling
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
    console.log(`🔄 pauseConversationWithContext: Starting ${pauseReason} pause with guaranteed navigation`);

    let audioStopped = false;
    let pauseSuccess = false;

    try {
      // STEP 1: Stop all voice audio IMMEDIATELY (highest priority)
      try {
        console.log('🔇 pauseConversationWithContext: Stopping all voice audio...');
        const { stopAllVoiceAudio } = await import('./useTextToSpeech');
        stopAllVoiceAudio();
        audioStopped = true;
        console.log('✅ pauseConversationWithContext: Voice audio stopped');
      } catch (audioError) {
        console.error('⚠️ pauseConversationWithContext: Audio stop failed:', audioError);
        // Continue - audio failure shouldn't block pause
      }

      // STEP 2: Attempt pause using connected session manager (preferred method)
      if (pauseSessionFunction) {
        try {
          console.log('🔗 pauseConversationWithContext: Using connected pauseSession');
          const sessionManagerSuccess = await Promise.race([
            pauseSessionFunction(),
            new Promise<boolean>((resolve) => {
              setTimeout(() => {
                console.warn('⏰ Connected pauseSession timeout');
                resolve(false);
              }, 6000);
            })
          ]);
          
          if (sessionManagerSuccess) {
            console.log('✅ Connected pauseSession succeeded');
            pauseSuccess = true;
          } else {
            console.warn('⚠️ Connected pauseSession failed or timed out, using fallback');
          }
        } catch (sessionError) {
          console.error('❌ Connected pauseSession error:', sessionError);
        }
      }

      // STEP 3: Fallback method if session manager unavailable or failed
      if (!pauseSuccess) {
        console.log('🔄 pauseConversationWithContext: Using direct database fallback');

        try {
          // Extract context from messages for intelligent resume
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

          // Direct database update with timeout protection
          const dbUpdatePromise = supabase
            .from('conversations')
            .update({
              status: 'paused',
              session_data: enhancedSessionData as any
            })
            .eq('id', conversation.id);

          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Database update timeout')), 8000);
          });

          await Promise.race([dbUpdatePromise, timeoutPromise]);

          // Also save to paused_conversations for backward compatibility
          try {
            const { error: pausedError } = await supabase
              .from('paused_conversations')
              .upsert({
                user_id: userId,
                conversation_title: conversation.title,
                message_history: messages as any
              });

            if (pausedError) {
              console.warn('⚠️ Paused conversations backup failed:', pausedError);
            }
          } catch (backupError) {
            console.warn('⚠️ Backup save failed (non-critical):', backupError);
          }

          pauseSuccess = true;
          console.log('✅ pauseConversationWithContext: Direct database update succeeded');

        } catch (dbError) {
          console.error('❌ Direct database update failed:', dbError);
          // Don't throw - we want to continue with navigation
        }
      }

      // STEP 4: UI updates and callbacks (regardless of pause success)
      console.log('🔄 pauseConversationWithContext: Triggering UI updates');
      onPause(); // Always trigger UI updates
      
      if (updateSessionState) {
        updateSessionState((prev: any) => ({
          ...prev,
          isPaused: true,
          lastActivity: new Date().toISOString()
        }));
      }
      
      if (onConversationPaused) {
        try {
          onConversationPaused(conversation.id);
        } catch (callbackError) {
          console.warn('⚠️ Conversation paused callback error:', callbackError);
        }
      }

      // STEP 5: GUARANTEED NAVIGATION for auto-pause events
      if (pauseReason === 'auto' || pauseReason === 'visibility' || pauseReason === 'network') {
        console.log('🧭 pauseConversationWithContext: Auto-pause triggering navigation to dashboard');
        
        // Force navigation to dashboard for auto-pause events
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.location.pathname.includes('/conversation')) {
            console.log('🚨 Emergency navigation to dashboard');
            window.location.href = '/dashboard';
          }
        }, 100);
      }

      // Show appropriate toast based on pause reason
      const toastMessages = {
        manual: "Conversation paused successfully",
        auto: "Conversation auto-paused due to inactivity",
        network: "Conversation paused due to network issues",
        visibility: "Conversation paused - tab switched"
      };

      if (pauseSuccess || audioStopped) {
        toast({
          title: "Conversation Paused",
          description: toastMessages[pauseReason],
        });
      }

      console.log(`🎉 pauseConversationWithContext: ${pauseReason} pause completed (audio: ${audioStopped}, pause: ${pauseSuccess})`);
      return audioStopped || pauseSuccess; // Success if either audio stopped or pause worked

    } catch (error) {
      console.error('❌ pauseConversationWithContext: Critical error:', error);
      
      // Emergency fallback - always trigger onPause for UI consistency
      try {
        onPause();
      } catch (emergencyError) {
        console.error('💥 Emergency onPause failed:', emergencyError);
      }

      // For auto-pause events, guarantee navigation even on complete failure
      if (pauseReason === 'auto' || pauseReason === 'visibility' || pauseReason === 'network') {
        console.log('🚨 Emergency navigation due to auto-pause failure');
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.location.pathname.includes('/conversation')) {
            window.location.href = '/dashboard';
          }
        }, 500);
      }

      toast({
        title: "Error",
        description: "Failed to pause conversation completely",
        variant: "destructive",
      });

      return audioStopped; // Return true if at least audio was stopped

    } finally {
      // Reset pause trigger to allow future pauses
      setTimeout(() => {
        pauseTriggeredRef.current = false;
      }, 3000);
    }
  }, [conversation, userId, messages, onPause, updateSessionState, onConversationPaused, pauseSessionFunction]);

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

    // Visibility change (tab switching, minimizing) - WITH DELAY
    const handleVisibilityChange = async () => {
      if (document.hidden && !isUnmountingRef.current) {
        console.log('👁️ Visibility change detected - starting 5 second delay before pause');
        
        // Clear any existing timeout
        if (visibilityTimeoutRef.current) {
          clearTimeout(visibilityTimeoutRef.current);
        }
        
        // Show toast to warn user
        toast({
          title: "Tab Hidden",
          description: "Conversation will pause in 5 seconds if you don't return",
        });
        
        // Set 5 second delay before pausing
        visibilityTimeoutRef.current = setTimeout(async () => {
          if (document.hidden && !isUnmountingRef.current) {
            console.log('👁️ Tab still hidden after 5 seconds - pausing conversation');
            await pauseConversationWithContext('visibility');
          }
        }, 5000); // 5 seconds delay
        
      } else if (!document.hidden && visibilityTimeoutRef.current) {
        // User returned - cancel the pause
        console.log('👁️ User returned - canceling pause');
        clearTimeout(visibilityTimeoutRef.current);
        visibilityTimeoutRef.current = null;
        
        toast({
          title: "Welcome back!",
          description: "Pause cancelled - continuing conversation",
        });
      }
    };

    // Network connectivity loss - WITH DELAY
    const handleOffline = async () => {
      if (!isUnmountingRef.current) {
        console.log('📶 Network offline detected - starting 5 second delay before pause');
        
        // Clear any existing timeout
        if (offlineTimeoutRef.current) {
          clearTimeout(offlineTimeoutRef.current);
        }
        
        // Show toast to warn user
        toast({
          title: "Connection Lost",
          description: "Conversation will pause in 5 seconds if connection isn't restored",
          variant: "destructive",
        });
        
        // Set 5 second delay before pausing
        offlineTimeoutRef.current = setTimeout(async () => {
          if (!navigator.onLine && !isUnmountingRef.current) {
            console.log('📶 Still offline after 5 seconds - pausing conversation');
            await pauseConversationWithContext('network');
          }
        }, 5000); // 5 seconds delay
      }
    };

    // Network connectivity restored
    const handleOnline = () => {
      if (offlineTimeoutRef.current) {
        console.log('📶 Connection restored - canceling pause');
        clearTimeout(offlineTimeoutRef.current);
        offlineTimeoutRef.current = null;
        
        toast({
          title: "Connection Restored",
          description: "Pause cancelled - continuing conversation",
        });
      }
    };

    // Page unload/refresh
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      if (messages.length > 0 && !isUnmountingRef.current) {
        console.log('🚪 Page unload detected - attempting emergency pause');
        
        // Stop audio immediately (synchronous)
        try {
          const { stopAllVoiceAudio } = await import('./useTextToSpeech');
          stopAllVoiceAudio();
        } catch (error) {
          console.warn('⚠️ Emergency audio stop failed:', error);
        }
        
        // Attempt pause (may not complete due to page unload)
        pauseConversationWithContext('auto');
        
        const message = 'You have an active conversation. Are you sure you want to leave?';
        event.returnValue = message;
        return message;
      }
    };

    // Mobile-specific: page hide (when app goes to background) - WITH DELAY
    const handlePageHide = async () => {
      if (!isUnmountingRef.current) {
        console.log('📱 Page hide detected - starting 5 second delay before pause');
        
        // Clear any existing timeout
        if (pageHideTimeoutRef.current) {
          clearTimeout(pageHideTimeoutRef.current);
        }
        
        // Set 5 second delay before pausing
        pageHideTimeoutRef.current = setTimeout(async () => {
          if (!isUnmountingRef.current) {
            console.log('📱 Page still hidden after 5 seconds - pausing conversation');
            await pauseConversationWithContext('auto');
          }
        }, 5000); // 5 seconds delay
      }
    };

    // Page show (when app returns to foreground)
    const handlePageShow = () => {
      if (pageHideTimeoutRef.current) {
        console.log('📱 Page visible again - canceling pause');
        clearTimeout(pageHideTimeoutRef.current);
        pageHideTimeoutRef.current = null;
      }
    };

    // Set up event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    console.log('✅ useAutoPause: Event listeners registered');

    return () => {
      console.log('🧹 useAutoPause: Cleaning up event listeners');
      
      // Clear all timeouts
      if (visibilityTimeoutRef.current) clearTimeout(visibilityTimeoutRef.current);
      if (offlineTimeoutRef.current) clearTimeout(offlineTimeoutRef.current);
      if (pageHideTimeoutRef.current) clearTimeout(pageHideTimeoutRef.current);
      
      // Remove event listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
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