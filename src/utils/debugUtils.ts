// Debugging utilities for pause system and audio control
// Add comprehensive debugging tools for testing the pause system

declare global {
  interface Window {
    testPause: () => Promise<void>;
    testAutoPause: () => void;
    testAudioStop: () => void;
    testSessionState: () => void;
    debugPauseSystem: () => void;
  }
}

// Test manual pause functionality
const testPause = async () => {
  console.log('🧪 Testing manual pause...');
  
  try {
    // Try to get the session manager hook (if available in current context)
    const sessionManager = (window as any).__sessionManager;
    if (sessionManager && sessionManager.pauseSession) {
      console.log('🔄 Calling pauseSession from session manager...');
      const result = await sessionManager.pauseSession();
      console.log('✅ Pause result:', result);
    } else {
      console.log('⚠️ Session manager not available in current context');
    }
  } catch (error) {
    console.error('❌ Test pause error:', error);
  }
};

// Test auto-pause event triggers
const testAutoPause = () => {
  console.log('🧪 Testing auto-pause event triggers...');
  
  // Simulate visibility change
  console.log('📱 Simulating visibility change...');
  Object.defineProperty(document, 'hidden', { value: true, writable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  
  // Reset visibility after 2 seconds
  setTimeout(() => {
    Object.defineProperty(document, 'hidden', { value: false, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    console.log('👁️ Visibility restored');
  }, 2000);
};

// Test audio stopping
const testAudioStop = () => {
  console.log('🧪 Testing audio stop...');
  
  try {
    import('@/hooks/useTextToSpeech').then(({ stopAllVoiceAudio }) => {
      stopAllVoiceAudio();
      console.log('✅ Audio stop test completed');
    });
  } catch (error) {
    console.error('❌ Audio stop test error:', error);
  }
};

// Test session state inspection
const testSessionState = () => {
  console.log('🧪 Inspecting session state...');
  
  const sessionData = localStorage.getItem('chat_session_state');
  if (sessionData) {
    try {
      const parsed = JSON.parse(sessionData);
      console.log('📊 Session State:', {
        hasConversation: !!parsed.conversation,
        messageCount: parsed.messages?.length || 0,
        isPaused: parsed.isPaused,
        lastActivity: parsed.lastActivity,
        conversationStatus: parsed.conversation?.status
      });
    } catch (error) {
      console.error('❌ Error parsing session data:', error);
    }
  } else {
    console.log('📊 No session data in localStorage');
  }
};

// Comprehensive pause system debugging
const debugPauseSystem = () => {
  console.log('🔍 === PAUSE SYSTEM DEBUG REPORT ===');
  
  // Check event listeners
  console.log('🎧 Event Listeners:');
  console.log('- visibilitychange:', !!document.onvisibilitychange ? 'Registered' : 'Not registered');
  console.log('- beforeunload:', !!window.onbeforeunload ? 'Registered' : 'Not registered');
  console.log('- pagehide:', !!window.onpagehide ? 'Registered' : 'Not registered');
  console.log('- offline:', !!window.onoffline ? 'Registered' : 'Not registered');
  
  // Check audio state
  console.log('🔊 Audio State:');
  console.log('- Speech synthesis speaking:', speechSynthesis.speaking);
  console.log('- Audio elements:', document.querySelectorAll('audio').length);
  console.log('- Global audio stop function:', !!(window as any).globalAudioStop);
  
  // Check session state
  testSessionState();
  
  // Check hooks availability
  console.log('🎣 Hooks Availability:');
  console.log('- Session Manager:', !!(window as any).__sessionManager);
  console.log('- Auto Pause:', !!(window as any).__autoPause);
  
  console.log('🔍 === END DEBUG REPORT ===');
};

// Register test functions globally
if (typeof window !== 'undefined') {
  window.testPause = testPause;
  window.testAutoPause = testAutoPause;
  window.testAudioStop = testAudioStop;
  window.testSessionState = testSessionState;
  window.debugPauseSystem = debugPauseSystem;
  
  console.log('🧪 Pause system debugging tools loaded:');
  console.log('- window.testPause() - Test manual pause');
  console.log('- window.testAutoPause() - Test auto-pause triggers');
  console.log('- window.testAudioStop() - Test audio stopping');
  console.log('- window.testSessionState() - Inspect session state');
  console.log('- window.debugPauseSystem() - Full system debug');
}

export { testPause, testAutoPause, testAudioStop, testSessionState, debugPauseSystem };