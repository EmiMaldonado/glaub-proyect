import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface RealtimeChatProps {
  onTranscriptionUpdate: (text: string, isUser: boolean) => void;
  onSpeakingChange: (isSpeaking: boolean) => void;
  conversationId?: string;
  userId?: string;
}

interface TranscriptItem {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

// OpenAI Realtime API WebSocket Client
class RealtimeChat {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isConnected = false;

  constructor(
    private onMessage: (message: any) => void,
    private onConnectionChange: (status: string) => void
  ) {}

  async connect(stream: MediaStream) {
    try {
      this.onConnectionChange('connecting');
      this.stream = stream;

      // Initialize WebSocket connection to OpenAI
      const wsUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.onConnectionChange('connected');
        this.initializeSession();
        this.setupAudioProcessing();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.onConnectionChange('disconnected');
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onConnectionChange('error');
      };

    } catch (error) {
      console.error('Error connecting to OpenAI Realtime API:', error);
      this.onConnectionChange('error');
      throw error;
    }
  }

  private initializeSession() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Configure session
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: 'You are a helpful AI assistant. Respond conversationally.',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        }
      }
    };

    this.ws.send(JSON.stringify(sessionConfig));
  }

  private async setupAudioProcessing() {
    if (!this.stream) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Setup MediaRecorder for audio capture
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.isConnected) {
          this.sendAudioData(event.data);
        }
      };

      this.mediaRecorder.start(100); // Send data every 100ms
      
      this.onMessage({ type: 'session.created' });
    } catch (error) {
      console.error('Error setting up audio processing:', error);
      this.onConnectionChange('error');
    }
  }

  private async sendAudioData(audioBlob: Blob) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      const message = {
        type: 'input_audio_buffer.append',
        audio: base64Audio
      };

      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending audio data:', error);
    }
  }

  private handleMessage(message: any) {
    console.log('Received message:', message.type);
    
    switch (message.type) {
      case 'session.created':
      case 'session.updated':
        console.log('Session initialized');
        break;
        
      case 'input_audio_buffer.speech_started':
        this.onMessage({ type: 'input_audio_buffer.speech_started' });
        break;
        
      case 'input_audio_buffer.speech_stopped':
        this.onMessage({ type: 'input_audio_buffer.speech_stopped' });
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        this.onMessage({
          type: 'conversation.item.input_audio_transcription.completed',
          transcript: message.transcript
        });
        break;
        
      case 'response.audio.delta':
        this.onMessage({ type: 'response.audio.delta' });
        if (message.delta) {
          this.playAudioDelta(message.delta);
        }
        break;
        
      case 'response.audio.done':
        this.onMessage({ type: 'response.audio.done' });
        break;
        
      case 'response.audio_transcript.delta':
        this.onMessage({
          type: 'response.audio_transcript.delta',
          delta: message.delta
        });
        break;
        
      case 'response.audio_transcript.done':
        this.onMessage({ type: 'response.audio_transcript.done' });
        break;
        
      case 'error':
        console.error('OpenAI API error:', message);
        this.onMessage({ type: 'error', error: message.error?.message || 'Unknown error' });
        break;
    }
  }

  private async playAudioDelta(base64Audio: string) {
    if (!this.audioContext) return;

    try {
      const audioData = atob(base64Audio);
      const audioBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(audioBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }

      const decodedBuffer = await this.audioContext.decodeAudioData(audioBuffer);
      const source = this.audioContext.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(this.audioContext.destination);
      source.start();
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  disconnect() {
    console.log('Disconnecting RealtimeChat...');
    
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    
    if (this.ws) {
      this.ws.close();
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    this.isConnected = false;
  }
}

// Microphone Permission Component
const MicrophonePermission: React.FC<{
  onPermissionGranted: (stream: MediaStream) => void;
  onPermissionDenied: () => void;
}> = ({ onPermissionGranted, onPermissionDenied }) => {
  const [isRequesting, setIsRequesting] = useState(false);

  const requestPermission = async () => {
    setIsRequesting(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      
      console.log('Microphone permission granted:', {
        streamId: stream.id,
        active: stream.active,
        audioTracks: stream.getAudioTracks().length
      });
      
      onPermissionGranted(stream);
    } catch (error) {
      console.error('Microphone permission denied:', error);
      onPermissionDenied();
    } finally {
      setIsRequesting(false);
    }
  };

  useEffect(() => {
    // Auto-request permission when component mounts
    requestPermission();
  }, []);

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="text-center">
        <Mic className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Microphone Access Required
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Please allow microphone access to start voice conversation
        </p>
      </div>
      
      <Button 
        onClick={requestPermission}
        disabled={isRequesting}
        className="flex items-center space-x-2"
      >
        {isRequesting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Requesting Permission...</span>
          </>
        ) : (
          <>
            <Mic className="w-4 h-4" />
            <span>Allow Microphone</span>
          </>
        )}
      </Button>
    </div>
  );
};

// Main Component
const RealtimeChatInterface: React.FC<RealtimeChatProps> = ({
  onTranscriptionUpdate,
  onSpeakingChange,
  conversationId,
  userId
}) => {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'retrying' | 'disconnected'>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [currentUserTranscript, setCurrentUserTranscript] = useState('');
  const [currentAITranscript, setCurrentAITranscript] = useState('');
  const [microphoneGranted, setMicrophoneGranted] = useState(false);
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(null);

  const realtimeChatRef = useRef<RealtimeChat | null>(null);
  const userTranscriptRef = useRef('');
  const aiTranscriptRef = useRef('');

  const handleMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'session.created':
        setIsRecording(true);
        toast({
          title: "🎙️ Conversation Started",
          description: "You can start speaking now",
        });
        break;

      case 'input_audio_buffer.speech_started':
        setCurrentUserTranscript('');
        userTranscriptRef.current = '';
        break;

      case 'input_audio_buffer.speech_stopped':
        if (userTranscriptRef.current.trim()) {
          const transcript: TranscriptItem = {
            id: Date.now().toString(),
            text: userTranscriptRef.current.trim(),
            isUser: true,
            timestamp: new Date()
          };
          setTranscripts(prev => [...prev, transcript]);
          onTranscriptionUpdate(userTranscriptRef.current.trim(), true);
          setCurrentUserTranscript('');
          userTranscriptRef.current = '';
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (message.transcript) {
          userTranscriptRef.current = message.transcript;
          setCurrentUserTranscript(message.transcript);
        }
        break;

      case 'response.audio.delta':
        setIsAISpeaking(true);
        onSpeakingChange(true);
        break;

      case 'response.audio.done':
        setIsAISpeaking(false);
        onSpeakingChange(false);
        if (aiTranscriptRef.current.trim()) {
          const transcript: TranscriptItem = {
            id: Date.now().toString() + '-ai',
            text: aiTranscriptRef.current.trim(),
            isUser: false,
            timestamp: new Date()
          };
          setTranscripts(prev => [...prev, transcript]);
          onTranscriptionUpdate(aiTranscriptRef.current.trim(), false);
          setCurrentAITranscript('');
          aiTranscriptRef.current = '';
        }
        break;

      case 'response.audio_transcript.delta':
        if (message.delta) {
          aiTranscriptRef.current += message.delta;
          setCurrentAITranscript(aiTranscriptRef.current);
        }
        break;

      case 'error':
        toast({
          title: "Connection Error",
          description: message.error || "Voice connection error",
          variant: "destructive",
        });
        break;
    }
  }, [onTranscriptionUpdate, onSpeakingChange]);

  const handleConnectionChange = useCallback((status: 'idle' | 'connecting' | 'connected' | 'error' | 'retrying' | 'disconnected') => {
    setConnectionStatus(status);

    switch (status) {
      case 'connecting':
        toast({
          title: "Connecting...",
          description: "Establishing voice connection",
        });
        break;
      case 'connected':
        toast({
          title: "✅ Connected",
          description: "Voice connection established",
        });
        break;
      case 'error':
        setIsRecording(false);
        setIsAISpeaking(false);
        toast({
          title: "Connection Error",
          description: "Unable to establish voice connection",
          variant: "destructive",
        });
        break;
    }
  }, []);

  const handleMicrophoneGranted = useCallback(async (stream: MediaStream) => {
    console.log('Microphone permission granted, starting voice connection...');
    setMicrophoneStream(stream);
    setMicrophoneGranted(true);
    
    try {
      realtimeChatRef.current = new RealtimeChat(handleMessage, handleConnectionChange);
      await realtimeChatRef.current.connect(stream);
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Connection Error",
        description: "Failed to start voice conversation",
        variant: "destructive",
      });
    }
  }, [handleMessage, handleConnectionChange]);

  const handleMicrophoneDenied = useCallback(() => {
    setConnectionStatus('error');
    toast({
      title: "Microphone Required",
      description: "Please allow microphone access to use voice conversations",
      variant: "destructive",
    });
  }, []);

  const endConversation = () => {
    if (realtimeChatRef.current) {
      realtimeChatRef.current.disconnect();
      realtimeChatRef.current = null;
    }
    
    if (microphoneStream) {
      microphoneStream.getTracks().forEach(track => track.stop());
      setMicrophoneStream(null);
    }
    
    setTranscripts([]);
    setCurrentUserTranscript('');
    setCurrentAITranscript('');
    setMicrophoneGranted(false);
    userTranscriptRef.current = '';
    aiTranscriptRef.current = '';
    setConnectionStatus('idle');
  };

  useEffect(() => {
    return () => {
      if (realtimeChatRef.current) {
        realtimeChatRef.current.disconnect();
      }
      if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [microphoneStream]);

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-500';
      case 'connecting': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Connection Error';
      case 'idle': return 'Ready to Connect';
      default: return 'Disconnected';
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      {!microphoneGranted ? (
        <MicrophonePermission
          onPermissionGranted={handleMicrophoneGranted}
          onPermissionDenied={handleMicrophoneDenied}
        />
      ) : (
        <>
          {/* Connection Status */}
          <div className={`flex items-center space-x-2 ${getConnectionStatusColor()}`}>
            <div className="w-2 h-2 rounded-full bg-current animate-pulse"></div>
            <span className="text-sm font-medium">{getConnectionStatusText()}</span>
          </div>

          {/* Recording Button */}
          <div className="relative">
            <Button
              onClick={endConversation}
              className={`w-24 h-24 rounded-full shadow-lg transition-all ${
                isRecording && !isAISpeaking
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                  : 'bg-gray-500 hover:bg-gray-600'
              }`}
            >
              {isAISpeaking ? (
                <Volume2 className="w-8 h-8 text-white animate-pulse" />
              ) : isRecording ? (
                <Mic className="w-8 h-8 text-white" />
              ) : (
                <MicOff className="w-8 h-8 text-white" />
              )}
            </Button>

            {/* Waveform Animation */}
            {isRecording && !isAISpeaking && (
              <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-red-400 animate-ping"></div>
            )}

            {/* AI Speaking Animation */}
            {isAISpeaking && (
              <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-blue-400 animate-pulse"></div>
            )}
          </div>

          {/* Status Text */}
          <div className="text-center">
            {isAISpeaking ? (
              <p className="text-blue-600 font-medium animate-pulse">AI Speaking...</p>
            ) : isRecording ? (
              <p className="text-red-600 font-medium">Listening...</p>
            ) : (
              <p className="text-gray-600">Press to end conversation</p>
            )}
          </div>
        </>
      )}

      {/* Live Transcriptions */}
      {(currentUserTranscript || currentAITranscript) && (
        <div className="w-full max-w-md bg-muted/50 rounded-lg p-4">
          {currentUserTranscript && (
            <div className="mb-2">
              <span className="text-xs text-muted-foreground">You:</span>
              <p className="text-sm text-primary">{currentUserTranscript}</p>
            </div>
          )}
          {currentAITranscript && (
            <div>
              <span className="text-xs text-muted-foreground">AI:</span>
              <p className="text-sm text-blue-600">{currentAITranscript}</p>
            </div>
          )}
        </div>
      )}

      {/* Transcript History */}
      {transcripts.length > 0 && (
        <div className="w-full max-w-md space-y-2 max-h-40 overflow-y-auto">
          {transcripts.map((transcript) => (
            <div
              key={transcript.id}
              className={`p-3 rounded-lg ${
                transcript.isUser ? 'bg-primary/10 text-primary' : 'bg-blue-50 text-blue-700'
              }`}
            >
              <p className="text-sm">{transcript.text}</p>
              <span className="text-xs text-muted-foreground">
                {transcript.timestamp.toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RealtimeChatInterface;