import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Volume2, ArrowLeft, Check, Star, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import MicrophonePermission from '@/components/MicrophonePermission';
import LeaveSessionModal from '@/components/LeaveSessionModal';

interface VoiceInterfaceProps {
  onTranscriptionUpdate: (text: string, isUser: boolean) => void;
  conversationId?: string;
  userId?: string;
  onEndSession: () => void;
  onBack: () => void;
  progressPercentage: number;
  formattedTime: string;
  formattedTimeRemaining: string;
  currentAIResponse?: string;
}

interface VoiceState {
  idle: 'idle';
  recording: 'recording';
  processing: 'processing';
  ai_speaking: 'ai_speaking';
  error: 'error';
}

type VoiceStateKey = keyof VoiceState;

const NewVoiceInterface: React.FC<VoiceInterfaceProps> = ({
  onTranscriptionUpdate,
  conversationId,
  userId,
  onEndSession,
  onBack,
  progressPercentage,
  formattedTime,
  formattedTimeRemaining,
  currentAIResponse
}) => {
  const [voiceState, setVoiceState] = useState<VoiceStateKey>('idle');
  const [microphoneGranted, setMicrophoneGranted] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [currentAIText, setCurrentAIText] = useState(currentAIResponse || '');
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // Lock to prevent concurrent processing
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioPromiseRef = useRef<Promise<void> | null>(null);

  // Handle back button with confirmation
  const handleBackClick = () => {
    setShowLeaveModal(true);
  };

  const handleConfirmLeave = () => {
    cleanup();
    setShowLeaveModal(false);
    onBack();
  };
  useEffect(() => {
    if (currentAIResponse) {
      setCurrentAIText(currentAIResponse);
      // Auto-play AI's first message when it arrives
      playAIResponse(currentAIResponse);
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
    if (isProcessing) {
      console.log('🚫 Cannot start recording - already processing');
      return;
    }

    try {
      setVoiceState('recording');
      audioChunksRef.current = [];

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
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (!isProcessing) { // Only process if not already processing
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
          setAudioBlob(audioBlob);
          setVoiceState('processing');
        }
        
        // Immediately release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      
      toast({
        title: "🎙️ Recording...",
        description: "Speak your message, then press 'Stop Recording'",
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      setVoiceState('error');
      toast({
        title: "Recording Error",
        description: "Could not start recording. Please check microphone permissions.",
        variant: "destructive",
      });
    }
  }, [isProcessing]);

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
      setIsProcessing(false); // Unlock processing
    }
  }, [conversationId, userId, onTranscriptionUpdate, isProcessing, currentAudio]);

  // Cleanup function to stop all audio when leaving
  const cleanup = useCallback(() => {
    // Stop any playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    
    // Stop any recording
    if (mediaRecorderRef.current && voiceState === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    // Release microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setVoiceState('idle');
  }, [currentAudio, voiceState]);

  // Cleanup on unmount or when leaving
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Text-to-speech for AI responses - ensures only one audio plays at a time
  const playAIResponse = useCallback(async (text: string) => {
    // Cancel any existing audio promise
    if (audioPromiseRef.current) {
      console.log('Cancelling previous audio playback');
    }

    try {
      // Stop any currently playing audio first
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
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
          URL.revokeObjectURL(audioUrl);
          setCurrentAudio(null);
          audioPromiseRef.current = null;
          resolve();
        };

        audio.onerror = () => {
          setVoiceState('idle');
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
  }, [currentAudio]);

  // Stop current audio playback
  const stopAudio = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setVoiceState('idle');
    }
    // Cancel any pending audio promise
    audioPromiseRef.current = null;
  }, [currentAudio]);

  // Process audio when blob is ready
  useEffect(() => {
    if (audioBlob && voiceState === 'processing' && !isProcessing) {
      const processAudioAsync = async () => {
        await processAudio(audioBlob);
        setAudioBlob(null); // Clear the blob after processing
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
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={handleBackClick}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-medium text-[#24476e]">Voice Session</h1>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onEndSession}
          className="border-[#24476e] text-[#24476e] hover:bg-[#24476e] hover:text-white"
        >
          <Check className="h-4 w-4 mr-2" />
          Finish Conversation
        </Button>
      </header>

      {/* Progress Section */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="bg-gray-100 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-[#24476e] font-medium">Progress</span>
            <span className="text-sm text-[#24476e]">
              {formattedTime} / {formattedTimeRemaining} remaining for minimum conversation
            </span>
          </div>
          <div className="w-full bg-gray-300 rounded-full h-2">
            <div 
              className="bg-[#24476e] h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

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
                <h2 className="text-2xl font-medium text-[#24476e] mb-2">
                  {getStatusText()}
                </h2>
              </div>

              {/* Animated Star Icon */}
              <div className="relative">
                <Star 
                  className={`w-16 h-16 text-[#a5c7b9] ${
                    voiceState === 'ai_speaking' || voiceState === 'recording' ? 'animate-pulse' : ''
                  }`} 
                  fill="currentColor"
                />
                {(voiceState === 'ai_speaking' || voiceState === 'recording') && (
                  <div className="absolute inset-0 w-16 h-16 border-2 border-[#a5c7b9] rounded-full animate-ping" />
                )}
              </div>

              {/* AI Response Display */}
              {currentAIText && (
                <div className="max-w-md text-center">
                  <p className="text-sm text-gray-600 leading-relaxed bg-white p-4 rounded-lg shadow-sm border">
                    {currentAIText}
                  </p>
                </div>
              )}

            </div>

            {/* Main Action Button */}
            <div className="mt-8 flex justify-center">
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
          </>
        )}
      </div>

      {/* Leave Session Confirmation Modal */}
      <LeaveSessionModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onConfirm={handleConfirmLeave}
      />
    </div>
  );
};

export default NewVoiceInterface;