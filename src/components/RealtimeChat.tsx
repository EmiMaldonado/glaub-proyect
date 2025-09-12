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
  private apiKey: string | null = null;

  constructor(
    private onMessage: (message: any) => void,
    private onConnectionChange: (status: string) => void
  ) {}

  async connect(stream: MediaStream) {
    try {
      this.onConnectionChange('connecting');
      this.stream = stream;

      // Get OpenAI API key from edge function
      await this.getApiKey();
      
      // Connect directly to OpenAI Realtime API
      await this.connectToOpenAI();
      
    } catch (error) {
      console.error('Error in connect method:', error);
      this.onConnectionChange('error');
    }
  }

  private async getApiKey() {
    try {
      console.log('🔑 Retrieving OpenAI API key from edge function...');
      
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtcmlmdWZ5a2N6dWRmeG9tZW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNzkzNTYsImV4cCI6MjA3Mjc1NTM1Nn0.TE9BEft4v-f_vIQkKQ39BHZzcvbwg93OXBXX6QaSUbY';
      
      // Get API key from Supabase Edge Function
      const response = await fetch('https://bmrifufykczudfxomenr.supabase.co/functions/v1/realtime-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          action: 'get_api_key'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to get API key: ${response.status}`);
      }

      const data = await response.json();
      this.apiKey = data.apiKey;
      
      if (!this.apiKey) {
        throw new Error('OpenAI API key not available in edge function response');
      }
      
      console.log('✅ OpenAI API key retrieved successfully');
      
    } catch (error) {
      console.error('❌ Failed to get API key from edge function:', error);
      // For now, we'll throw an error - the user needs to configure the API key in the edge function
      throw new Error(`API key retrieval failed: ${error.message}. Please ensure OPENAI_API_KEY is configured in Supabase Edge Functions.`);
    }
  }

  private async connectToOpenAI() {
    try {
      console.log('🔗 Connecting directly to OpenAI Realtime API...');
      
      // Connect to OpenAI WebSocket endpoint
      const wsUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
      
      console.log('📡 WebSocket URL:', wsUrl);
      console.log('🔐 Using OpenAI authentication protocol');

      return new Promise<void>((resolve, reject) => {
        // Create WebSocket with OpenAI authentication protocol
        this.ws = new WebSocket(wsUrl, ['realtime', `openai-insecure-api-key.${this.apiKey}`]);
        
        const connectionTimeout = setTimeout(() => {
          console.error('❌ OpenAI WebSocket connection timeout after 15 seconds');
          this.ws?.close();
          reject(new Error('OpenAI connection timeout'));
        }, 15000);

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('✅ Connected to OpenAI Realtime API successfully!');
          this.isConnected = true;
          this.onConnectionChange('connected');
          this.setupAudioProcessing();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('📨 OpenAI message type:', message.type);
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Error parsing OpenAI message:', error);
          }
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log('🔌 OpenAI WebSocket closed:', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          });
          this.isConnected = false;
          this.onConnectionChange('disconnected');
        };

        this.ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('❌ OpenAI WebSocket error:', error);
          this.onConnectionChange('error');
          reject(new Error('OpenAI WebSocket connection failed - check API key and network connection'));
        };
      });
    } catch (error) {
      console.error('❌ Error connecting to OpenAI:', error);
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
      
      // Send initial session configuration
      this.sendSessionUpdate();
      
    } catch (error) {
      console.error('Error setting up audio processing:', error);
      this.onConnectionChange('error');
    }
  }

  private sendSessionUpdate() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: 'You are a helpful therapeutic assistant. Respond in a warm, empathetic, and supportive manner. Keep responses conversational and appropriate for voice interaction.',
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
          silence_duration_ms: 1000
        },
        temperature: 0.8,
        max_response_output_tokens: 4096
      }
    };

    console.log('📤 Sending session configuration to OpenAI');
    this.ws.send(JSON.stringify(sessionConfig));
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
    console.log('Processing OpenAI message:', message.type);
    
    switch (message.type) {
      case 'session.created':
        console.log('✅ OpenAI session created');
        this.onMessage({ type: 'session.created' });
        break;
      case 'session.updated':
        console.log('✅ OpenAI session updated');
        break;
        
      case 'input_audio_buffer.speech_started':
        console.log('🎤 User started speaking');
        this.onMessage({ type: 'input_audio_buffer.speech_started' });
        break;
        
      case 'input_audio_buffer.speech_stopped':
        console.log('🎤 User stopped speaking');
        this.onMessage({ type: 'input_audio_buffer.speech_stopped' });
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        console.log('📝 User transcription completed:', message.transcript);
        this.onMessage({
          type: 'conversation.item.input_audio_transcription.completed',
          transcript: message.transcript
        });
        break;
        
      case 'response.audio.delta':
        console.log('🔊 AI audio chunk received');
        this.onMessage({ type: 'response.audio.delta' });
        if (message.delta) {
          this.playAudioDelta(message.delta);
        }
        break;
        
      case 'response.audio.done':
        console.log('🔊 AI audio completed');
        this.onMessage({ type: 'response.audio.done' });
        break;
        
      case 'response.audio_transcript.delta':
        console.log('📝 AI transcript chunk:', message.delta);
        this.onMessage({
          type: 'response.audio_transcript.delta',
          delta: message.delta
        });
        break;
        
      case 'response.audio_transcript.done':
        console.log('📝 AI transcript completed');
        this.onMessage({ type: 'response.audio_transcript.done' });
        break;
        
      case 'error':
        console.error('❌ OpenAI API error:', message);
        this.onMessage({ type: 'error', error: message.error?.message || 'Unknown error' });
        break;

      default:
        console.log('📨 Unhandled message type:', message.type);
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
    console.log('🔌 Disconnecting from OpenAI Realtime API...');
    
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
          title: "🎙️ Voice Connection Active",
          description: "Connected to OpenAI Realtime API - you can start speaking",
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
          description: message.error || "OpenAI Realtime API connection error",
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
          title: "Connecting to OpenAI...",
          description: "Establishing direct connection to OpenAI Realtime API",
        });
        break;
      case 'connected':
        toast({
          title: "✅ Connected to OpenAI",
          description: "Direct connection to OpenAI Realtime API established",
        });
        break;
      case 'error':
        setIsRecording(false);
        setIsAISpeaking(false);
        toast({
          title: "Connection Failed", 
          description: "Failed to connect to OpenAI Realtime API. Please check your API key configuration.",
          variant: "destructive",
        });
        break;
      case 'disconnected':
        setIsRecording(false);
        setIsAISpeaking(false);
        break;
    }
  }, []);

  const handleMicrophoneGranted = useCallback(async (stream: MediaStream) => {
    console.log('🎤 Microphone permission granted, connecting to OpenAI...');
    setMicrophoneStream(stream);
    setMicrophoneGranted(true);
    
    try {
      realtimeChatRef.current = new RealtimeChat(handleMessage, handleConnectionChange);
      await realtimeChatRef.current.connect(stream);
    } catch (error) {
      console.error('Error starting OpenAI connection:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to OpenAI Realtime API. Please check console for details.",
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
      case 'connected': return 'Connected to OpenAI';
      case 'connecting': return 'Connecting to OpenAI...';
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