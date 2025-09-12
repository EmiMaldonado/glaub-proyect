import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, AlertCircle, RefreshCw, Volume2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export type PermissionState = 'checking' | 'granted' | 'denied' | 'prompt' | 'unsupported' | 'testing';

interface MicrophonePermissionProps {
  onPermissionGranted: (stream: MediaStream) => void;
  onPermissionDenied: () => void;
  children?: React.ReactNode;
}

interface AudioLevelDisplayProps {
  audioLevel: number;
}

const AudioLevelDisplay: React.FC<AudioLevelDisplayProps> = ({ audioLevel }) => {
  const bars = Array.from({ length: 5 }, (_, i) => {
    const threshold = (i + 1) * 0.2;
    const isActive = audioLevel > threshold;
    return (
      <div
        key={i}
        className={`w-1 transition-all duration-150 ${
          isActive ? 'bg-green-500 h-8' : 'bg-gray-300 h-2'
        }`}
      />
    );
  });

  return (
    <div className="flex items-end space-x-1 h-8">
      {bars}
    </div>
  );
};

const MicrophonePermission: React.FC<MicrophonePermissionProps> = ({
  onPermissionGranted,
  onPermissionDenied,
  children
}) => {
  const [permissionState, setPermissionState] = useState<PermissionState>('checking');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTestingMicrophone, setIsTestingMicrophone] = useState(false);

  // Check browser compatibility
  const checkBrowserSupport = useCallback(() => {
    console.log('Checking browser support for microphone...');
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('getUserMedia not supported by browser');
      setPermissionState('unsupported');
      return false;
    }
    
    if (!window.WebSocket) {
      console.error('WebSocket not supported by browser');
      setPermissionState('unsupported');
      return false;
    }
    
    console.log('Browser supports required features');
    return true;
  }, []);

  // Monitor audio level for visual feedback
  const monitorAudioLevel = useCallback((mediaStream: MediaStream) => {
    try {
      const audioContext = new AudioContext({ sampleRate: 24000 });
      const source = audioContext.createMediaStreamSource(mediaStream);
      const analyser = audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const normalized = Math.min(average / 128, 1);
        setAudioLevel(normalized);
        
        if (mediaStream.active) {
          requestAnimationFrame(updateAudioLevel);
        }
      };
      
      updateAudioLevel();
      console.log('Audio level monitoring started');
      
      return () => {
        audioContext.close();
      };
    } catch (error) {
      console.error('Error setting up audio level monitoring:', error);
    }
  }, []);

  // Request microphone permission
  const requestMicrophonePermission = useCallback(async () => {
    console.log('Requesting microphone permission...');
    setPermissionState('prompt');
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('Microphone permission granted');
      setStream(mediaStream);
      setPermissionState('testing');
      setIsTestingMicrophone(true);
      
      // Monitor audio levels
      monitorAudioLevel(mediaStream);
      
      // Test microphone for 2 seconds
      setTimeout(() => {
        setIsTestingMicrophone(false);
        setPermissionState('granted');
        console.log('Microphone test completed successfully');
        
        toast({
          title: "🎤 Micrófono listo",
          description: "Micrófono configurado correctamente",
        });
        
        onPermissionGranted(mediaStream);
      }, 2000);
      
    } catch (error: any) {
      console.error('Microphone permission error:', error);
      setPermissionState('denied');
      
      let errorMessage = "No se pudo acceder al micrófono";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Permiso de micrófono denegado. Por favor, habilítalo en la configuración del navegador.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "No se encontró micrófono. Conecta un micrófono e inténtalo de nuevo.";
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "Micrófono no compatible con este dispositivo.";
      }
      
      toast({
        title: "Error de micrófono",
        description: errorMessage,
        variant: "destructive",
      });
      
      onPermissionDenied();
    }
  }, [onPermissionGranted, onPermissionDenied, monitorAudioLevel]);

  // Retry permission request
  const retryPermission = useCallback(() => {
    console.log('Retrying microphone permission...');
    requestMicrophonePermission();
  }, [requestMicrophonePermission]);

  // Check permissions on mount
  useEffect(() => {
    console.log('Initializing microphone permission component...');
    
    if (!checkBrowserSupport()) {
      return;
    }
    
    // Check if we already have permission
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then((result) => {
          console.log('Current microphone permission state:', result.state);
          
          if (result.state === 'granted') {
            // Already granted, request stream directly
            requestMicrophonePermission();
          } else if (result.state === 'denied') {
            setPermissionState('denied');
          } else {
            setPermissionState('prompt');
          }
        })
        .catch(() => {
          // Fallback if permissions query not supported
          setPermissionState('prompt');
        });
    } else {
      setPermissionState('prompt');
    }
  }, [checkBrowserSupport, requestMicrophonePermission]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('Microphone stream track stopped');
        });
      }
    };
  }, [stream]);

  // Render permission states
  const renderPermissionState = () => {
    switch (permissionState) {
      case 'checking':
        return (
          <div className="text-center space-y-4">
            <div className="animate-spin">
              <RefreshCw className="w-8 h-8 mx-auto text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Verificando permisos de micrófono...</p>
          </div>
        );

      case 'unsupported':
        return (
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
            <div>
              <h3 className="font-medium text-red-600">Navegador no compatible</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Tu navegador no soporta conversaciones de voz. 
                Usa Chrome, Safari o Firefox actualizado.
              </p>
            </div>
          </div>
        );

      case 'prompt':
        return (
          <div className="text-center space-y-4">
            <Mic className="w-12 h-12 mx-auto text-primary" />
            <div>
              <h3 className="font-medium">Permitir acceso al micrófono</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Necesitamos acceso a tu micrófono para la conversación de voz
              </p>
            </div>
            <Button 
              onClick={requestMicrophonePermission}
              className="w-full"
            >
              <Mic className="w-4 h-4 mr-2" />
              Permitir Micrófono
            </Button>
          </div>
        );

      case 'testing':
        return (
          <div className="text-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 mx-auto bg-yellow-100 rounded-full flex items-center justify-center">
                <Volume2 className="w-8 h-8 text-yellow-600 animate-pulse" />
              </div>
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                <AudioLevelDisplay audioLevel={audioLevel} />
              </div>
            </div>
            <div>
              <h3 className="font-medium text-yellow-600">Probando micrófono...</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isTestingMicrophone ? 'Di algo para probar el audio' : 'Configurando...'}
              </p>
            </div>
          </div>
        );

      case 'denied':
        return (
          <div className="text-center space-y-4">
            <MicOff className="w-12 h-12 mx-auto text-red-500" />
            <div>
              <h3 className="font-medium text-red-600">Acceso denegado</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Para usar conversaciones de voz, habilita el micrófono en la configuración del navegador
              </p>
            </div>
            <div className="space-y-2">
              <Button 
                onClick={retryPermission}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Intentar de nuevo
              </Button>
              <div className="text-xs text-muted-foreground">
                Chrome: Configuración → Privacidad → Micrófono<br />
                Safari: Sitio web → Micrófono → Permitir
              </div>
            </div>
          </div>
        );

      case 'granted':
        return (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-3">
                <Mic className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm font-medium text-green-600">Micrófono configurado</p>
              <div className="mt-2">
                <AudioLevelDisplay audioLevel={audioLevel} />
              </div>
            </div>
            {children}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {renderPermissionState()}
    </div>
  );
};

export default MicrophonePermission;