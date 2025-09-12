import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import MicrophonePermission from '@/components/MicrophonePermission';

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
  private stream: MediaStream | null = null;
  private isConnected = false;
  private audioQueue: Uint8Array[] = [];
  private isPlayingAudio = false;

  constructor(
    private onMessage: (message: any) => void,
    private onConnectionChange: (status: string) => void
  ) {}

  async connect(stream: MediaStream) {
    try {
      this.onConnectionChange('connecting');
      this.stream = stream;

      // Initialize WebSocket connection through Supabase edge function
      const wsUrl = 'wss://bmrifufykczudfxomenr.functions.supabase.co/realtime-chat';
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected to Supabase proxy');
        this.isConnected = true;
        this.onConnectionChange('connected');
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


  private async setupAudioProcessing() {
    if (!this.stream) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000
      });
      
      // Create audio processing nodes
      const source = this.audioContext.createMediaStreamSource(this.stream);
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (event) => {
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
          const inputData = event.inputBuffer.getChannelData(0);
          this.sendAudioData(new Float32Array(inputData));
        }
      };
      
      source.connect(processor);
      processor.connect(this.audioContext.destination);
      
      this.onMessage({ type: 'session.created' });
    } catch (error) {
      console.error('Error setting up audio processing:', error);
      this.onConnectionChange('error');
    }
  }

  private sendAudioData(audioData: Float32Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      // Convert Float32Array to base64 PCM16
      const int16Array = new Int16Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        const s = Math.max(-1, Math.min(1, audioData[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      const uint8Array = new Uint8Array(int16Array.buffer);
      let binary = '';
      const chunkSize = 0x8000;
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64Audio = btoa(binary);
      
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
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      this.audioQueue.push(bytes);
      
      if (!this.isPlayingAudio) {
        this.playNextAudioChunk();
      }
    } catch (error) {
      console.error('Error processing audio delta:', error);
    }
  }

  private async playNextAudioChunk() {
    if (this.audioQueue.length === 0) {
      this.isPlayingAudio = false;
      return;
    }

    this.isPlayingAudio = true;
    const audioData = this.audioQueue.shift()!;

    try {
      // Convert PCM16 to WAV format for AudioContext
      const wavData = this.createWavFromPCM(audioData);
      const audioBuffer = await this.audioContext!.decodeAudioData(wavData.buffer);
      
      const source = this.audioContext!.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext!.destination);
      
      source.onended = () => this.playNextAudioChunk();
      source.start();
    } catch (error) {
      console.error('Error playing audio chunk:', error);
      this.playNextAudioChunk(); // Continue with next chunk
    }
  }

  private createWavFromPCM(pcmData: Uint8Array): Uint8Array {
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;
    
    // Create WAV header
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, pcmData.length, true);

    // Combine header and data
    const wavArray = new Uint8Array(wavHeader.byteLength + pcmData.length);
    wavArray.set(new Uint8Array(wavHeader), 0);
    wavArray.set(pcmData, wavHeader.byteLength);
    
    return wavArray;
  }

  disconnect() {
    console.log('Disconnecting RealtimeChat...');
    
    // Clear audio queue
    this.audioQueue = [];
    this.isPlayingAudio = false;
    
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    if (this.ws) {
      this.ws.close();
    }
    
    this.isConnected = false;
  }
}


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