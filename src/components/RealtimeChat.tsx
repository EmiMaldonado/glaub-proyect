import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, Send, Volume2, VolumeX, User, Brain } from 'lucide-react';
import { AudioRecorder, encodeAudioForAPI, playAudioData } from '@/utils/RealtimeAudio';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isAudio?: boolean;
}

interface RealtimeChatProps {
  onSpeakingChange?: (speaking: boolean) => void;
}

const RealtimeChat: React.FC<RealtimeChatProps> = ({ onSpeakingChange }) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [currentTranscript, setCurrentTranscript] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeAudioContext = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      
      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    }
  };

  const connectToChat = async () => {
    try {
      await initializeAudioContext();
      
      // Extract project ref from window location
      const hostname = window.location.hostname;
      let projectRef = '';
      
      if (hostname.includes('.lovable.dev')) {
        // Development environment
        projectRef = hostname.replace('.sandbox.lovable.dev', '').replace('.lovable.dev', '');
      } else if (hostname.includes('.supabase.co')) {
        // Production environment
        projectRef = hostname.replace('.supabase.co', '');
      } else {
        // Fallback - try to extract from any subdomain
        projectRef = hostname.split('.')[0];
      }
      
      const wsUrl = `wss://${projectRef}.functions.supabase.co/realtime-chat`;
      
      console.log('Connecting to:', wsUrl);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Connected to realtime chat');
        setIsConnected(true);
        toast({
          title: "Conectado",
          description: "Chat en tiempo real activado",
        });
      };

      wsRef.current.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('Received message:', data.type);

        switch (data.type) {
          case 'response.audio.delta':
            if (audioContextRef.current && data.delta) {
              try {
                const binaryString = atob(data.delta);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                await playAudioData(audioContextRef.current, bytes);
                setIsSpeaking(true);
                onSpeakingChange?.(true);
              } catch (error) {
                console.error('Error playing audio:', error);
              }
            }
            break;

          case 'response.audio.done':
            setIsSpeaking(false);
            onSpeakingChange?.(false);
            break;

          case 'response.audio_transcript.delta':
            if (data.delta) {
              setCurrentTranscript(prev => prev + data.delta);
            }
            break;

          case 'response.audio_transcript.done':
            if (currentTranscript) {
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: currentTranscript,
                timestamp: new Date(),
                isAudio: true
              }]);
              setCurrentTranscript('');
            }
            break;

          case 'conversation.item.input_audio_transcription.completed':
            if (data.transcript) {
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'user',
                content: data.transcript,
                timestamp: new Date(),
                isAudio: true
              }]);
            }
            break;

          case 'error':
            console.error('Chat error:', data.message);
            toast({
              title: "Error",
              description: data.message,
              variant: "destructive",
            });
            break;
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: "Error de conexión",
          description: "No se pudo conectar al chat",
          variant: "destructive",
        });
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket closed');
        setIsConnected(false);
        setIsRecording(false);
        setIsSpeaking(false);
        onSpeakingChange?.(false);
      };

    } catch (error) {
      console.error('Error connecting to chat:', error);
      toast({
        title: "Error",
        description: "No se pudo inicializar el chat",
        variant: "destructive",
      });
    }
  };

  const disconnectFromChat = () => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setIsRecording(false);
    setIsSpeaking(false);
    onSpeakingChange?.(false);
  };

  const startRecording = async () => {
    if (!wsRef.current || !audioContextRef.current) return;

    try {
      audioRecorderRef.current = new AudioRecorder((audioData) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const encodedAudio = encodeAudioForAPI(audioData);
          wsRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: encodedAudio
          }));
        }
      });

      await audioRecorderRef.current.start();
      setIsRecording(true);
      
      toast({
        title: "Grabando",
        description: "Habla ahora...",
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Error",
        description: "No se pudo acceder al micrófono",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
    }
    setIsRecording(false);
  };

  const sendTextMessage = () => {
    if (!wsRef.current || !textInput.trim()) return;

    const message = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: textInput
          }
        ]
      }
    };

    wsRef.current.send(JSON.stringify(message));
    wsRef.current.send(JSON.stringify({ type: 'response.create' }));

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: textInput,
      timestamp: new Date(),
      isAudio: false
    }]);

    setTextInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Chat en Tiempo Real</h3>
          {isSpeaking && (
            <div className="flex items-center gap-1 text-primary">
              <Volume2 className="h-4 w-4 animate-pulse" />
              <span className="text-sm">Hablando...</span>
            </div>
          )}
        </div>
        
        {!isConnected ? (
          <Button onClick={connectToChat} size="sm">
            Conectar
          </Button>
        ) : (
          <Button onClick={disconnectFromChat} variant="outline" size="sm">
            Desconectar
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  {message.role === 'user' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Brain className="h-4 w-4" />
                  )}
                </div>
                <Card className={`p-3 ${
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-card'
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {message.role === 'user' ? 'Tú' : 'Psicólogo Virtual'}
                      </span>
                      {message.isAudio && (
                        <Volume2 className="h-3 w-3 opacity-70" />
                      )}
                    </div>
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </Card>
              </div>
            </div>
          ))}
          
          {/* Current transcript display */}
          {currentTranscript && (
            <div className="flex gap-3 justify-start opacity-70">
              <div className="flex gap-3 max-w-[80%]">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
                  <Brain className="h-4 w-4 animate-pulse" />
                </div>
                <Card className="p-3 bg-card border-primary/20">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-primary">Transcribiendo...</span>
                    <p className="text-sm leading-relaxed">{currentTranscript}</p>
                  </div>
                </Card>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      {isConnected && (
        <div className="border-t p-4">
          <div className="flex items-end gap-3">
            {/* Voice Input */}
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              variant={isRecording ? "destructive" : "outline"}
              size="icon"
              className={isRecording ? "animate-pulse" : ""}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>

            {/* Text Input */}
            <div className="flex-1 flex gap-2">
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu mensaje aquí..."
                className="min-h-[40px] max-h-32 resize-none"
                disabled={!isConnected}
              />
              <Button 
                onClick={sendTextMessage}
                disabled={!textInput.trim() || !isConnected}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default RealtimeChat;