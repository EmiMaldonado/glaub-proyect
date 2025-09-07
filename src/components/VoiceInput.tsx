import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Square, TestTube } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type RecordingState = 'ready' | 'listening' | 'processing';

interface VoiceInputProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  showTestButton?: boolean;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscription, disabled, showTestButton = false }) => {
  const [recordingState, setRecordingState] = useState<RecordingState>('ready');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Check microphone permissions on component mount
    checkMicrophonePermissions();
    
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const checkMicrophonePermissions = async () => {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setHasPermission(permissionStatus.state === 'granted');
      console.log('🎤 Microphone permission status:', permissionStatus.state);
      
      permissionStatus.onchange = () => {
        setHasPermission(permissionStatus.state === 'granted');
        console.log('🎤 Microphone permission changed:', permissionStatus.state);
      };
    } catch (error) {
      console.log('🎤 Permission API not supported, will check during recording');
      setHasPermission(null);
    }
  };

  const playNotificationSound = (frequency: number = 800, duration: number = 200) => {
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  };

  const createAudioAnalyser = (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      // Monitor audio levels
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const monitorAudioLevel = () => {
        if (recordingState === 'listening') {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          setAudioLevel(average / 255);
          requestAnimationFrame(monitorAudioLevel);
        }
      };
      monitorAudioLevel();
    } catch (error) {
      console.warn('Could not create audio analyser:', error);
    }
  };

  const startRecording = async () => {
    console.log('🎙️ Recording started - requesting microphone access');
    
    try {
      setRecordingState('listening');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('🎤 Microphone access granted successfully');
      setHasPermission(true);
      
      // Play notification sound to indicate recording started
      playNotificationSound(800, 200);
      
      // Create audio analyser for visual feedback
      createAudioAnalyser(stream);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log('🎵 Audio data chunk received:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        console.log('🎵 Audio data:', {
          size: audioBlob.size,
          sizeKB: Math.round(audioBlob.size / 1024),
          type: audioBlob.type,
          chunks: chunksRef.current.length
        });
        
        setAudioLevel(0);
        await processAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100); // Collect data every 100ms
      
      toast({
        title: "🎙️ Listening...",
        description: "Speak now. Press the button again to stop recording.",
      });
      
    } catch (error) {
      console.error('❌ Error accessing microphone:', error);
      setRecordingState('ready');
      setHasPermission(false);
      
      let errorMessage = "No se pudo acceder al micrófono.";
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = "Acceso al micrófono denegado. Por favor, permite el acceso en la configuración del navegador.";
        } else if (error.name === 'NotFoundError') {
          errorMessage = "No se encontró ningún micrófono. Verifica que tu dispositivo tenga un micrófono conectado.";
        } else if (error.name === 'NotReadableError') {
          errorMessage = "El micrófono está siendo usado por otra aplicación.";
        }
      }
      
      toast({
        title: "❌ Error de micrófono",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    console.log('🛑 Recording stopped');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setRecordingState('processing');
      
      toast({
        title: "⏳ Processing...",
        description: "Converting your voice to text...",
      });
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      console.log('🔄 Processing audio for transcription');
      
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64Audio = btoa(String.fromCharCode(...uint8Array));

      console.log('📤 Sending audio for transcription:', { 
        sizeKB: Math.round(audioBlob.size / 1024),
        sizeBytes: audioBlob.size,
        type: audioBlob.type,
        base64Length: base64Audio.length
      });

      // Send to speech-to-text function
      const response = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { text } = response.data;
      
      if (text && text.trim()) {
        console.log('✅ Transcription received:', {
          text: text.trim(),
          length: text.trim().length
        });
        
        onTranscription(text.trim());
        
        toast({
          title: "✅ Voice transcribed successfully",
          description: `"${text.trim().substring(0, 50)}${text.trim().length > 50 ? '...' : ''}"`,
        });
      } else {
        console.log('⚠️ No audio detected in transcription');
        toast({
          title: "No audio detected",
          description: "Try speaking louder or getting closer to the microphone",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Error processing audio:', error);
      toast({
        title: "Transcription error", 
        description: error instanceof Error ? error.message : "Could not process audio. Try again.",
        variant: "destructive",
      });
    } finally {
      setRecordingState('ready');
    }
  };

  const testVoiceFlow = () => {
    console.log('🧪 Testing voice flow with simulated data');
    
    // Simulate processing state
    setRecordingState('processing');
    
    toast({
      title: "🧪 Testing voice flow",
      description: "Simulating audio transcription...",
    });

    // Simulate API delay and response
    setTimeout(() => {
      const testTexts = [
        "Hola, esto es una prueba de transcripción de voz.",
        "El sistema está funcionando correctamente.",
        "La grabación de audio se está procesando bien.",
        "Esta es una simulación para verificar el flujo completo."
      ];
      
      const randomText = testTexts[Math.floor(Math.random() * testTexts.length)];
      
      console.log('🧪 Test transcription completed:', randomText);
      onTranscription(randomText);
      setRecordingState('ready');
      
      toast({
        title: "✅ Test completed",
        description: `Simulated text: "${randomText.substring(0, 30)}..."`,
      });
    }, 2000);
  };

  const toggleRecording = () => {
    if (recordingState === 'listening') {
      stopRecording();
    } else if (recordingState === 'ready') {
      startRecording();
    }
  };

  const getRecordingButton = () => {
    switch (recordingState) {
      case 'listening':
        return {
          variant: 'destructive' as const,
          icon: <Square className="h-4 w-4" />,
          className: 'animate-pulse border-red-500 shadow-lg shadow-red-500/25'
        };
      case 'processing':
        return {
          variant: 'secondary' as const,
          icon: <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />,
          className: ''
        };
      default:
        return {
          variant: hasPermission === false ? 'destructive' as const : 'outline' as const,
          icon: hasPermission === false ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />,
          className: hasPermission === false ? 'border-red-500' : ''
        };
    }
  };

  const buttonConfig = getRecordingButton();

  const getStatusText = () => {
    switch (recordingState) {
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Processing...';
      default:
        return 'Ready';
    }
  };

  const getStatusColor = () => {
    switch (recordingState) {
      case 'listening':
        return 'destructive';
      case 'processing':
        return 'secondary';
      default:
        return hasPermission === false ? 'destructive' : 'secondary';
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Main Recording Button */}
      <div className="relative">
        <Button
          type="button"
          onClick={toggleRecording}
          disabled={disabled || recordingState === 'processing'}
          variant={buttonConfig.variant}
          size="icon"
          className={`shrink-0 ${buttonConfig.className}`}
        >
          {buttonConfig.icon}
        </Button>
        
        {/* Audio Level Indicator */}
        {recordingState === 'listening' && audioLevel > 0 && (
          <div 
            className="absolute -inset-1 border-2 border-red-500 rounded-full opacity-50"
            style={{ 
              transform: `scale(${1 + audioLevel * 0.5})`,
              transition: 'transform 0.1s ease-out'
            }}
          />
        )}
      </div>

      {/* Status Badge */}
      <Badge variant={getStatusColor() as any} className="text-xs">
        {getStatusText()}
      </Badge>

      {/* Test Button */}
      {showTestButton && (
        <Button
          type="button"
          onClick={testVoiceFlow}
          disabled={disabled || recordingState !== 'ready'}
          variant="ghost"
          size="sm"
          className="gap-1 text-xs"
        >
          <TestTube className="h-3 w-3" />
          Test
        </Button>
      )}
    </div>
  );
};

export default VoiceInput;