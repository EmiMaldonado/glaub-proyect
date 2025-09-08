import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square } from 'lucide-react';

interface VoiceInputProps {
  onTranscription?: (text: string) => void;
  disabled?: boolean;
  showTestButton?: boolean;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ 
  onTranscription, 
  disabled = false, 
  showTestButton = false 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // 🆕 Estado para nivel de audio
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationRef = useRef<number>(0); // 🆕 Ref para la animación

  // 🆕 Efecto para la animación de grabación
  useEffect(() => {
    if (isRecording) {
      // Animación pulsante mientras graba
      const animate = () => {
        setAudioLevel(prev => (prev + 0.05) % 1); // Ciclo de 0 a 1
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      // Detener animación cuando no graba
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setAudioLevel(0);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      console.log('🎙️ Starting recording...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log('Audio chunk:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped');
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        console.log('Final audio blob:', audioBlob.size, 'bytes');
        
        // Detener los tracks del micrófono
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      console.log('✅ Recording started successfully');

    } catch (error) {
      console.error('❌ Error starting recording:', error);
      alert('Error accessing microphone: ' + error.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log('🛑 Recording stopped');
    }
  };

  const toggleRecording = () => {
    if (disabled) return;
    
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // 🆕 Calcular propiedades de la animación
  const pulseScale = 1 + (audioLevel * 0.3); // Escala de 1.0 a 1.3
  const pulseOpacity = 0.3 + (audioLevel * 0.4); // Opacidad de 0.3 a 0.7

  return (
    <div className="flex items-center gap-4 p-6 bg-white rounded-lg shadow-md">
      {/* 🆕 Contenedor del botón con animación */}
      <div className="relative">
        <Button
          onClick={toggleRecording}
          variant={isRecording ? 'destructive' : 'default'}
          size="lg"
          disabled={disabled}
          className="relative z-10 transition-all duration-200"
          style={{
            transform: `scale(${isRecording ? 1.05 : 1})`,
            boxShadow: isRecording ? '0 0 20px rgba(239, 68, 68, 0.4)' : 'none'
          }}
        >
          {isRecording ? (
            <Square className="h-5 w-5 animate-pulse" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
          {isRecording ? 'Detener' : 'Grabar'}
        </Button>

        {/* 🆕 Anillo de animación durante la grabación */}
        {isRecording && (
          <div
            className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"
            style={{
              animationDuration: '1.5s',
              transform: `scale(${pulseScale})`,
              opacity: pulseOpacity
            }}
          />
        )}
      </div>

      {/* 🆕 Indicador de estado visual */}
      <div className="flex items-center gap-2">
        {/* Punto indicador de estado */}
        <div
          className={`w-3 h-3 rounded-full transition-all duration-300 ${
            isRecording 
              ? 'bg-red-500 animate-pulse' 
              : 'bg-green-500'
          }`}
          style={{
            animation: isRecording ? 'pulse 1.5s infinite' : 'none'
          }}
        />
        
        {/* Texto de estado */}
        <span className="text-sm font-medium text-gray-700">
          {isRecording ? 'Grabando...' : 'Listo para grabar'}
        </span>
      </div>

      {/* 🆕 Barra de progreso de animación */}
      {isRecording && (
        <div className="w-20 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 transition-all duration-300"
            style={{
              width: `${audioLevel * 100}%`,
              animation: 'progressBar 2s ease-in-out infinite'
            }}
          />
        </div>
      )}

      {/* 🆕 Estilos CSS para animaciones */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 0.7; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(1.1); }
          }
          @keyframes progressBar {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
          .animate-ping {
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          }
          @keyframes ping {
            75%, 100% { transform: scale(2); opacity: 0; }
          }
        `}
      </style>
    </div>
  );
};

export default VoiceInput;