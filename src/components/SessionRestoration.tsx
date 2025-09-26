import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionManager } from '@/hooks/useSessionManager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MessageCircle, Play, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SessionRestorationProps {
  onRestore?: () => void;
  onDismiss?: () => void;
}

interface SessionInfo {
  messageCount: number;
  lastActivity: number;
  conversationTitle: string;
}

const SessionRestoration: React.FC<SessionRestorationProps> = ({
  onRestore,
  onDismiss
}) => {
  const { user } = useAuth();
  const { loadSessionFromLocal, hasActiveSession } = useSessionManager();
  const navigate = useNavigate();
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  useEffect(() => {
    if (!user) return;
    
    // Check for restorable session
    try {
      // ✅ LLAMADA CORRECTA A loadSessionFromLocal
      const sessionData = loadSessionFromLocal();
      
      // ✅ VERIFICACIÓN SEGURA DE TIPO
      if (sessionData && 
          typeof sessionData === 'object' && 
          'conversation' in sessionData && 
          'messages' in sessionData &&
          'lastActivity' in sessionData) {
        
        setSessionInfo({
          messageCount: Array.isArray(sessionData.messages) ? sessionData.messages.length : 0,
          lastActivity: typeof sessionData.lastActivity === 'number' ? sessionData.lastActivity : Date.now(),
          conversationTitle: sessionData.conversation?.title || 'Conversation'
        });
        setShowRestorePrompt(true);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  }, [user, loadSessionFromLocal]);

  const handleRestore = () => {
    setShowRestorePrompt(false);
    navigate('/conversation/chat');
    onRestore?.();
  };

  const handleDismiss = () => {
    setShowRestorePrompt(false);
    onDismiss?.();
  };

  if (!showRestorePrompt || !sessionInfo || hasActiveSession) {
    return null;
  }

  const timeSinceActivity = new Date().getTime() - sessionInfo.lastActivity;
  const minutesAgo = Math.floor(timeSinceActivity / 60000);
  const hoursAgo = Math.floor(minutesAgo / 60);

  const formatTimeAgo = () => {
    if (minutesAgo < 1) return 'just now';
    if (minutesAgo < 60) return `${minutesAgo} minutes ago`;
    if (hoursAgo < 24) return `${hoursAgo} hours ago`;
    return new Date(sessionInfo.lastActivity).toLocaleDateString();
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm font-medium">Continue Previous Session</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          You have an unfinished conversation from {formatTimeAgo()}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <MessageCircle className="h-4 w-4" />
              <span>{sessionInfo.messageCount} messages</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>{formatTimeAgo()}</span>
            </div>
          </div>
          <Button onClick={handleRestore} size="sm" className="flex items-center space-x-1">
            <Play className="h-4 w-4" />
            <span>Continue</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SessionRestoration;