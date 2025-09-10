export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.audioContext = new AudioContext({
        sampleRate: 24000,
      });
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        this.onAudioData(new Float32Array(inputData));
      };
      
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const encodeAudioForAPI = (float32Array: Float32Array): string => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
};

const createWavFromPCM = (pcmData: Uint8Array): Uint8Array => {
  // Convert bytes to 16-bit samples
  const int16Data = new Int16Array(pcmData.length / 2);
  for (let i = 0; i < pcmData.length; i += 2) {
    int16Data[i / 2] = (pcmData[i + 1] << 8) | pcmData[i];
  }
  
  // Create WAV header
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // WAV header parameters
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;

  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + int16Data.byteLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, int16Data.byteLength, true);

  // Combine header and data
  const wavArray = new Uint8Array(wavHeader.byteLength + int16Data.byteLength);
  wavArray.set(new Uint8Array(wavHeader), 0);
  wavArray.set(new Uint8Array(int16Data.buffer), wavHeader.byteLength);
  
  return wavArray;
};

class AudioQueue {
  private queue: Uint8Array[] = [];
  private isPlaying = false;
  private audioContext: AudioContext;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  async addToQueue(audioData: Uint8Array) {
    this.queue.push(audioData);
    if (!this.isPlaying) {
      await this.playNext();
    }
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioData = this.queue.shift()!;

    try {
      const wavData = createWavFromPCM(audioData);
      const audioBuffer = await this.audioContext.decodeAudioData(wavData.buffer);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      source.onended = () => this.playNext();
      source.start(0);
    } catch (error) {
      console.error('Error playing audio:', error);
      this.playNext(); // Continue with next segment even if current fails
    }
  }

  clear() {
    this.queue = [];
    this.isPlaying = false;
  }
}

let audioQueueInstance: AudioQueue | null = null;

export const playAudioData = async (audioContext: AudioContext, audioData: Uint8Array) => {
  if (!audioQueueInstance) {
    audioQueueInstance = new AudioQueue(audioContext);
  }
  await audioQueueInstance.addToQueue(audioData);
};

export const clearAudioQueue = () => {
  if (audioQueueInstance) {
    audioQueueInstance.clear();
  }
};

export interface RealtimeMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  audioTranscript?: string;
}

export class RealtimeChat {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private recorder: AudioRecorder | null = null;
  private isConnected = false;
  private currentTranscript = '';
  private currentResponse = '';

  constructor(
    private onMessage: (message: RealtimeMessage) => void,
    private onSpeakingChange: (speaking: boolean) => void,
    private onConnectionChange: (connected: boolean) => void,
    private onTranscriptUpdate: (transcript: string) => void
  ) {}

  async connect() {
    try {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      
      // Connect to our Supabase Edge Function
      const wsUrl = `wss://bmrifufykczudfxomenr.functions.supabase.co/realtime-chat`;
      console.log('Connecting to:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.onConnectionChange(true);
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received event:', data.type);
          
          await this.handleRealtimeEvent(data);
        } catch (error) {
          console.error('Error handling message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onConnectionChange(false);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.isConnected = false;
        this.onConnectionChange(false);
        this.cleanup();
      };

      // Start audio recording
      this.recorder = new AudioRecorder((audioData) => {
        if (this.isConnected && this.ws) {
          const encodedAudio = encodeAudioForAPI(audioData);
          this.ws.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: encodedAudio
          }));
        }
      });

      await this.recorder.start();
      console.log('Audio recording started');

    } catch (error) {
      console.error('Error connecting:', error);
      throw error;
    }
  }

  private async handleRealtimeEvent(data: any) {
    switch (data.type) {
      case 'session.created':
        console.log('Session created');
        break;

      case 'session.updated':
        console.log('Session updated');
        break;

      case 'input_audio_buffer.speech_started':
        console.log('Speech started');
        this.currentTranscript = '';
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('Speech stopped');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        console.log('Transcription completed:', data.transcript);
        this.currentTranscript = data.transcript;
        this.onTranscriptUpdate(data.transcript);
        
        // Add user message
        this.onMessage({
          id: data.item_id,
          type: 'user',
          content: data.transcript,
          timestamp: new Date().toISOString(),
          audioTranscript: data.transcript
        });
        break;

      case 'response.created':
        console.log('Response created');
        this.currentResponse = '';
        break;

      case 'response.output_item.added':
        console.log('Output item added');
        break;

      case 'response.content_part.added':
        console.log('Content part added');
        break;

      case 'response.audio_transcript.delta':
        this.currentResponse += data.delta;
        this.onTranscriptUpdate(this.currentResponse);
        break;

      case 'response.audio_transcript.done':
        console.log('Audio transcript done:', this.currentResponse);
        
        // Add assistant message
        this.onMessage({
          id: data.item_id,
          type: 'assistant',
          content: this.currentResponse,
          timestamp: new Date().toISOString(),
          audioTranscript: this.currentResponse
        });
        break;

      case 'response.audio.delta':
        if (this.audioContext && data.delta) {
          try {
            const binaryString = atob(data.delta);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            await playAudioData(this.audioContext, bytes);
            this.onSpeakingChange(true);
          } catch (error) {
            console.error('Error playing audio:', error);
          }
        }
        break;

      case 'response.audio.done':
        console.log('Audio response done');
        this.onSpeakingChange(false);
        break;

      case 'response.done':
        console.log('Response completed');
        this.onSpeakingChange(false);
        break;

      case 'error':
        console.error('OpenAI error:', data);
        break;

      case 'connection_closed':
        console.log('OpenAI connection closed:', data.reason);
        break;
    }
  }

  sendTextMessage(text: string) {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected');
    }

    const event = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text
          }
        ]
      }
    };

    this.ws.send(JSON.stringify(event));
    this.ws.send(JSON.stringify({ type: 'response.create' }));

    // Add user message immediately
    this.onMessage({
      id: `user-${Date.now()}`,
      type: 'user',
      content: text,
      timestamp: new Date().toISOString()
    });
  }

  disconnect() {
    console.log('Disconnecting...');
    this.isConnected = false;
    this.cleanup();
  }

  private cleanup() {
    if (this.recorder) {
      this.recorder.stop();
      this.recorder = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    clearAudioQueue();
    this.onSpeakingChange(false);
  }
}