import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Mic, MicOff, Square, Send, User, Brain, Keyboard, Volume2 } from 'lucide-react';
import VoiceInput from '@/components/VoiceInput';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface ConversationInterfaceProps {
  messages: Message[];
  isRecording: boolean;
  isSessionActive: boolean;
  isLoading: boolean;
  isAISpeaking: boolean;
  currentTranscription: string;
  textInput: string;
  inputMode: 'audio' | 'text' | 'both';
  onStartRecording: () => void;
  onStopRecording: () => void;
  onEndSession: () => void;
  onVoiceTranscription: (text: string) => void;
  onTextInputChange: (text: string) => void;
  onSendTextMessage: () => void;
  formatTime: (seconds: number) => string;
  sessionTime: number;
}

const ConversationInterface: React.FC<ConversationInterfaceProps> = ({
  messages,
  isRecording,
  isSessionActive,
  isLoading,
  isAISpeaking,
  currentTranscription,
  textInput,
  inputMode,
  onStartRecording,
  onStopRecording,
  onEndSession,
  onVoiceTranscription,
  onTextInputChange,
  onSendTextMessage,
  formatTime,
  sessionTime
}) => {
  const getRecordingButtonConfig = () => {
    if (!isSessionActive) {
      return {
        onClick: onStartRecording,
        variant: 'default' as const,
        className: 'h-12 w-12 rounded-full',
        icon: <Mic className="h-5 w-5" />,
        disabled: false
      };
    }
    
    if (isRecording) {
      return {
        onClick: onStopRecording,
        variant: 'destructive' as const,
        className: 'h-12 w-12 rounded-full animate-pulse',
        icon: <Square className="h-5 w-5" />,
        disabled: false
      };
    }
    
    return {
      onClick: onStartRecording,
      variant: 'outline' as const,
      className: 'h-12 w-12 rounded-full',
      icon: <Mic className="h-5 w-5" />,
      disabled: isLoading
    };
  };

  const buttonConfig = getRecordingButtonConfig();

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendTextMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Session Timer */}
      {isSessionActive && (
        <div className="flex justify-center p-4 border-b">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {formatTime(sessionTime)}
          </Badge>
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {!isSessionActive && messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Bienvenido a tu sesión de terapia</h3>
              <p className="text-muted-foreground">
                Inicia la conversación usando {inputMode === 'audio' ? 'el micrófono' : inputMode === 'text' ? 'texto' : 'voz o texto'}
              </p>
            </div>
          )}

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
                    <Brain className={`h-4 w-4 ${isAISpeaking ? 'animate-pulse text-primary' : ''}`} />
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
                      {message.role === 'assistant' && isAISpeaking && (
                        <div className="flex items-center gap-1">
                          <Volume2 className="h-3 w-3 animate-pulse" />
                          <span className="text-xs animate-pulse">Hablando...</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </Card>
              </div>
            </div>
          ))}

          {/* Real-time transcription display */}
          {currentTranscription && (
            <div className="flex gap-3 justify-end opacity-70">
              <div className="flex gap-3 max-w-[80%] flex-row-reverse">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/20">
                  <Mic className="h-4 w-4 text-primary animate-pulse" />
                </div>
                <Card className="p-3 bg-primary/10 border-primary/20">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-primary">Transcribiendo...</span>
                    <p className="text-sm leading-relaxed text-primary">{currentTranscription}</p>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
                <Brain className="h-4 w-4 animate-pulse" />
              </div>
              <Card className="p-3 bg-card">
                <div className="flex items-center gap-2">
                  <LoadingSpinner />
                  <span className="text-sm text-muted-foreground">Pensando...</span>
                </div>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      {isSessionActive && (
        <div className="border-t p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3">
              
              {/* Voice Input */}
              {(inputMode === 'audio' || inputMode === 'both') && (
                <div className="flex items-center gap-2">
                  <Button {...buttonConfig}>
                    {buttonConfig.icon}
                  </Button>
                  {isRecording && (
                    <div className="flex items-center gap-1 text-red-600">
                      <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                      <span className="text-xs">Grabando</span>
                    </div>
                  )}
                </div>
              )}

              {/* Text Input */}
              {(inputMode === 'text' || inputMode === 'both') && (
                <div className="flex-1 flex gap-2">
                  <Textarea
                    value={textInput}
                    onChange={(e) => onTextInputChange(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Escribe tu mensaje aquí..."
                    className="min-h-[48px] max-h-32 resize-none"
                    disabled={isLoading}
                  />
                  <Button 
                    onClick={onSendTextMessage}
                    disabled={!textInput.trim() || isLoading}
                    className="h-12 w-12 rounded-full"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}

            </div>

            {/* Session Controls */}
            <div className="flex justify-center mt-4">
              <Button 
                onClick={onEndSession}
                variant="outline"
                size="sm"
              >
                Terminar Sesión
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Input Component (hidden but functional) */}
      <div className="hidden">
        <VoiceInput 
          onTranscription={onVoiceTranscription}
          disabled={!isSessionActive || isLoading || inputMode === 'text'}
        />
      </div>
    </div>
  );
};

export default ConversationInterface;