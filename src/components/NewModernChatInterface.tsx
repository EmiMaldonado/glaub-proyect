import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Send, Mic, MessageSquare, FileDown } from 'lucide-react';
import VoiceRecorder from './VoiceRecorder';
import ConversationModeSelector from './ConversationModeSelector';

interface ModernChatInterfaceProps {
  messages: any[];
  onSendMessage: (message: string) => void;
  onVoiceTranscription: (transcription: string) => void;
  inputMode: 'text' | 'voice' | 'realtime';
  onInputModeChange: (mode: 'text' | 'voice' | 'realtime') => void;
  onEndSession: () => void;
  isSessionActive: boolean;
  sessionTime: number;
  onExportConversation?: () => void;
}

const NewModernChatInterface: React.FC<ModernChatInterfaceProps> = ({
  messages,
  onSendMessage,
  onVoiceTranscription,
  inputMode,
  onInputModeChange,
  onEndSession,
  isSessionActive,
  sessionTime,
  onExportConversation
}) => {
  const [textInput, setTextInput] = useState('');
  const [realtimeMessages, setRealtimeMessages] = useState<any[]>([]);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = () => {
    if (!textInput.trim()) return;
    onSendMessage(textInput.trim());
    setTextInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Conversación Terapéutica</h2>
            <p className="text-sm text-muted-foreground">
              Tiempo: {formatTime(sessionTime)}
              {inputMode === 'realtime' && isAISpeaking && (
                <span className="ml-2 text-primary animate-pulse">🔊 AI speaking</span>
              )}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onExportConversation}
              disabled={!messages.length && !realtimeMessages.length}
            >
              <FileDown className="w-4 h-4" />
            </Button>
            <Button variant="destructive" size="sm" onClick={onEndSession}>
              End Session
            </Button>
          </div>
        </div>
      </div>

      {/* Mode selector */}
      <div className="p-4 border-b">
        <ConversationModeSelector 
          currentMode={inputMode}
          onModeChange={onInputModeChange}
        />
      </div>

      {/* Messages Area or Realtime Chat */}
      {inputMode === 'realtime' ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Realtime mode not available in chat interface</p>
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.id || index}`}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-secondary text-secondary-foreground'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(message.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t border-border">
            {inputMode === 'text' ? (
              <div className="flex space-x-2">
                <Textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Write your message..."
                  className="flex-1 min-h-[60px] resize-none"
                  rows={2}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!textInput.trim()}
                  className="self-end bg-primary hover:bg-primary/90"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <VoiceRecorder 
                onTranscriptionComplete={onVoiceTranscription}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NewModernChatInterface;