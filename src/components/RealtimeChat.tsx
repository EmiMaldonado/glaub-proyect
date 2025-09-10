import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Send, Loader2, Volume2, VolumeX } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { RealtimeChat as RealtimeChatClient, RealtimeMessage } from '@/utils/RealtimeAudio';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RealtimeChatProps {
  onMessageUpdate?: (messages: RealtimeMessage[]) => void;
  onSpeakingChange?: (speaking: boolean) => void;
  className?: string;
}

const RealtimeChat: React.FC<RealtimeChatProps> = ({
  onMessageUpdate,
  onSpeakingChange,
  className = ''
}) => {
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  
  const clientRef = useRef<RealtimeChatClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleMessage = useCallback((message: RealtimeMessage) => {
    console.log('New message:', message);
    setMessages(prev => {
      const updated = [...prev, message];
      onMessageUpdate?.(updated);
      return updated;
    });
  }, [onMessageUpdate]);

  const handleSpeakingChange = useCallback((speaking: boolean) => {
    console.log('Speaking state changed:', speaking);
    setIsSpeaking(speaking);
    onSpeakingChange?.(speaking);
  }, [onSpeakingChange]);

  const handleConnectionChange = useCallback((connected: boolean) => {
    console.log('Connection state changed:', connected);
    setIsConnected(connected);
    setIsConnecting(false);
    
    if (connected) {
      setIsRecording(true);
      toast({
        title: "🎙️ Connected",
        description: "Voice interface is ready",
      });
    } else {
      setIsRecording(false);
      toast({
        title: "Disconnected",
        description: "Voice interface connection lost",
        variant: "destructive"
      });
    }
  }, []);

  const handleTranscriptUpdate = useCallback((transcript: string) => {
    console.log('Transcript update:', transcript);
    setCurrentTranscript(transcript);
  }, []);

  const startConversation = async () => {
    if (isConnecting || isConnected) return;
    
    setIsConnecting(true);
    
    try {
      clientRef.current = new RealtimeChatClient(
        handleMessage,
        handleSpeakingChange,
        handleConnectionChange,
        handleTranscriptUpdate
      );
      
      await clientRef.current.connect();
    } catch (error) {
      console.error('Error starting conversation:', error);
      setIsConnecting(false);
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : 'Failed to connect',
        variant: "destructive"
      });
    }
  };

  const endConversation = () => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setIsConnected(false);
    setIsRecording(false);
    setIsSpeaking(false);
    setCurrentTranscript('');
  };

  const sendTextMessage = () => {
    if (!textInput.trim() || !isConnected || !clientRef.current) return;
    
    try {
      clientRef.current.sendTextMessage(textInput.trim());
      setTextInput('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []);

  // Audio visualization bars
  const generateAudioBars = () => {
    const bars = [];
    const numBars = 20;
    
    for (let i = 0; i < numBars; i++) {
      const height = isSpeaking || isRecording 
        ? Math.random() * 32 + 8 
        : 8;
      
      bars.push(
        <div
          key={i}
          className="bg-primary transition-all duration-200 rounded-full"
          style={{
            width: '3px',
            height: `${height}px`,
            opacity: isSpeaking || isRecording ? 0.8 : 0.3
          }}
        />
      );
    }
    
    return bars;
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Connection Status */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          
          {(isSpeaking || isRecording) && (
            <div className="flex items-center space-x-1">
              {isSpeaking ? <Volume2 className="w-4 h-4 text-primary" /> : <Mic className="w-4 h-4 text-success" />}
              <div className="flex items-center space-x-1 h-8">
                {generateAudioBars()}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInputMode(inputMode === 'voice' ? 'text' : 'voice')}
            disabled={!isConnected}
          >
            {inputMode === 'voice' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
          
          {!isConnected ? (
            <Button 
              onClick={startConversation} 
              disabled={isConnecting}
              className="bg-primary hover:bg-primary/90"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Start Conversation'
              )}
            </Button>
          ) : (
            <Button 
              onClick={endConversation}
              variant="outline"
            >
              End Conversation
            </Button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <Card className={`max-w-[80%] ${
                message.type === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary'
              }`}>
                <CardContent className="p-3">
                  <div className="flex items-start space-x-2">
                    {message.type === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
                        AI
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      {message.audioTranscript && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          Voice
                        </Badge>
                      )}
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
          
          {/* Current transcript display */}
          {currentTranscript && (
            <div className="flex justify-center">
              <Badge variant="outline" className="text-xs animate-pulse">
                {currentTranscript}
              </Badge>
            </div>
          )}
          
          {/* AI thinking indicator */}
          {isSpeaking && (
            <div className="flex justify-start">
              <Card className="bg-secondary">
                <CardContent className="p-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
                      AI
                    </div>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Text Input Mode */}
      {inputMode === 'text' && isConnected && (
        <div className="p-4 border-t">
          <div className="flex space-x-2">
            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1"
            />
            <Button 
              onClick={sendTextMessage}
              disabled={!textInput.trim()}
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Voice Mode Status */}
      {inputMode === 'voice' && isConnected && (
        <div className="p-4 border-t text-center">
          <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
            <Mic className="w-4 h-4" />
            <span>{isRecording ? 'Listening...' : 'Voice mode active'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealtimeChat;