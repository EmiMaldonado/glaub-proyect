import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { RealtimeChat } from '@/utils/RealtimeAudio';
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

const RealtimeChatInterface: React.FC<RealtimeChatProps> = ({
  onTranscriptionUpdate,
  onSpeakingChange,
  conversationId,
  userId
}) => {
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [isRecording, setIsRecording] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [currentUserTranscript, setCurrentUserTranscript] = useState('');
  const [currentAITranscript, setCurrentAITranscript] = useState('');

  const realtimeChatRef = useRef<RealtimeChat | null>(null);
  const userTranscriptRef = useRef('');
  const aiTranscriptRef = useRef('');

  const handleMessage = useCallback((message: any) => {
    console.log('[RealtimeChat] Message received:', message.type);

    switch (message.type) {
      case 'session.created':
        console.log('[RealtimeChat] Session created');
        setIsRecording(true);
        toast({
          title: "🎙️ Conversación iniciada",
          description: "Puedes comenzar a hablar ahora",
        });
        break;

      case 'input_audio_buffer.speech_started':
        console.log('[RealtimeChat] User started speaking');
        setCurrentUserTranscript('');
        userTranscriptRef.current = '';
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('[RealtimeChat] User stopped speaking');
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
        console.log('[RealtimeChat] AI transcript completed:', aiTranscriptRef.current);
        break;

      case 'error':
        console.error('[RealtimeChat] Error:', message.error);
        toast({
          title: "Error",
          description: message.error || "Error en la conexión",
          variant: "destructive",
        });
        break;

      default:
        console.log('[RealtimeChat] Unhandled message type:', message.type);
    }
  }, [onTranscriptionUpdate, onSpeakingChange]);

  const handleConnectionChange = useCallback((status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
    console.log('[RealtimeChat] Connection status changed:', status);
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

  const startConversation = async () => {
    try {
      realtimeChatRef.current = new RealtimeChat(handleMessage, handleConnectionChange);
      await realtimeChatRef.current.connect();
    } catch (error) {
      console.error('[RealtimeChat] Failed to start conversation:', error);
      toast({
        title: "Error",
        description: "No se pudo iniciar la conversación de voz",
        variant: "destructive",
      });
    }
  };

  const endConversation = () => {
    if (realtimeChatRef.current) {
      realtimeChatRef.current.disconnect();
      realtimeChatRef.current = null;
    }
    setTranscripts([]);
    setCurrentUserTranscript('');
    setCurrentAITranscript('');
    userTranscriptRef.current = '';
    aiTranscriptRef.current = '';
  };

  useEffect(() => {
    return () => {
      if (realtimeChatRef.current) {
        realtimeChatRef.current.disconnect();
      }
    };
  }, []);

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
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando...';
      case 'error': return 'Error de conexión';
      default: return 'Desconectado';
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6">
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
            disabled={connectionStatus === 'connecting'}
            className="w-24 h-24 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg"
          >
            {connectionStatus === 'connecting' ? (
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