import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Square, Volume2, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface VoiceAssistantState {
  idle: 'idle';
  listening: 'listening';
  processing: 'processing';
  speaking: 'speaking';
  error: 'error';
}

type AssistantState = keyof VoiceAssistantState;

const SimpleVoiceAssistant: React.FC = () => {
  const [state, setState] = useState<AssistantState>('idle');
  const [response, setResponse] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Start recording user's question
  const startRecording = useCallback(async () => {
    try {
      setState('listening');
      audioChunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      streamRef.current = stream;

      // Create MediaRecorder
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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        setAudioBlob(audioBlob);
        
        // CRITICAL: Immediately release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => {
            track.stop();
            console.log('🎤 Microphone track stopped and released');
          });
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: "🎤 Listening...",
        description: "Go ahead and speak your question, then press 'Stop Recording'",
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      setState('error');
      toast({
        title: "Microphone Access Required",
        description: "I need microphone access to listen. Please check your browser permissions and allow the microphone for this site.",
        variant: "destructive",
      });
    }
  }, []);

  // Stop recording and release microphone
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setState('processing');
      
      toast({
        title: "🔄 Processing...",
        description: "Great! Processing your question...",
      });
    }
  }, [isRecording]);

  // Process audio through OpenAI APIs
  const processAudio = useCallback(async (audioBlob: Blob) => {
    try {
      console.log('🔊 Processing audio blob:', audioBlob.size, 'bytes');
      
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
          title: "🤔 I didn't hear anything",
          description: "Please try again and speak clearly.",
          variant: "destructive",
        });
        setState('idle');
        return;
      }

      console.log('📝 Transcribed text:', transcribedText);

      // Step 2: Send transcribed text to GPT for response
      const chatResponse = await supabase.functions.invoke('ai-chat', {
        body: {
          message: transcribedText,
          conversationId: 'voice-assistant',
          userId: 'voice-user',
          isFirstMessage: false,
          modalityType: 'voice',
          systemPrompt: 'You are a helpful, friendly, and concise assistant. Answer the user\'s question clearly and directly. Keep responses conversational and under 200 words.'
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
      setResponse(aiResponse);

      // Step 3: Convert response to speech and play
      await playResponseAudio(aiResponse);

    } catch (error) {
      console.error('Error processing audio:', error);
      setState('error');
      toast({
        title: "Processing Error",
        description: "I'm having trouble connecting to my brain right now. Please try again in a moment.",
        variant: "destructive",
      });
    }
  }, []);

  // Convert text to speech and play
  const playResponseAudio = useCallback(async (text: string) => {
    try {
      setState('speaking');
      
      // Call text-to-speech edge function
      const ttsResponse = await supabase.functions.invoke('text-to-speech', {
        body: { 
          text: text,
          voice: 'alloy' // OpenAI TTS voice
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
      
      audio.onended = () => {
        setState('idle');
        URL.revokeObjectURL(audioUrl);
        setCurrentAudio(null);
        
        toast({
          title: "✅ Ready!",
          description: "What else can I help you with?",
        });
      };

      audio.onerror = () => {
        setState('idle');
        URL.revokeObjectURL(audioUrl);
        setCurrentAudio(null);
        console.error('Error playing audio');
      };

      await audio.play();
      
    } catch (error) {
      console.error('Error with text-to-speech:', error);
      // Fallback to browser TTS if available
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        utterance.onend = () => {
          setState('idle');
          toast({
            title: "✅ Ready!",
            description: "What else can I help you with?",
          });
        };
        
        window.speechSynthesis.speak(utterance);
      } else {
        setState('idle');
        toast({
          title: "Audio Playback Issue",
          description: "I can show you the answer, but can't speak it right now.",
          variant: "destructive",
        });
      }
    }
  }, []);

  // Effect to process audio when blob is ready
  React.useEffect(() => {
    if (audioBlob && state === 'processing') {
      processAudio(audioBlob);
    }
  }, [audioBlob, state, processAudio]);

  // Stop current audio playback
  const stopAudio = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setState('idle');
    }
  }, [currentAudio]);

  // Reset to initial state
  const resetState = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    setIsRecording(false);
    setAudioBlob(null);
    setResponse('');
    setState('idle');
  }, [currentAudio]);

  const getMainButtonProps = () => {
    switch (state) {
      case 'listening':
        return {
          label: "Listening... Click 'Stop' when done",
          icon: <Mic className="w-6 h-6" />,
          color: "bg-red-500 hover:bg-red-600 text-white",
          disabled: true
        };
      case 'processing':
        return {
          label: "Processing your question...",
          icon: <Loader2 className="w-6 h-6 animate-spin" />,
          color: "bg-yellow-500 text-white",
          disabled: true
        };
      case 'speaking':
        return {
          label: "Speaking response...",
          icon: <Volume2 className="w-6 h-6 animate-pulse" />,
          color: "bg-blue-500 text-white",
          disabled: true
        };
      case 'error':
        return {
          label: "Click to Ask Me Anything",
          icon: <Mic className="w-6 h-6" />,
          color: "bg-primary hover:bg-primary/90 text-white",
          disabled: false
        };
      default:
        return {
          label: "Click to Ask Me Anything",
          icon: <Mic className="w-6 h-6" />,
          color: "bg-primary hover:bg-primary/90 text-white",
          disabled: false
        };
    }
  };

  const buttonProps = getMainButtonProps();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center space-y-8">
        
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-gray-800">
            🤖 Your AI Assistant
          </h1>
          <p className="text-lg text-gray-600">
            Hello! I'm your AI assistant. Click the button below, ask your question, and then press 'Stop' for me to help.
          </p>
        </div>

        {/* Main Controls */}
        <div className="space-y-6">
          
          {/* Primary Action Button */}
          <Button
            onClick={state === 'idle' || state === 'error' ? startRecording : undefined}
            disabled={buttonProps.disabled}
            size="lg"
            className={`w-full max-w-md mx-auto h-16 text-lg font-medium rounded-xl shadow-lg transition-all ${buttonProps.color}`}
          >
            <div className="flex items-center justify-center space-x-3">
              {buttonProps.icon}
              <span>{buttonProps.label}</span>
            </div>
          </Button>

          {/* Stop Recording Button (only visible when listening) */}
          {state === 'listening' && (
            <Button
              onClick={stopRecording}
              size="lg"
              variant="outline"
              className="w-full max-w-sm mx-auto h-12 text-base font-medium border-2 border-red-500 text-red-600 hover:bg-red-50"
            >
              <Square className="w-5 h-5 mr-2" />
              Stop Recording
            </Button>
          )}

          {/* Stop Audio Button (only visible when speaking) */}
          {state === 'speaking' && (
            <Button
              onClick={stopAudio}
              size="lg"
              variant="outline"
              className="w-full max-w-sm mx-auto h-12 text-base font-medium border-2 border-blue-500 text-blue-600 hover:bg-blue-50"
            >
              <MicOff className="w-5 h-5 mr-2" />
              Stop Audio
            </Button>
          )}
        </div>

        {/* Status Messages */}
        {state === 'listening' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">
              🎤 I'm listening... Go ahead and speak your question.
            </p>
          </div>
        )}

        {state === 'processing' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin text-yellow-600" />
              <p className="text-yellow-800 font-medium">
                Great! Processing your question...
              </p>
            </div>
          </div>
        )}

        {state === 'speaking' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-center space-x-2">
              <Volume2 className="w-5 h-5 animate-pulse text-blue-600" />
              <p className="text-blue-800 font-medium">
                🔊 Audio Playing...
              </p>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">
              ❌ Something went wrong. Please try again.
            </p>
          </div>
        )}

        {/* Response Display */}
        {response && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm text-left">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
              <Volume2 className="w-5 h-5 mr-2 text-blue-600" />
              My Response:
            </h3>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {response}
            </p>
          </div>
        )}

        {/* Reset Button */}
        {(response || state === 'error') && state === 'idle' && (
          <Button
            onClick={resetState}
            variant="outline"
            className="w-full max-w-xs mx-auto"
          >
            Start Fresh
          </Button>
        )}

      </div>
    </div>
  );
};

export default SimpleVoiceAssistant;