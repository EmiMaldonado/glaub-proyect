import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import TranscriptionProcessor from './TranscriptionProcessor';

interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onTranscriptionComplete?: (transcription: string) => void;
}

type RecordingState = 'idle' | 'recording' | 'stopped' | 'processing';

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  onTranscriptionComplete
}) => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [timer, setTimer] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [currentTranscription, setCurrentTranscription] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const timerIntervalRef = useRef<NodeJS.Timeout>();

  // Real-time audio level visualization
  const visualizeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average audio level
    const average = dataArray.reduce((a, b) => a + b) / bufferLength;
    setAudioLevel(average / 255); // Normalize to 0-1

    if (recordingState === 'recording') {
      animationFrameRef.current = requestAnimationFrame(visualizeAudio);
    }
  }, [recordingState]);

  // Timer management
  useEffect(() => {
    if (recordingState === 'recording') {
      timerIntervalRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [recordingState]);

  // Request microphone permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setPermissionGranted(true);
      } catch (error) {
        console.error('Microphone permission denied:', error);
        setPermissionGranted(false);
        toast({
          title: "Permisos requeridos",
          description: "Microphone access is needed to record audio",
          variant: "destructive",
        });
      }
    };

    checkPermissions();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    if (!permissionGranted) {
      toast({
        title: "Error",
        description: "Cannot access microphone",
        variant: "destructive",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;
      chunksRef.current = [];
      setTimer(0);

      // Set up audio context for visualization
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setRecordingState('processing');
        onRecordingComplete?.(audioBlob);
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setRecordingState('recording');
      onRecordingStart?.();
      visualizeAudio();

      toast({
        title: "🎙️ Grabación iniciada",
        description: "Speak clearly towards the microphone",
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Error",
        description: "Could not start recording",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
      onRecordingStop?.();
    }

    // Clean up resources
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    setAudioLevel(0);

    toast({
      title: "⏹️ Grabación detenida",
      description: "Procesando audio...",
    });
  };

  const handleRecordingComplete = (audioBlob: Blob) => {
    setAudioBlob(audioBlob);
    onRecordingComplete?.(audioBlob);
  };

  const handleTranscriptionComplete = (transcription: string) => {
    setCurrentTranscription(transcription);
    onTranscriptionComplete?.(transcription);
    setRecordingState('stopped');
  };

  const handleInsightsGenerated = (insights: any) => {
    console.log('Insights generated:', insights);
    // Here you could store insights in state or send to backend
  };

  const handleToggleRecording = () => {
    if (recordingState === 'idle') {
      startRecording();
    } else if (recordingState === 'recording') {
      stopRecording();
    } else if (recordingState === 'stopped') {
      // Reset to idle state
      setRecordingState('idle');
      setTimer(0);
      setAudioBlob(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate waveform visualization
  const generateWaveform = () => {
    const bars = [];
    const numBars = 20;
    
    for (let i = 0; i < numBars; i++) {
      const height = recordingState === 'recording' 
        ? Math.random() * audioLevel * 40 + 4 
        : 4;
      
      bars.push(
        <div
          key={i}
          className="bg-primary transition-all duration-100"
          style={{
            width: '3px',
            height: `${height}px`,
            marginRight: '2px',
            opacity: recordingState === 'recording' ? 0.8 : 0.3
          }}
        />
      );
    }
    
    return bars;
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-6 p-4 max-w-6xl mx-auto">
      {/* Main Recording Button */}
      <div className="relative">
        {/* Pulsing background for recording state */}
        {recordingState === 'recording' && (
          <div 
            className="absolute inset-0 bg-primary rounded-full animate-pulse"
            style={{
              transform: `scale(${1.2 + audioLevel * 0.3})`,
              opacity: 0.3
            }}
          />
        )}
        
        <Button
          onClick={handleToggleRecording}
          disabled={permissionGranted === false}
          className={`relative z-10 w-32 h-32 rounded-full transition-all duration-300 shadow-primary ${
            recordingState === 'idle'
              ? 'bg-primary hover:bg-primary-600 text-primary-foreground'
              : recordingState === 'recording'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary hover:bg-secondary-hover text-secondary-foreground'
          }`}
          style={{
            transform: recordingState === 'recording' 
              ? `scale(${1.05 + audioLevel * 0.1})` 
              : 'scale(1)'
          }}
        >
          {recordingState === 'recording' ? (
            <Square className="w-8 h-8 text-error" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </Button>
      </div>

      {/* Status Text */}
      <div className="text-center">
        {recordingState === 'idle' && (
          <p className="text-lg font-medium text-foreground">Tap to record</p>
        )}
        {recordingState === 'recording' && (
          <p className="text-lg font-medium text-primary animate-pulse">Recording...</p>
        )}
        {recordingState === 'processing' && (
          <p className="text-lg font-medium text-warning">Processing audio...</p>
        )}
        {recordingState === 'stopped' && (
          <p className="text-lg font-medium text-success">Ready for new recording</p>
        )}
      </div>

      {/* Timer Display */}
      {(recordingState === 'recording' || recordingState === 'stopped' || recordingState === 'processing') && (
        <div className="text-2xl font-mono font-bold text-primary">
          {formatTime(timer)}
        </div>
      )}

      {/* Waveform Visualization */}
      {recordingState === 'recording' && (
        <div className="flex items-center justify-center space-x-1 h-12">
          {generateWaveform()}
        </div>
      )}

      {/* Transcription and Insights Processing */}
      {(recordingState === 'processing' || audioBlob) && (
        <div className="w-full max-w-4xl">
          <TranscriptionProcessor
            audioBlob={audioBlob}
            onTranscriptionComplete={handleTranscriptionComplete}
            onInsightsGenerated={handleInsightsGenerated}
          />
        </div>
      )}

      {/* Permission Error State */}
      {permissionGranted === false && (
        <div className="text-center text-error max-w-sm">
          <p className="text-sm">
            Microphone access is needed to use this feature. 
            Por favor, permite el acceso y recarga la página.
          </p>
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;