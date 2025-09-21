// Emergency audio stop button component for testing and emergency situations
import React from 'react';
import { Button } from './button';
import { Volume2, VolumeX } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface EmergencyStopProps {
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const EmergencyStop: React.FC<EmergencyStopProps> = ({ 
  className = '', 
  variant = 'destructive',
  size = 'sm'
}) => {
  const handleEmergencyStop = async () => {
    console.log('🚨 Emergency stop button clicked');
    
    try {
      // Stop all voice audio using the global function
      const { stopAllVoiceAudio } = await import('@/hooks/useTextToSpeech');
      stopAllVoiceAudio();
      
      // Also use the comprehensive emergency stop
      const { emergencyStopAllAudio } = await import('@/utils/audioControl');
      emergencyStopAllAudio();
      
      toast({
        title: "🔇 Audio Stopped",
        description: "All voice audio has been emergency stopped",
      });
      
      console.log('✅ Emergency stop completed');
    } catch (error) {
      console.error('❌ Emergency stop error:', error);
      toast({
        title: "Error",
        description: "Could not stop audio properly",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleEmergencyStop}
      className={`${className} flex items-center gap-1`}
      title="Emergency stop all voice audio"
    >
      <VolumeX className="h-4 w-4" />
      <span className="text-xs">Stop Audio</span>
    </Button>
  );
};

export default EmergencyStop;