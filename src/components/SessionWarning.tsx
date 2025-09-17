import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SessionWarningProps {
  timeRemaining: number; // in minutes
  onExtend?: () => void;
  onSave?: () => void;
}

const SessionWarning: React.FC<SessionWarningProps> = ({
  timeRemaining,
  onExtend,
  onSave
}) => {
  const formatTime = (minutes: number) => {
    if (minutes < 1) return 'less than 1 minute';
    if (minutes === 1) return '1 minute';
    return `${Math.floor(minutes)} minutes`;
  };

  const getVariant = (): "default" | "destructive" => {
    if (timeRemaining <= 5) return 'destructive';
    return 'default';
  };

  if (timeRemaining > 10) return null;

  return (
    <Alert variant={getVariant()} className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4" />
          <span>
            Session expires in {formatTime(timeRemaining)}. 
            {timeRemaining <= 5 && ' Your progress will be auto-saved.'}
          </span>
        </div>
        {onExtend && timeRemaining > 2 && (
          <button
            onClick={onExtend}
            className="text-sm underline hover:no-underline"
          >
            Extend session
          </button>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default SessionWarning;