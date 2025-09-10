import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Menu, Mic, MicOff, Send, PenTool, User, Brain, Paperclip, Square, Volume2, ArrowLeft } from 'lucide-react';
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
  inputMode: 'text' | 'voice';
  textInput: string;
  interactionProgress: number;
  userName?: string;
  onSendMessage: (message: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onTextInputChange: (text: string) => void;
  onModeSelect: (mode: 'text' | 'voice') => void;
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
  onModeSelect
}) => {
  const [showWelcome, setShowWelcome] = useState(messages.length === 0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [messages]);
  const handleSendText = () => {
    if (!textInput.trim()) return;
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
  const handleModeSelect = (mode: 'text' | 'voice') => {
    onModeSelect(mode);
    setShowWelcome(false);
  };
  const getProgressMessage = () => {
    if (interactionProgress < 15) {
      return "Interaction Progress: Continue chatting to prevent session timeout";
    }
    return `Interaction Progress: ${interactionProgress}% - Continue chatting to prevent session timeout`;
  };
  return <div className="flex flex-col h-screen bg-gray-50">
      {/* Main Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto relative">
          {/* Left Section */}
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" className="lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
            <Button variant="default" size="sm" onClick={() => navigate('/dashboard')} className="bg-primary hover:bg-primary-600 text-primary-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-medium text-gray-900">Chat With AI</h1>
          </div>
          
          {/* Center Section - Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <Button variant={inputMode === 'voice' ? 'default' : 'ghost'} size="sm" onClick={() => onModeSelect('voice')} className="text-xs px-3 py-1 h-7">
              <Mic className="h-3 w-3 mr-1" />
              Voz
            </Button>
            <Button variant={inputMode === 'text' ? 'default' : 'ghost'} size="sm" onClick={() => onModeSelect('text')} className="text-xs px-3 py-1 h-7">
              <PenTool className="h-3 w-3 mr-1" />
              Mensaje
            </Button>
          </div>
          
          {/* Right Section */}
          
        </div>
      </header>

      {/* Secondary Header - Progress Bar */}
      <div className="bg-white shadow-xs px-4 py-2 border-b">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <Progress value={interactionProgress} className="h-2 bg-gray-200" />
            </div>
            <span className={`text-sm whitespace-nowrap ${interactionProgress < 15 ? 'text-amber-600 animate-pulse' : 'text-gray-600'}`}>
              {getProgressMessage()}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {showWelcome ? (/* Welcome State */
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
            <div className="text-center space-y-8 max-w-2xl">
              {/* Avatar */}
              <div className="w-24 h-24 mx-auto rounded-full bg-primary flex items-center justify-center shadow-elegant">
                <Brain className="w-12 h-12 text-white" />
              </div>
              
              {/* Welcome Text */}
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-gray-900">
                  Welcome, {userName}
                </h2>
                <p className="text-gray-600 leading-relaxed">
                  Choose how you'd like to interact with your AI assistant.<br />
                  You can switch between modes at any time.
                </p>
              </div>
              
              {/* Interaction Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Text Card */}
                <Card className="p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1" onClick={() => handleModeSelect('text')}>
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <PenTool className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900">Text Interaction</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        Type your thoughts and questions.<br />
                        Perfect for detailed conversations<br />
                        and when you prefer writing.
                      </p>
                    </div>
                  </div>
                </Card>
                
                {/* Voice Card */}
                <Card className="p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1" onClick={() => handleModeSelect('voice')}>
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <Mic className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900">Voice Interaction</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        Speak naturally to your AI assistant.<br />
                        Hands-free conversation with<br />
                        real-time voice responses.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>) : (/* Chat Mode */
      <>
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map(message => <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start space-x-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${message.role === 'user' ? 'bg-blue-500' : 'bg-white border border-gray-200'}`}>
                        {message.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Brain className={`w-4 h-4 ${isAISpeaking ? 'text-purple-500 animate-pulse' : 'text-gray-600'}`} />}
                      </div>
                      <div className={`px-4 py-3 rounded-lg ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white border border-gray-200'}`}>
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        {message.role === 'assistant' && isAISpeaking && <div className="flex items-center mt-2 text-purple-500">
                            <Volume2 className="w-3 h-3 mr-1 animate-pulse" />
                            <span className="text-xs">Speaking...</span>
                          </div>}
                      </div>
                    </div>
                  </div>)}
                
                {isLoading && <div className="flex justify-start">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-gray-600 animate-pulse" />
                      </div>
                      <div className="px-4 py-3 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <LoadingSpinner />
                          <span className="text-sm text-gray-600">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  </div>}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            {/* Input Area */}
            <div className="bg-white border-t p-4">
              <div className="max-w-4xl mx-auto">
                {inputMode === 'text' ? (
                  <div className="flex items-end space-x-3">
                    <Button variant="ghost" size="sm">
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <div className="flex-1 relative">
                      <Textarea 
                        ref={textareaRef} 
                        value={textInput} 
                        onChange={e => onTextInputChange(e.target.value)} 
                        onKeyPress={handleKeyPress} 
                        placeholder="Write your message" 
                        className="min-h-[48px] max-h-32 resize-none bg-gray-50 border-gray-200 rounded-lg" 
                        disabled={isLoading} 
                      />
                    </div>
                    <Button 
                      onClick={handleSendText} 
                      disabled={!textInput.trim() || isLoading} 
                      className="bg-primary hover:bg-primary-600 text-primary-foreground w-10 h-10 rounded-lg"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  /* Voice Mode */
                  <VoiceRecorder
                    onRecordingStart={onStartRecording}
                    onRecordingStop={onStopRecording}
                    onRecordingComplete={(audioBlob) => {
                      // Handle audio blob for future OpenAI integration
                      console.log('Audio recording completed:', audioBlob);
                    }}
                  />
                )}
              </div>
            </div>
          </>)}
      </div>
    </div>;
};
export default ModernChatInterface;