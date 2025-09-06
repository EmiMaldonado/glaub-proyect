import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface VoiceInputProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscription, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: "🎙️ Grabando",
        description: "Habla ahora, presiona el botón para terminar",
      });
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Error",
        description: "No se pudo acceder al micrófono. Verifica los permisos.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64Audio = btoa(String.fromCharCode(...uint8Array));

      console.log('Sending audio for transcription:', { sizeKB: Math.round(audioBlob.size / 1024) });

      // Send to speech-to-text function
      const response = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { text } = response.data;
      
      if (text && text.trim()) {
        console.log('Transcription received:', text);
        onTranscription(text.trim());
        toast({
          title: "✅ Transcripción completada",
          description: "Tu mensaje de voz se ha convertido a texto",
        });
      } else {
        toast({
          title: "No se detectó audio",
          description: "Intenta hablar más fuerte o acércate al micrófono",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        title: "Error de transcripción",
        description: "No se pudo procesar el audio. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <Button
      type="button"
      onClick={toggleRecording}
      disabled={disabled || isProcessing}
      variant={isRecording ? "destructive" : "outline"}
      size="icon"
      className="shrink-0"
    >
      {isProcessing ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : isRecording ? (
        <Square className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
};

export default VoiceInput;