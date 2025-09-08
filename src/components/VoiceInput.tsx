import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square } from 'lucide-react';

const VoiceInput: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex items-center gap-2 p-4">
      <Button
        onClick={toggleRecording}
        variant={isRecording ? 'destructive' : 'default'}
        size="lg"
      >
        {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </Button>
      
      <div className="text-sm text-gray-600">
        Status: {isRecording ? 'Recording...' : 'Ready'}
      </div>
    </div>
  );
};

export default VoiceInput;