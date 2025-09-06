import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from './use-toast';

export const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string, voice: 'alloy' | 'echo' | 'fable' | 'nova' | 'shimmer' = 'alloy') => {
    if (!text.trim()) return;

    try {
      setIsLoading(true);

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      console.log('TTS request:', { text: text.substring(0, 100) + '...', voice });

      const response = await supabase.functions.invoke('text-to-speech', {
        body: { text, voice }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const { audioContent } = response.data;

      // Convert base64 to audio blob
      const binaryString = atob(audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create and play audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onloadstart = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        toast({
          title: "Error de reproducción",
          description: "No se pudo reproducir el audio",
          variant: "destructive",
        });
      };

      await audio.play();
      console.log('TTS playback started');

    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
      toast({
        title: "Error de síntesis de voz",
        description: "No se pudo convertir el texto a voz",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsSpeaking(false);
    }
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    isLoading
  };
};