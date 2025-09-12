import { useState, useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

interface UseConversationTimerOptions {
  maxDurationMinutes?: number;
  onTimeWarning?: () => void;
  onTimeUp?: () => void;
  warningAtMinutes?: number;
}

export const useConversationTimer = ({
  maxDurationMinutes = 5,
  onTimeWarning,
  onTimeUp,
  warningAtMinutes = 4
}: UseConversationTimerOptions = {}) => {
  const [sessionTime, setSessionTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [hasWarned, setHasWarned] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();

  const maxSeconds = maxDurationMinutes * 60;
  const warningSeconds = warningAtMinutes * 60;

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setSessionTime(prev => {
          const newTime = prev + 1;
          
          // Show warning
          if (newTime >= warningSeconds && !hasWarned) {
            setHasWarned(true);
            onTimeWarning?.();
            toast({
              title: "⏰ Tiempo casi agotado",
              description: `Te queda ${maxDurationMinutes - warningAtMinutes} minuto de conversación`,
            });
          }
          
          // Time's up
          if (newTime >= maxSeconds) {
            setIsActive(false);
            onTimeUp?.();
            toast({
              title: "⏰ Tiempo agotado",
              description: "The conversation session has ended",
              variant: "destructive",
            });
            return prev;
          }
          
          return newTime;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, hasWarned, maxSeconds, warningSeconds, onTimeWarning, onTimeUp, maxDurationMinutes, warningAtMinutes]);

  const start = () => setIsActive(true);
  const pause = () => setIsActive(false);
  const reset = () => {
    setSessionTime(0);
    setIsActive(false);
    setHasWarned(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeRemaining = () => Math.max(0, maxSeconds - sessionTime);
  const getMinutesElapsed = () => Math.floor(sessionTime / 60);
  const getProgressPercentage = () => (sessionTime / maxSeconds) * 100;

  return {
    sessionTime,
    timeRemaining: getTimeRemaining(),
    minutesElapsed: getMinutesElapsed(),
    progressPercentage: getProgressPercentage(),
    isActive,
    hasWarned,
    start,
    pause,
    reset,
    formatTime,
    formattedTime: formatTime(sessionTime),
    formattedTimeRemaining: formatTime(getTimeRemaining()),
  };
};