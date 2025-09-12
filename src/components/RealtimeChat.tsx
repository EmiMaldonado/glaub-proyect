import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { RealtimeChat } from '@/utils/RealtimeAudio';
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
          title: "🎙️ Conversación iniciada",
          description: "Puedes comenzar a hablar ahora",
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

      case 'response.audio_transcript.done':
        break;

      case 'error':
        toast({
          title: "Error de conexión",
          description: message.error || "Error en la conexión de voz",
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
          title: "Conectando...",
          description: "Estableciendo conexión de voz",
        });
        break;
      case 'connected':
        toast({
          title: "✅ Conectado",
          description: "Conexión de voz establecida",
        });
        break;
      case 'retrying':
        toast({
          title: "Reintentando...",
          description: "Reconectando conexión de voz",
        });
        break;
      case 'error':
        setIsRecording(false);
        setIsAISpeaking(false);
        toast({
          title: "Error de conexión",
          description: "No se pudo establecer la conexión de voz",
          variant: "destructive",
        });
        break;
      case 'disconnected':
        setIsRecording(false);
        setIsAISpeaking(false);
        break;
    }
  }, []);

  // Handle microphone permission granted
  const handleMicrophoneGranted = useCallback((stream: MediaStream) => {
    console.log('Microphone permission granted, starting voice connection...', {
      streamActive: stream.active,
      audioTracks: stream.getAudioTracks().length,
      streamId: stream.id
    });
    setMicrophoneStream(stream);
    setMicrophoneGranted(true);
    // Pass stream directly to avoid React state race condition
    startConversationWithStream(stream);
  }, []);

  // Handle microphone permission denied
  const handleMicrophoneDenied = useCallback(() => {
    console.log('Microphone permission denied');
    setConnectionStatus('error');
    toast({
      title: "Micrófono requerido",
      description: "Necesitas permitir acceso al micrófono para usar conversaciones de voz",
      variant: "destructive",
    });
  }, []);

  // Start conversation with specific stream (avoids race condition)
  const startConversationWithStream = async (stream: MediaStream) => {
    if (!stream || !stream.active) {
      console.error('Invalid microphone stream provided:', {
        hasStream: !!stream,
        streamActive: stream?.active,
        audioTracks: stream?.getAudioTracks().length
      });
      toast({
        title: "Error de micrófono",
        description: "Stream de micrófono inválido",
        variant: "destructive",
      });
      return;
    }

    // Validate audio tracks
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.error('No audio tracks found in stream');
      toast({
        title: "Error de micrófono",
        description: "No se encontraron pistas de audio",
        variant: "destructive",
      });
      return;
    }

    // Check if audio tracks are live
    const liveTrack = audioTracks.find(track => track.readyState === 'live');
    if (!liveTrack) {
      console.error('No live audio tracks found:', audioTracks.map(t => ({ id: t.id, state: t.readyState })));
      toast({
        title: "Error de micrófono",
        description: "Pistas de audio no están activas",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Starting OpenAI Realtime connection with validated stream:', {
        streamId: stream.id,
        active: stream.active,
        audioTracks: audioTracks.length,
        liveTrack: liveTrack.id
      });
      
      realtimeChatRef.current = new RealtimeChat(handleMessage, handleConnectionChange);
      await realtimeChatRef.current.connect(stream);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error starting conversation:', errorMessage);
      toast({
        title: "Error de conexión",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Fallback method using stored stream (for manual start button)
  const startConversation = async () => {
    if (!microphoneStream) {
      console.error('No stored microphone stream available');
      toast({
        title: "Error de micrófono",
        description: "No hay stream de micrófono disponible",
        variant: "destructive",
      });
      return;
    }
    
    await startConversationWithStream(microphoneStream);
  };

  const endConversation = () => {
    console.log('Ending voice conversation...');
    
    if (realtimeChatRef.current) {
      realtimeChatRef.current.disconnect();
      realtimeChatRef.current = null;
    }
    
    if (microphoneStream) {
      microphoneStream.getTracks().forEach(track => {
        track.stop();
        console.log('Microphone track stopped');
      });
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
      console.log('Cleaning up RealtimeChat component...');
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
      case 'retrying': return 'text-orange-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando...';
      case 'retrying': return 'Reintentando...';
      case 'error': return 'Error de conexión';
      case 'idle': return 'Listo para conectar';
      default: return 'Desconectado';
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      {!microphoneGranted ? (
        // Show microphone permission component
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
            {connectionStatus !== 'connected' ? (
              <Button
                onClick={startConversation}
                disabled={connectionStatus === 'connecting' || connectionStatus === 'retrying'}
                className="w-24 h-24 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg"
              >
                {(connectionStatus === 'connecting' || connectionStatus === 'retrying') ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </Button>
            ) : (
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
            )}
          </div>

          {/* Status Text */}
          <div className="text-center">
            {isAISpeaking ? (
              <p className="text-blue-600 font-medium animate-pulse">IA hablando...</p>
            ) : isRecording ? (
              <p className="text-red-600 font-medium">Escuchando...</p>
            ) : connectionStatus === 'connected' ? (
              <p className="text-gray-600">Presiona para finalizar</p>
            ) : (
              <p className="text-gray-600">Presiona para comenzar conversación de voz</p>
            )}
          </div>
        </>
      )}

      {/* Live Transcriptions */}
      {(currentUserTranscript || currentAITranscript) && (
        <div className="w-full max-w-md bg-muted/50 rounded-lg p-4">
          {currentUserTranscript && (
            <div className="mb-2">
              <span className="text-xs text-muted-foreground">Tú:</span>
              <p className="text-sm text-primary">{currentUserTranscript}</p>
            </div>
          )}
          {currentAITranscript && (
            <div>
              <span className="text-xs text-muted-foreground">IA:</span>
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