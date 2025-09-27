import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Volume2, ArrowLeft, Check, Bot, Loader2, Pause, Power } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import MicrophonePermission from '@/components/MicrophonePermission';

interface VoiceInterfaceProps {
  onTranscriptionUpdate: (text: string, isUser: boolean) => void;
  conversationId?: string;
  userId?: string;
  onEndSession: () => void;
  onExtendSession?: () => void;
  onStopSession?: () => void;
  onBack: () => void;
  progressPercentage?: number;
  formattedTime?: string;
  formattedTimeRemaining?: string;
  extensionsUsed?: number;
  currentAIResponse?: string;
  canFinishSession?: boolean;
}

interface VoiceState {
  idle: 'idle';
  recording: 'recording';
  processing: 'processing';
  ai_thinking: 'ai_thinking';
  ai_speaking: 'ai_speaking';
  error: 'error';
}

type VoiceStateKey = keyof VoiceState;

const NewVoiceInterface: React.FC<VoiceInterfaceProps> = ({
  onTranscriptionUpdate,
  conversationId,
  userId,
  onEndSession,
  onExtendSession,
  onStopSession,
  onBack,
  progressPercentage = 0,
  formattedTime = "00:00",
  formattedTimeRemaining = "05:00",
  extensionsUsed = 0,
  currentAIResponse,
  canFinishSession = false
}) => {
  const [voiceState, setVoiceState] = useState<VoiceStateKey>('idle');
  const [microphoneGranted, setMicrophoneGranted] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [currentAIText, setCurrentAIText] = useState(currentAIResponse || '');
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // Lock to prevent concurrent processing
  const [lastRecordingTime, setLastRecordingTime] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false); // Prevent duplicate TTS calls

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioPromiseRef = useRef<Promise<void> | null>(null);

  // Handle back button with direct pause like chat
  const handleBackClick = async () => {
    console.log('🔄 handleBackClick: Starting pause with audio cleanup');
    
    try {
      // Stop all voice audio IMMEDIATELY
      const { stopAllVoiceAudio } = await import('@/hooks/useTextToSpeech');
      stopAllVoiceAudio();
      console.log('🔇 handleBackClick: Voice audio stopped');
      
      // Stop any current audio playback in this component
      stopAudio();
      
      // Clean up recording resources
      cleanupRecording();
      
      // Use onStopSession to properly pause the conversation (same as chat)
      if (onStopSession) {
        onStopSession();
      } else {
        onBack();
      }
    } catch (error) {
      console.error('Error in handleBackClick:', error);
      onBack();
    }
  };

  // Comprehensive cleanup function that properly resets ALL states
  const cleanupRecording = useCallback(() => {
    console.log('🧹 Comprehensive cleanup started');
    
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('🛑 Stopping media recorder');
      mediaRecorderRef.current.stop();
    }
    
    // Stop stream tracks
    if (streamRef.current) {
      console.log('🔇 Stopping stream tracks');
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Reset all refs and state
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setAudioBlob(null);
    setIsProcessing(false);
    setVoiceState('idle');
    
    console.log('🧹 Comprehensive cleanup completed');
  }, []);
  useEffect(() => {
    if (currentAIResponse) {
      setCurrentAIText(currentAIResponse);
      // Note: Audio playback is handled in processAudio, not here to avoid duplicates
    }
  }, [currentAIResponse]);

  // Request microphone permission
  const handleMicrophoneGranted = useCallback(async (stream: MediaStream) => {
    console.log('🎤 Microphone permission granted');
    streamRef.current = stream;
    setMicrophoneGranted(true);
    
    // Stop the stream immediately - we'll request new ones for each recording
    stream.getTracks().forEach(track => track.stop());
    
    toast({
      title: "🎤 Ready to Record",
      description: "You can now start recording your voice messages",
    });
  }, []);

  const handleMicrophoneDenied = useCallback(() => {
    toast({
      title: "Microphone Required",
      description: "Please allow microphone access to use voice conversations",
      variant: "destructive",
    });
  }, []);

  // Start recording user's voice
  const startRecording = useCallback(async () => {
    const now = Date.now();
    
    // Debounce to prevent rapid clicking
    if (now - lastRecordingTime < 2000) {
      console.log('🚫 Recording blocked - debounce active');
      return;
    }
    
    console.log('🎯 Recording attempt - Current state:', {
      voiceState,
      isProcessing,
      microphoneGranted,
      hasActiveRecorder: !!mediaRecorderRef.current
    });

    // Clean up any existing recording state first
    cleanupRecording();

    if (isProcessing) {
      console.log('🚫 Cannot start recording - already processing');
      toast({
        title: "Still Processing",
        description: "Please wait for the current message to finish processing",
        variant: "default",
      });
      return;
    }

    if (voiceState !== 'idle') {
      console.log('🚫 Cannot start recording - not in idle state:', voiceState);
      return;
    }

    setLastRecordingTime(now);
    console.log('✅ Starting recording...');

    try {
      // Clear any existing audio blob first
      setAudioBlob(null);
      audioChunksRef.current = [];
      setVoiceState('recording');

      // Request fresh microphone stream for recording
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        console.log('📊 Audio data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('🛑 MediaRecorder stopped, creating blob...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        console.log('📦 Audio blob created:', audioBlob.size, 'bytes');
        setAudioBlob(audioBlob);
        setVoiceState('processing');
        
        // Release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        cleanupRecording(); // Cleanup on error
        setVoiceState('error');
      };

      mediaRecorder.start();
      console.log('🎙️ Recording started successfully');
      
      toast({
        title: "🎙️ Recording...",
        description: "Speak your message, then press 'Stop Recording'",
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      cleanupRecording(); // Cleanup on error
      setVoiceState('error');
      toast({
        title: "Recording Error",
        description: "Could not start recording. Please check microphone permissions.",
        variant: "destructive",
      });
    }
  }, [voiceState, isProcessing, microphoneGranted, lastRecordingTime, cleanupRecording]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && voiceState === 'recording') {
      mediaRecorderRef.current.stop();
      
      toast({
        title: "🔄 Processing...",
        description: "Converting your speech to text and getting AI response...",
      });
    }
  }, [voiceState]);

  // Process audio through speech-to-text and get AI response
  const processAudio = useCallback(async (audioBlob: Blob) => {
    if (!conversationId || isProcessing) {
      console.log('🚫 Skipping audio processing - already in progress or no conversation ID');
      return;
    }

    try {
      setIsProcessing(true); // Lock processing
      console.log('🔄 Starting audio processing, isProcessing set to true');
      console.log('🔊 Processing audio blob:', audioBlob.size, 'bytes');
      
      // Stop any currently playing audio first
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setCurrentAudio(null);
      }
      
      // Step 1: Convert audio to base64 and send to speech-to-text
      const base64Audio = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(audioBlob);
      });

      // Call speech-to-text edge function
      const transcriptionResponse = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (transcriptionResponse.error) {
        throw new Error(`Transcription failed: ${transcriptionResponse.error.message}`);
      }

      const transcribedText = transcriptionResponse.data?.text;
      
      if (!transcribedText || transcribedText.trim().length === 0) {
        toast({
          title: "🤔 No speech detected",
          description: "Please try again and speak clearly.",
          variant: "destructive",
        });
        setVoiceState('idle');
        return;
      }

      console.log('📝 Transcribed text:', transcribedText);
      
      // Update transcription
      onTranscriptionUpdate(transcribedText.trim(), true);

      // Step 2: Send transcribed text to AI for response
      setVoiceState('ai_thinking');
      const chatResponse = await supabase.functions.invoke('ai-chat', {
        body: {
          message: transcribedText.trim(),
          conversationId: conversationId,
          userId: userId,
          isFirstMessage: false,
          modalityType: 'voice'
        }
      });

      if (chatResponse.error) {
        throw new Error(`AI response failed: ${chatResponse.error.message}`);
      }

      const aiResponse = chatResponse.data?.message;
      
      if (!aiResponse) {
        throw new Error('No response from AI');
      }

      console.log('🤖 AI Response:', aiResponse);
      
      // Replace the current AI text display with new response
      setCurrentAIText(aiResponse);
      onTranscriptionUpdate(aiResponse, false);

      // Step 3: Convert AI response to speech and play
      // Ensure any previous audio is stopped before starting new one
      stopAudio();
      await playAIResponse(aiResponse);

    } catch (error) {
      console.error('Error processing audio:', error);
      setVoiceState('error');
      toast({
        title: "Processing Error",
        description: "Could not process your message. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Always reset processing state in the finally block
      setIsProcessing(false);
      console.log('🔄 Audio processing completed, isProcessing set to false');
    }
  }, [conversationId, userId, onTranscriptionUpdate, isProcessing, currentAudio]);

  // Comprehensive cleanup on unmount or when leaving
  useEffect(() => {
    return () => {
      console.log('🧹 NewVoiceInterface: Component unmounting - cleaning up');
      
      // Stop all voice audio
      try {
        import('@/hooks/useTextToSpeech').then(({ stopAllVoiceAudio }) => {
          stopAllVoiceAudio();
          console.log('🔇 NewVoiceInterface unmount: Voice audio stopped');
        });
      } catch (error) {
        console.error('Error stopping voice audio on unmount:', error);
      }
      
      // Stop local audio
      stopAudio();
      
      // Clean up recording
      cleanupRecording();
    };
  }, [cleanupRecording]);

  // Text-to-speech for AI responses - ensures only one audio plays at a time
  const playAIResponse = useCallback(async (text: string) => {
    // Prevent duplicate TTS calls
    if (isPlayingAudio) {
      console.log('🚫 TTS already playing, skipping duplicate call');
      return;
    }

    console.log('🎵 Starting TTS playback for:', text.substring(0, 50) + '...');
    setIsPlayingAudio(true);

    // Cancel any existing audio promise
    if (audioPromiseRef.current) {
      console.log('Cancelling previous audio playback');
    }

    try {
      // Stop any currently playing audio first - comprehensive cleanup
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio.onended = null;
        currentAudio.onerror = null;
        currentAudio.removeEventListener('abort', () => {});
        setCurrentAudio(null);
      }

      setVoiceState('ai_speaking');
      
      // Call text-to-speech edge function
      const ttsResponse = await supabase.functions.invoke('text-to-speech', {
        body: { 
          text: text,
          voice: 'alloy'
        }
      });

      if (ttsResponse.error) {
        throw new Error(`TTS failed: ${ttsResponse.error.message}`);
      }

      const audioContent = ttsResponse.data?.audioContent;
      
      if (!audioContent) {
        throw new Error('No audio content received');
      }

      // Convert base64 to audio and play
      const audioBytes = Uint8Array.from(atob(audioContent), c => c.charCodeAt(0));
      const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);
      
      // Create a promise to handle audio playback
      const audioPromise = new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          setVoiceState('idle');
          setIsPlayingAudio(false);
          URL.revokeObjectURL(audioUrl);
          setCurrentAudio(null);
          audioPromiseRef.current = null;
          console.log('🎵 TTS playback completed');
          resolve();
        };

        audio.onerror = () => {
          setVoiceState('idle');
          setIsPlayingAudio(false);
          URL.revokeObjectURL(audioUrl);
          setCurrentAudio(null);
          audioPromiseRef.current = null;
          console.error('Error playing audio');
          reject(new Error('Audio playback failed'));
        };

        // Handle the common AbortError when audio is interrupted
        audio.addEventListener('abort', () => {
          console.log('Audio playback was aborted');
          setVoiceState('idle');
          setIsPlayingAudio(false);
          URL.revokeObjectURL(audioUrl);
          setCurrentAudio(null);
          audioPromiseRef.current = null;
          resolve(); // Don't treat abort as an error
        });
      });

      audioPromiseRef.current = audioPromise;
      
      // Start playing - wrap in try-catch to handle play() promise rejection
      try {
        await audio.play();
      } catch (playError) {
        if (playError.name === 'AbortError') {
          console.log('Audio play was aborted - this is normal');
          return; // Don't throw error for abort
        }
        throw playError;
      }
      
      // Wait for audio to finish or be aborted
      await audioPromise;
      
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      setVoiceState('idle');
      setIsPlayingAudio(false);
      audioPromiseRef.current = null;
      
      // Only show toast for actual errors, not aborts
      if (error.name !== 'AbortError') {
        toast({
          title: "Audio Playback Issue",
          description: "Could not play AI response audio.",
          variant: "destructive",
        });
      }
    }
  }, [currentAudio, isPlayingAudio]);

  // Stop current audio playback
  const stopAudio = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setVoiceState('idle');
    }
    // Cancel any pending audio promise and reset playing state
    audioPromiseRef.current = null;
    setIsPlayingAudio(false);
    console.log('🛑 Audio manually stopped');
  }, [currentAudio]);

  // Process audio when blob is ready
  useEffect(() => {
    if (audioBlob && voiceState === 'processing' && !isProcessing) {
      console.log('🎵 Processing audio blob:', audioBlob.size, 'bytes');
      const processAudioAsync = async () => {
        try {
          await processAudio(audioBlob);
        } catch (error) {
          console.error('Error in audio processing:', error);
          setVoiceState('error');
        } finally {
          setAudioBlob(null); // Clear the blob after processing
        }
      };
      processAudioAsync();
    }
  }, [audioBlob, voiceState, processAudio, isProcessing]);

  const getStatusText = () => {
    switch (voiceState) {
      case 'recording':
        return "Recording your message...";
      case 'processing':
        return "Processing your message...";
      case 'ai_thinking':
        return "AI is thinking...";
      case 'ai_speaking':
        return "AI is responding...";
      case 'error':
        return "Error - Please try again";
      default:
        return currentAIText ? "Your turn to speak" : "Ready to start conversation";
    }
  };

  const getMainButton = () => {
    switch (voiceState) {
      case 'recording':
        return {
          label: "Stop Recording",
          icon: <Square className="w-6 h-6" />,
          color: "bg-red-500 hover:bg-red-600 text-white",
          onClick: stopRecording,
          disabled: false
        };
      case 'processing':
        return {
          label: "Processing...",
          icon: <Loader2 className="w-6 h-6 animate-spin" />,
          color: "bg-yellow-500 text-white",
          onClick: () => {},
          disabled: true
        };
      case 'ai_thinking':
        return {
          label: "AI Thinking...",
          icon: <Loader2 className="w-6 h-6 animate-spin" />,
          color: "bg-purple-500 text-white",
          onClick: () => {},
          disabled: true
        };
      case 'ai_speaking':
        return {
          label: "Stop Audio",
          icon: <Volume2 className="w-6 h-6 animate-pulse" />,
          color: "bg-blue-500 hover:bg-blue-600 text-white",
          onClick: stopAudio,
          disabled: false
        };
      default:
        return {
          label: "Start Recording",
          icon: <Mic className="w-6 h-6" />,
          color: "bg-[#6889b4] hover:bg-[#5a7ba3] text-white",
          onClick: startRecording,
          disabled: !microphoneGranted
        };
    }
  };

  const buttonProps = getMainButton();

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header - Mobile Optimized */}
      <div className="border-b bg-background">
        <div className="py-2 relative px-[24px] mx-[24px]">
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={handleBackClick} className="text-muted-foreground hover:text-foreground p-0 absolute left-0">
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
            <h1 className="text-lg font-medium text-foreground text-center w-full">
              Voice conversation
            </h1>
          </div>
        </div>
      </div>

      {/* Progress Section - only show when timer is active */}
      {onExtendSession && (
        <div className="bg-background border-b px-4 py-3">
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-foreground font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">
                {formattedTime} / {formattedTimeRemaining} remaining | Extensions: {extensionsUsed}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {!microphoneGranted ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center space-y-4">
              <MicrophonePermission
                onPermissionGranted={handleMicrophoneGranted}
                onPermissionDenied={handleMicrophoneDenied}
              />
            </div>
          </div>
        ) : (
          <>
            {/* Status and AI Response Display */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
              
              {/* Status Text */}
              <div className="text-center">
                <h2 className="text-2xl font-medium text-foreground mb-2">
                  {getStatusText()}
                </h2>
              </div>

              {/* Animated Bot Icon */}
              <div className="relative">
                 <Bot 
                  className={`w-16 h-16 text-primary ${
                    voiceState === 'ai_speaking' || voiceState === 'ai_thinking' || voiceState === 'recording' ? 'animate-pulse' : ''
                  }`} 
                  fill="currentColor"
                />
                {(voiceState === 'ai_speaking' || voiceState === 'ai_thinking' || voiceState === 'recording') && (
                  <div className="absolute inset-0 w-16 h-16 border-2 border-primary rounded-full animate-ping" />
                )}
              </div>

              {/* AI Response Display */}
              {currentAIText && (
                <div className="max-w-md text-center">
                  <p className="text-sm text-muted-foreground leading-relaxed bg-card p-4 rounded-lg shadow-sm border">
                    {currentAIText}
                  </p>
                </div>
              )}

            </div>

            {/* Main Action Button */}
            <div className="bg-background">
              <div className="py-2 px-6">
                <div className="flex justify-center mb-4">
                  <Button
                    size="sm"
                    className={`${buttonProps.color} rounded-full px-6 py-3 text-sm font-medium shadow-lg transition-all duration-200 transform hover:scale-105`}
                    onClick={buttonProps.onClick}
                    disabled={buttonProps.disabled}
                  >
                    {buttonProps.icon}
                    <span className="ml-2">{buttonProps.label}</span>
                  </Button>
                </div>

                {/* Mobile Optimized Action Buttons */}
                <div className="flex flex-col gap-3">
                  {/* Extend Session Button - only show when available */}
                  {onExtendSession && (
                    <Button 
                      variant="outline" 
                      onClick={onExtendSession}
                      className="w-full h-8 p-2 sm:p-4 rounded-xl border hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 justify-center">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <span className="text-xs sm:text-sm font-bold text-green-600 dark:text-green-400">+5</span>
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-xs sm:text-sm">Extend session</div>
                          <div className="text-xs text-muted-foreground hidden sm:block">Add 5 more minutes to continue</div>
                        </div>
                      </div>
                    </Button>
                  )}
                  
                  {/* End Session and Pause Buttons */}
                  <div className="flex flex-row gap-3">
                    <Button 
                      variant="outline" 
                      onClick={onEndSession}
                      disabled={!canFinishSession}
                      className="flex-1 h-8 p-2 sm:p-4 rounded-xl border hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <Power className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-xs sm:text-sm">End session</div>
                          <div className="text-xs text-muted-foreground hidden sm:block">Finish the voice chat and go to analysis</div>
                        </div>
                      </div>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      onClick={onStopSession}
                      disabled={!onStopSession}
                      className="flex-1 h-8 p-2 sm:p-4 rounded-xl border hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                          <Pause className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-xs sm:text-sm">Pause</div>
                          <div className="text-xs text-muted-foreground hidden sm:block">Save your conversation and return later</div>
                        </div>
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NewVoiceInterface;