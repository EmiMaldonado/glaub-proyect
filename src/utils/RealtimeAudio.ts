export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
      console.log('[AudioRecorder] Starting recording...');
      
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
      
      console.log('[AudioRecorder] Recording started successfully');
    } catch (error) {
      console.error('[AudioRecorder] Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    console.log('[AudioRecorder] Stopping recording...');
    
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
    
    console.log('[AudioRecorder] Recording stopped');
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
    // Little endian byte order
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
  const dataSize = int16Data.byteLength;

  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
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
  view.setUint32(40, dataSize, true);

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
      console.error('[AudioQueue] Error playing audio:', error);
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

export class RealtimeChat {
  private ws: WebSocket | null = null;
  private audioRecorder: AudioRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private onMessage: (message: any) => void;
  private onConnectionChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

  constructor(
    onMessage: (message: any) => void,
    onConnectionChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void
  ) {
    this.onMessage = onMessage;
    this.onConnectionChange = onConnectionChange;
  }

  async connect() {
    try {
      console.log('[RealtimeChat] Connecting to realtime chat...');
      this.onConnectionChange('connecting');

      // Initialize audio context
      this.audioContext = new AudioContext({ sampleRate: 24000 });

      // Connect to WebSocket
      this.ws = new WebSocket('wss://bmrifufykczudfxomenr.functions.supabase.co/realtime-chat');

      this.ws.onopen = () => {
        console.log('[RealtimeChat] WebSocket connected');
        this.onConnectionChange('connected');
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[RealtimeChat] Received message:', data.type);

          if (data.type === 'response.audio.delta' && data.delta) {
            // Play audio data
            const binaryString = atob(data.delta);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            if (this.audioContext) {
              await playAudioData(this.audioContext, bytes);
            }
          }

          this.onMessage(data);
        } catch (error) {
          console.error('[RealtimeChat] Error processing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[RealtimeChat] WebSocket error:', error);
        this.onConnectionChange('error');
      };

      this.ws.onclose = () => {
        console.log('[RealtimeChat] WebSocket closed');
        this.onConnectionChange('disconnected');
      };

      // Start audio recording
      this.audioRecorder = new AudioRecorder((audioData) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const encoded = encodeAudioForAPI(audioData);
          this.ws.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: encoded
          }));
        }
      });

      await this.audioRecorder.start();

    } catch (error) {
      console.error('[RealtimeChat] Connection error:', error);
      this.onConnectionChange('error');
      throw error;
    }
  }

  sendMessage(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
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
  }

  disconnect() {
    console.log('[RealtimeChat] Disconnecting...');
    
    if (this.audioRecorder) {
      this.audioRecorder.stop();
      this.audioRecorder = null;
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
    this.onConnectionChange('disconnected');
  }
}