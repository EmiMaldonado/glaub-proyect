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

const SessionRestoration: React.FC<SessionRestorationProps> = ({
  onRestore,
  onDismiss
}) => {
  const { user } = useAuth();
  const { loadSessionFromLocal, hasActiveSession, conversation, messages } = useSessionManager();
  const navigate = useNavigate();
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{
    messageCount: number;
    lastActivity: string;
    conversationTitle: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;

    // Check for restorable session
    const session = loadSessionFromLocal();
    if (session && session.conversation && session.messages.length > 0) {
      setSessionInfo({
        messageCount: session.messages.length,
        lastActivity: session.lastActivity,
        conversationTitle: session.conversation.title
      });
      setShowRestorePrompt(true);
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

  const timeSinceActivity = new Date().getTime() - new Date(sessionInfo.lastActivity).getTime();
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