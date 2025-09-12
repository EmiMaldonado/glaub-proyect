import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, ArrowLeft, Check, Star } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import MicrophonePermission from '@/components/MicrophonePermission';

interface VoiceInterfaceProps {
  onTranscriptionUpdate: (text: string, isUser: boolean) => void;
  onSpeakingChange: (isSpeaking: boolean) => void;
  conversationId?: string;
  userId?: string;
  onEndSession: () => void;
  onBack: () => void;
  progressPercentage: number;
  formattedTime: string;
  formattedTimeRemaining: string;
  currentAIResponse?: string;
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
  private audioLevelCallback: ((level: number) => void) | null = null;

  constructor(
    private onMessage: (message: any) => void,
    private onConnectionChange: (status: string) => void,
    private onAudioLevel: (level: number) => void
  ) {
    this.audioLevelCallback = onAudioLevel;
  }

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
      throw new Error(`API key retrieval failed: ${error.message}. Please ensure OPENAI_API_KEY is configured in Supabase Edge Functions.`);
    }
  }

  private async connectToOpenAI() {
    try {
      console.log('🔗 Connecting directly to OpenAI Realtime API...');
      
      const wsUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
      
      console.log('📡 WebSocket URL:', wsUrl);
      console.log('🔐 Using OpenAI authentication protocol');

      return new Promise<void>((resolve, reject) => {
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
      
      const source = this.audioContext.createMediaStreamSource(this.stream);
      const analyser = this.audioContext.createAnalyser();
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      source.connect(analyser);
      analyser.connect(processor);
      
      processor.onaudioprocess = (event) => {
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
          const inputData = event.inputBuffer.getChannelData(0);
          this.sendAudioData(new Float32Array(inputData));
          
          // Calculate audio level for visualization
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const normalizedLevel = average / 255;
          this.audioLevelCallback?.(normalizedLevel);
        }
      };
      
      processor.connect(this.audioContext.destination);
      
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
        this.sendSessionUpdate();
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
      const wavData = this.createWavFromPCM(audioData);
      const audioBuffer = await this.audioContext!.decodeAudioData(wavData.buffer);
      
      const source = this.audioContext!.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext!.destination);
      
      source.onended = () => this.playNextAudioChunk();
      source.start();
    } catch (error) {
      console.error('Error playing audio chunk:', error);
      this.playNextAudioChunk();
    }
  }

  private createWavFromPCM(pcmData: Uint8Array): Uint8Array {
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;
    
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

    const wavArray = new Uint8Array(wavHeader.byteLength + pcmData.length);
    wavArray.set(new Uint8Array(wavHeader), 0);
    wavArray.set(pcmData, wavHeader.byteLength);
    
    return wavArray;
  }

  disconnect() {
    console.log('🔌 Disconnecting from OpenAI Realtime API...');
    
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

// Audio Visualizer Component
const AudioVisualizer: React.FC<{ audioLevel: number; isActive: boolean }> = ({ 
  audioLevel, 
  isActive 
}) => {
  const bars = Array.from({ length: 32 }, (_, i) => {
    const height = isActive 
      ? Math.max(0.1, Math.random() * audioLevel + Math.sin(Date.now() / 200 + i) * 0.2)
      : 0.1;
    return height;
  });

  return (
    <div className="flex items-end justify-center space-x-1 h-16 px-4">
      {bars.map((height, index) => (
        <div
          key={index}
          className="bg-[#6889b4] rounded-full transition-all duration-150 ease-out"
          style={{
            width: '4px',
            height: `${Math.max(4, height * 60)}px`,
            opacity: isActive ? 0.7 + height * 0.3 : 0.3
          }}
        />
      ))}
    </div>
  );
};

// Main Voice Interface Component
const VoiceInterface: React.FC<VoiceInterfaceProps> = ({
  onTranscriptionUpdate,
  onSpeakingChange,
  conversationId,
  userId,
  onEndSession,
  onBack,
  progressPercentage,
  formattedTime,
  formattedTimeRemaining,
  currentAIResponse
}) => {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'disconnected'>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [currentUserTranscript, setCurrentUserTranscript] = useState('');
  const [currentAITranscript, setCurrentAITranscript] = useState('');
  const [microphoneGranted, setMicrophoneGranted] = useState(false);
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

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

  const handleConnectionChange = useCallback((status: 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected') => {
    setConnectionStatus(status);

    switch (status) {
      case 'connecting':
        toast({
          title: "Connecting to voice session...",
          description: "Establishing connection to OpenAI Realtime API",
        });
        break;
      case 'connected':
        toast({
          title: "Voice connection active",
          description: "You can now start speaking",
        });
        break;
      case 'error':
        setIsRecording(false);
        setIsAISpeaking(false);
        toast({
          title: "Connection lost - Retrying...", 
          description: "Failed to connect to voice service. Please check your connection.",
          variant: "destructive",
        });
        break;
      case 'disconnected':
        setIsRecording(false);
        setIsAISpeaking(false);
        toast({
          title: "Disconnected",
          description: "Voice session has ended",
        });
        break;
    }
  }, []);

  const handleMicrophoneGranted = useCallback(async (stream: MediaStream) => {
    console.log('🎤 Microphone permission granted, connecting to OpenAI...');
    setMicrophoneStream(stream);
    setMicrophoneGranted(true);
    
    try {
      realtimeChatRef.current = new RealtimeChat(
        handleMessage, 
        handleConnectionChange,
        setAudioLevel
      );
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

  const handleEndConversation = () => {
    if (realtimeChatRef.current) {
      realtimeChatRef.current.disconnect();
      realtimeChatRef.current = null;
    }
    
    if (microphoneStream) {
      microphoneStream.getTracks().forEach(track => track.stop());
      setMicrophoneStream(null);
    }
    
    setCurrentUserTranscript('');
    setCurrentAITranscript('');
    setMicrophoneGranted(false);
    userTranscriptRef.current = '';
    aiTranscriptRef.current = '';
    setConnectionStatus('idle');
    onEndSession();
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

  const getStatusText = () => {
    if (!microphoneGranted) return "Requesting microphone access...";
    if (connectionStatus === 'connecting') return "Connecting to voice session...";
    if (connectionStatus === 'error') return "Connection lost - Retrying...";
    if (connectionStatus === 'disconnected') return "Disconnected";
    if (isAISpeaking) return "AI is speaking...";
    if (isRecording) return "Your turn to speak";
    return "Ready to connect";
  };

  const getConnectionIndicator = () => {
    switch (connectionStatus) {
      case 'connected':
        return <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />;
      case 'connecting':
        return <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />;
      case 'error':
        return <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />;
      default:
        return <div className="w-3 h-3 bg-gray-400 rounded-full" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-medium text-[#24476e]">Voice Session</h1>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleEndConversation}
          className="border-[#24476e] text-[#24476e] hover:bg-[#24476e] hover:text-white"
        >
          <Check className="h-4 w-4 mr-2" />
          Submit
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        {!microphoneGranted ? (
          <div className="text-center space-y-4">
            <MicrophonePermission
              onPermissionGranted={handleMicrophoneGranted}
              onPermissionDenied={handleMicrophoneDenied}
            />
          </div>
        ) : (
          <>
            {/* Status Text */}
            <div className="text-center">
              <h2 className="text-2xl font-medium text-[#24476e] mb-2">
                {getStatusText()}
              </h2>
              
              {/* Connection Indicator */}
              <div className="flex items-center justify-center space-x-2">
                {getConnectionIndicator()}
                <span className="text-sm text-gray-600">
                  {connectionStatus === 'connected' ? 'Connected' : 
                   connectionStatus === 'connecting' ? 'Connecting...' :
                   connectionStatus === 'error' ? 'Connection Error' : 'Disconnected'}
                </span>
              </div>
            </div>

            {/* Animated Star Icon */}
            <div className="relative">
              <Star 
                className={`w-16 h-16 text-[#a5c7b9] ${
                  isAISpeaking || isRecording ? 'animate-pulse' : ''
                }`} 
                fill="currentColor"
              />
              {(isAISpeaking || isRecording) && (
                <div className="absolute inset-0 w-16 h-16 border-2 border-[#a5c7b9] rounded-full animate-ping" />
              )}
            </div>

            {/* AI Response Display */}
            {(currentAITranscript || currentAIResponse) && (
              <div className="max-w-md text-center">
                <div className="bg-white rounded-lg p-4 shadow-sm border">
                  <p className="text-[#24476e] leading-relaxed">
                    {currentAITranscript || currentAIResponse || "Hi! Last time you told me you wanted to ask for a raise. How was that conversation?"}
                  </p>
                </div>
              </div>
            )}

            {/* Current User Transcript */}
            {currentUserTranscript && (
              <div className="max-w-md text-center">
                <div className="bg-[#6889b4] text-white rounded-lg p-4">
                  <p className="leading-relaxed">{currentUserTranscript}</p>
                </div>
              </div>
            )}

            {/* Audio Visualization */}
            <div className="w-full max-w-lg">
              <AudioVisualizer 
                audioLevel={audioLevel} 
                isActive={isRecording || isAISpeaking} 
              />
            </div>

            {/* Bottom Controls */}
            <div className="flex flex-col items-center space-y-4">
              <Button
                onClick={handleEndConversation}
                size="lg"
                className={`w-20 h-20 rounded-full shadow-lg border-2 transition-all ${
                  isRecording && !isAISpeaking
                    ? 'bg-red-500 hover:bg-red-600 border-red-700 text-white'
                    : isAISpeaking
                    ? 'bg-[#6889b4] hover:bg-[#5a7ba3] border-[#24476e] text-white'
                    : 'bg-gray-500 hover:bg-gray-600 border-gray-700 text-white'
                }`}
              >
                {isAISpeaking ? (
                  <Volume2 className="w-8 h-8" />
                ) : isRecording ? (
                  <Mic className="w-8 h-8" />
                ) : (
                  <MicOff className="w-8 h-8" />
                )}
              </Button>

              <p className="text-sm text-gray-600 text-center max-w-sm">
                {isAISpeaking ? "AI is speaking..." : 
                 isRecording ? "Listening to your voice..." : 
                 "Press the microphone to start speaking"}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VoiceInterface;