export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start(existingStream?: MediaStream) {
    try {
      // Use existing stream if provided, otherwise request new one
      if (existingStream) {
        console.log('Using existing microphone stream');
        this.stream = existingStream;
      } else {
        console.log('Requesting new microphone stream...');
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 24000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        console.log('New microphone stream acquired');
      }
      
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
      if (error.name === 'NotAllowedError') {
        throw new Error('Microphone access denied. Please allow microphone permissions.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No microphone found. Please connect a microphone.');
      }
      throw new Error(`Microphone error: ${error.message}`);
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

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'retrying' | 'disconnected';

export class RealtimeChat {
  private ws: WebSocket | null = null;
  private audioRecorder: AudioRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private onMessage: (message: any) => void;
  private onConnectionChange: (status: ConnectionStatus) => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number | null = null;
  private connectionTimeout: number | null = null;
  private isConnecting = false;

  constructor(
    onMessage: (message: any) => void,
    onConnectionChange: (status: ConnectionStatus) => void
  ) {
    this.onMessage = onMessage;
    this.onConnectionChange = onConnectionChange;
  }

  private getBackoffDelay(): number {
    return Math.min(1000 * Math.pow(2, this.reconnectAttempts), 8000);
  }

  private clearTimeouts() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  async connect(existingStream?: MediaStream) {
    if (this.isConnecting) return;
    
    this.isConnecting = true;
    this.clearTimeouts();
    
    try {
      this.onConnectionChange('connecting');

      // Check browser compatibility
      if (!window.WebSocket) {
        throw new Error('WebSocket not supported by browser');
      }

      // Initialize audio context first
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      
      // Skip permission check if stream provided (already handled by MicrophonePermission component)
      if (!existingStream) {
        console.log('No existing stream provided, checking microphone permissions...');
        try {
          const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          testStream.getTracks().forEach(track => track.stop()); // Clean up test stream
          console.log('Microphone permissions verified');
        } catch (error) {
          if (error.name === 'NotAllowedError') {
            throw new Error('Microphone permission required for voice chat');
          }
          throw error;
        }
      } else {
        console.log('Using provided microphone stream, skipping permission check');
      }

      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
          this.handleConnectionError(new Error('Connection timeout'));
        }
      }, 30000) as any;

      // Connect to WebSocket
      const wsUrl = `wss://bmrifufykczudfxomenr.functions.supabase.co/realtime-chat`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.clearTimeouts();
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.onConnectionChange('connected');
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

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
          // Silently handle message parsing errors
        }
      };

      this.ws.onerror = () => {
        this.handleConnectionError(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.clearTimeouts();
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          this.onConnectionChange('error');
          this.onMessage({
            type: 'error',
            error: 'Unable to establish voice connection after multiple attempts'
          });
        }
      };

      // Start audio recording after WebSocket is established
      this.audioRecorder = new AudioRecorder((audioData) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const encoded = encodeAudioForAPI(audioData);
          this.ws.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: encoded
          }));
        }
      });

      await this.audioRecorder.start(existingStream);

    } catch (error) {
      this.isConnecting = false;
      this.handleConnectionError(error as Error);
    }
  }

  private handleConnectionError(error: Error) {
    this.clearTimeouts();
    this.isConnecting = false;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      this.onConnectionChange('error');
      this.onMessage({
        type: 'error',
        error: error.message || 'Connection failed'
      });
    }
  }

  private scheduleReconnect() {
    this.onConnectionChange('retrying');
    this.reconnectAttempts++;
    
    const delay = this.getBackoffDelay();
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay) as any;
  }

  sendMessage(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Voice connection not ready');
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
    this.clearTimeouts();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
    
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