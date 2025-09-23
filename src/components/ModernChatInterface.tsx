import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Menu, Mic, MicOff, Send, PenTool, User, Paperclip, Square, Volume2, ArrowLeft } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import VoiceRecorder from '@/components/VoiceRecorder';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ModernChatInterfaceProps {
  messages: Message[];
  isRecording: boolean;
  isLoading: boolean;
  isAISpeaking: boolean;
  inputMode: 'text' | 'voice' | 'realtime';
  textInput: string;
  interactionProgress: number;
  userName?: string;
  onSendMessage: (message: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onTextInputChange: (text: string) => void;
  onModeSelect: (mode: 'text' | 'voice' | 'realtime') => void;
  onEndSession?: () => void;
  onTranscriptionComplete?: (transcription: string) => void;
}

const ModernChatInterface: React.FC<ModernChatInterfaceProps> = ({
  messages,
  isRecording,
  isLoading,
  isAISpeaking,
  inputMode,
  textInput,
  interactionProgress,
  userName = "Maya",
  onSendMessage,
  onStartRecording,
  onStopRecording,
  onTextInputChange,
  onModeSelect,
  onEndSession,
  onTranscriptionComplete
}) => {
  // FIXED: Don't hide welcome based solely on messages length
  // Let the parent component handle session initialization
  const [showWelcome, setShowWelcome] = useState(messages.length === 0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [messages]);

  // FIXED: Update welcome state when messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setShowWelcome(false);
    }
  }, [messages.length]);

  const handleSendText = () => {
    if (!textInput.trim()) return;
    console.log('📤 ModernChatInterface: Sending message:', textInput.trim());
    onSendMessage(textInput);
    onTextInputChange('');
    setShowWelcome(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleModeSelect = (mode: 'text' | 'voice' | 'realtime') => {
    console.log('🔄 ModernChatInterface: Mode selected:', mode);
    onModeSelect(mode);
    setShowWelcome(false);
  };

  const getProgressMessage = () => {
    if (interactionProgress < 15) {
      return "Interaction Progress: Continue chatting to prevent session timeout";
    }
    return `Interaction Progress: ${interactionProgress}% - Continue chatting to prevent session timeout`;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* FIXED: Mobile-friendly header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-4xl mx-auto relative">
          {/* Left Section */}
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => navigate('/dashboard')} 
              className="bg-primary hover:bg-primary-600 text-primary-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-medium text-gray-900 hidden sm:block">
              Therapeutic Chat
            </h1>
            <h1 className="text-base font-medium text-gray-900 sm:hidden">
              Chat
            </h1>
          </div>
          
          {/* Center Section - Mode Toggle (Hidden on mobile when there are messages) */}
          <div className={`items-center bg-gray-100 rounded-lg p-1 ${showWelcome ? 'flex' : 'hidden sm:flex'}`}>
            <Button 
              variant={inputMode === 'voice' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => onModeSelect('voice')} 
              className="text-xs px-2 py-1 h-7"
            >
              <Mic className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Voz</span>
            </Button>
            <Button 
              variant={inputMode === 'text' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => onModeSelect('text')} 
              className="text-xs px-2 py-1 h-7"
            >
              <PenTool className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Texto</span>
            </Button>
            <Button 
              variant={inputMode === 'realtime' ? 'default' : 'ghost'} 
              size="sm" 
              onClick={() => onModeSelect('realtime')} 
              className="text-xs px-2 py-1 h-7"
            >
              ⚡
              <span className="hidden sm:inline">RT</span>
            </Button>
          </div>
          
          {/* Right Section */}
          <div className="flex items-center space-x-2">
            {messages.length > 0 && onEndSession && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEndSession}
                className="text-xs px-3 py-1 h-7 text-red-600 border-red-200 hover:bg-red-50 hidden sm:inline-flex"
              >
                End Session
              </Button>
              // Mobile version shown in footer
            )}
          </div>
        </div>
      </header>

      {/* Secondary Header - Progress Bar (Hidden on welcome screen) */}
      {!showWelcome && (
        <div className="bg-white shadow-xs px-4 py-2 border-b">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <Progress value={interactionProgress} className="h-2 bg-gray-200" />
              </div>
              <span className={`text-sm whitespace-nowrap ${interactionProgress < 15 ? 'text-amber-600 animate-pulse' : 'text-gray-600'} hidden sm:inline`}>
                {getProgressMessage()}
              </span>
              <span className={`text-xs ${interactionProgress < 15 ? 'text-amber-600' : 'text-gray-600'} sm:hidden`}>
                {interactionProgress}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {showWelcome ? (
          /* Welcome State */
          <div className="flex-1 flex items-center justify-center bg-gray-50 p-4 sm:p-8">
            <div className="text-center space-y-6 sm:space-y-8 max-w-2xl">
              {/* Avatar */}
              <div className="w-16 h-16 sm:w-24 sm:h-24 mx-auto rounded-full bg-primary flex items-center justify-center shadow-elegant">
                <User className="w-8 h-8 sm:w-12 sm:h-12 text-white" />
              </div>
              
              {/* Welcome Text */}
              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
                  Welcome, {userName}
                </h2>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed px-4">
                  Choose how you'd like to interact with your AI assistant.<br className="hidden sm:inline" />
                  <span className="sm:hidden"> </span>You can switch between modes at any time.
                </p>
              </div>
              
              {/* Interaction Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 px-4 sm:px-0">
                {/* Text Card */}
                <Card 
                  className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1" 
                  onClick={() => handleModeSelect('text')}
                >
                  <div className="space-y-3 sm:space-y-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <PenTool className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900">Text Interaction</h3>
                      <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                        Type your thoughts and questions.<br />
                        Perfect for detailed conversations<br className="hidden sm:inline" />
                        <span className="sm:hidden"> </span>and when you prefer writing.
                      </p>
                    </div>
                  </div>
                </Card>
                
                {/* Voice Card */}
                <Card 
                  className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1" 
                  onClick={() => handleModeSelect('voice')}
                >
                  <div className="space-y-3 sm:space-y-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900">Voice Interaction</h3>
                      <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                        Speak naturally to your AI assistant.<br />
                        Hands-free conversation with<br className="hidden sm:inline" />
                        <span className="sm:hidden"> </span>real-time voice responses.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* FIXED: Add auto-start option */}
              <div className="text-center pt-4">
                <p className="text-xs text-gray-500 mb-2">Or let the AI choose the best mode for you</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    // Default to text mode and start conversation
                    handleModeSelect('text');
                    // Trigger first AI message by sending a start signal
                    console.log('🤖 Auto-starting conversation...');
                    onSendMessage("start_conversation");
                  }}
                  className="text-sm px-4 py-2"
                >
                  Start Conversation
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Chat Mode */
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start space-x-3 max-w-[85%] sm:max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${message.role === 'user' ? 'bg-blue-500' : 'bg-white border border-gray-200'}`}>
                        {message.role === 'user' ? (
                          <User className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                        ) : (
                          <User className={`w-3 h-3 sm:w-4 sm:h-4 ${isAISpeaking ? 'text-purple-500 animate-pulse' : 'text-gray-600'}`} />
                        )}
                      </div>
                      <div className={`px-3 py-2 sm:px-4 sm:py-3 rounded-lg ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200'}`}>
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        {message.role === 'assistant' && isAISpeaking && (
                          <div className="flex items-center mt-2 text-purple-500">
                            <Volume2 className="w-3 h-3 mr-1 animate-pulse" />
                            <span className="text-xs">Speaking...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex items-start space-x-3">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                        <User className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 animate-pulse" />
                      </div>
                      <div className="px-3 py-2 sm:px-4 sm:py-3 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <LoadingSpinner />
                          <span className="text-sm text-gray-600">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            {/* FIXED: Input Area with mobile layout */}
            <div className="bg-white border-t p-3 sm:p-4 sticky bottom-0 z-10">
              <div className="max-w-4xl mx-auto">
                {inputMode === 'text' ? (
                  <div className="space-y-3 sm:space-y-0 sm:flex sm:items-end sm:space-x-3">
                    <div className="flex items-end space-x-2 sm:space-x-3 flex-1">
                      <Button variant="ghost" size="sm" className="hidden sm:flex">
                        <Paperclip className="w-4 h-4" />
                      </Button>
                      <div className="flex-1 relative">
                        <Textarea 
                          ref={textareaRef} 
                          value={textInput} 
                          onChange={(e) => onTextInputChange(e.target.value)} 
                          onKeyPress={handleKeyPress} 
                          placeholder="Write your message" 
                          className="min-h-[48px] max-h-32 resize-none bg-gray-50 border-gray-200 rounded-lg text-sm" 
                          disabled={isLoading} 
                        />
                      </div>
                      <Button 
                        onClick={handleSendText} 
                        disabled={!textInput.trim() || isLoading} 
                        className="bg-primary hover:bg-primary-600 text-primary-foreground w-10 h-10 sm:w-10 sm:h-10 rounded-lg flex-shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {/* Mobile: Session controls in footer */}
                    {messages.length > 0 && onEndSession && (
                      <div className="flex justify-center pt-2 border-t border-gray-100 sm:hidden">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onEndSession}
                          className="text-xs px-3 py-1 text-red-600 border-red-200 hover:bg-red-50"
                        >
                          End Session
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Voice Mode */
                  <div className="space-y-3">
                    <VoiceRecorder
                      onRecordingStart={onStartRecording}
                      onRecordingStop={onStopRecording}
                      onRecordingComplete={(audioBlob) => {
                        console.log('Audio recording completed:', audioBlob);
                      }}
                      onTranscriptionComplete={onTranscriptionComplete}
                    />
                    
                    {/* Mobile: Session controls for voice mode */}
                    {messages.length > 0 && onEndSession && (
                      <div className="flex justify-center pt-2 border-t border-gray-100 sm:hidden">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onEndSession}
                          className="text-xs px-3 py-1 text-red-600 border-red-200 hover:bg-red-50"
                        >
                          End Session
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ModernChatInterface;
