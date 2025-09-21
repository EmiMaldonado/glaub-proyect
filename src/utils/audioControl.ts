// Global audio control utilities for voice conversations
// This provides centralized control over all voice audio playback

import { stopAllVoiceAudio } from '@/hooks/useTextToSpeech';

// Stop all audio across the entire application
export const emergencyStopAllAudio = () => {
  console.log('🚨 EMERGENCY STOP: Stopping all audio playback');
  
  try {
    // Stop Text-to-Speech audio
    stopAllVoiceAudio();
    
    // Stop any HTML audio elements that might be playing
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
        console.log('🔇 Stopped HTML audio element');
      }
    });
    
    // Cancel any ongoing speech synthesis
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      console.log('🔇 Cancelled speech synthesis');
    }
    
    // Stop any Web Audio API contexts that might be running
    const audioContexts = (window as any).__audioContexts || [];
    audioContexts.forEach((ctx: AudioContext) => {
      if (ctx.state === 'running') {
        ctx.suspend();
        console.log('🔇 Suspended AudioContext');
      }
    });
    
    console.log('✅ Emergency audio stop completed');
  } catch (error) {
    console.error('❌ Error during emergency audio stop:', error);
  }
};

// Add audio debugging utilities
export const debugAudioState = () => {
  console.log('🔍 Audio Debug State:', {
    speechSynthesis: {
      speaking: speechSynthesis.speaking,
      pending: speechSynthesis.pending,
      paused: speechSynthesis.paused
    },
    audioElements: Array.from(document.querySelectorAll('audio')).map(audio => ({
      paused: audio.paused,
      currentTime: audio.currentTime,
      duration: audio.duration,
      src: audio.src
    })),
    audioContexts: (window as any).__audioContexts?.length || 0
  });
};

// Test functions for manual debugging
(window as any).testAudioStop = emergencyStopAllAudio;
(window as any).testAudioDebug = debugAudioState;

console.log('🔧 Audio control utilities loaded. Test with:');
console.log('- window.testAudioStop() - Emergency stop all audio');
console.log('- window.testAudioDebug() - Debug current audio state');