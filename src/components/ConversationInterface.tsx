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
  onInputModeChange: (mode: 'audio' | 'text' | 'both') => void;
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
  onInputModeChange,
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
            <div className="flex flex-col items-center justify-center py-12 space-y-8">
              
              {/* Mode Selection */}
              <div className="flex flex-col items-center space-y-4">
                <h3 className="text-2xl font-semibold">Selecciona el modo de conversación</h3>
                <div className="flex gap-3">
                  <Button 
                    variant={inputMode === 'audio' ? 'default' : 'outline'}
                    onClick={() => onInputModeChange('audio')}
                    className="gap-2"
                  >
                    <Mic className="h-4 w-4" />
                    Solo Voz
                  </Button>
                  <Button 
                    variant={inputMode === 'text' ? 'default' : 'outline'}
                    onClick={() => onInputModeChange('text')}
                    className="gap-2"
                  >
                    <Keyboard className="h-4 w-4" />
                    Solo Texto
                  </Button>
                  <Button 
                    variant={inputMode === 'both' ? 'default' : 'outline'}
                    onClick={() => onInputModeChange('both')}
                    className="gap-2"
                  >
                    <Volume2 className="h-4 w-4" />
                    Ambos
                  </Button>
                </div>
              </div>

              {/* Main Recording Button */}
              <div className="relative">
                <Button
                  onClick={onStartRecording}
                  variant="default"
                  className="h-32 w-32 rounded-full text-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300"
                  disabled={isLoading}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Mic className="h-12 w-12" />
                  </div>
                </Button>
              </div>

              {/* Welcome Text */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Iniciar Sesión</h2>
                <p className="text-muted-foreground max-w-md">
                  Presiona el botón para comenzar tu sesión de terapia usando {inputMode === 'audio' ? 'solo voz' : inputMode === 'text' ? 'solo texto' : 'voz y texto'}
                </p>
              </div>
            </div>
          )}

          {/* Session Active Welcome - Show recording controls */}
          {isSessionActive && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 space-y-8">
              
              {/* Recording Status */}
              <div className="text-center space-y-4">
                <h3 className="text-xl font-semibold mb-2">Sesión Activa</h3>
                <p className="text-muted-foreground">
                  {isRecording ? 'Grabando... Habla ahora' : 'Presiona el botón para comenzar a grabar'}
                </p>
              </div>

              {/* Main Recording Button with Animation */}
              <div className="relative">
                <Button
                  {...buttonConfig}
                  disabled={isLoading}
                >
                  <div className="flex flex-col items-center gap-2">
                    {buttonConfig.icon}
                  </div>
                </Button>
                
                {/* Recording Animation */}
                {isRecording && (
                  <>
                    <div className="absolute -inset-6 border-4 border-destructive rounded-full animate-ping opacity-20"></div>
                    <div className="absolute -inset-12 border-2 border-destructive/60 rounded-full animate-ping opacity-10"></div>
                    <div className="absolute -inset-2 flex items-center justify-center">
                      <div className="flex items-center gap-1 text-destructive text-sm font-medium">
                        <div className="w-2 h-2 bg-destructive rounded-full animate-pulse"></div>
                        <span>REC</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Recording Status Text */}
              <div className="text-center">
                <h4 className="text-lg font-semibold">
                  {isRecording ? 'Grabando...' : 'Listo para grabar'}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {isRecording ? 'Presiona para pausar la grabación' : 'Presiona para continuar hablando'}
                </p>
              </div>
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

      {/* Voice Input Component */}
      {(inputMode === 'audio' || inputMode === 'both') && (
        <div className="flex justify-center pt-4">
          <VoiceInput 
            onTranscription={onVoiceTranscription}
            disabled={!isSessionActive || isLoading}
            showTestButton={true}
          />
        </div>
      )}
    </div>
  );
};

export default ConversationInterface;