'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { getVoiceWebSocketUrl } from '@/lib/api';

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking';

interface UseVoiceChatOptions {
  onTranscript: (text: string) => void;
  onAssistantMessage: (text: string) => void;
  provider?: string;
  model?: string;
  language?: string;
  systemPrompt?: string;
}

interface UseVoiceChatReturn {
  voiceEnabled: boolean;
  voiceState: VoiceState;
  transcript: string;
  toggleVoice: () => void;
}

/** Audio playback queue: plays WAV blobs sequentially */
class AudioPlaybackQueue {
  private queue: AudioBuffer[] = [];
  private playing = false;
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private onStartPlaying?: () => void;
  private onStopPlaying?: () => void;

  constructor(
    onStartPlaying?: () => void,
    onStopPlaying?: () => void
  ) {
    this.onStartPlaying = onStartPlaying;
    this.onStopPlaying = onStopPlaying;
  }

  private getContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  async enqueue(blob: Blob) {
    const ctx = this.getContext();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    this.queue.push(audioBuffer);
    if (!this.playing) {
      this.playNext();
    }
  }

  async enqueueBuffer(buffer: ArrayBuffer) {
    const ctx = this.getContext();
    const audioBuffer = await ctx.decodeAudioData(buffer);
    this.queue.push(audioBuffer);
    if (!this.playing) {
      this.playNext();
    }
  }

  private playNext() {
    if (this.queue.length === 0) {
      this.playing = false;
      this.onStopPlaying?.();
      return;
    }

    if (!this.playing) {
      this.onStartPlaying?.();
    }
    this.playing = true;

    const ctx = this.getContext();
    const buffer = this.queue.shift()!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    this.currentSource = source;

    source.onended = () => {
      this.currentSource = null;
      this.playNext();
    };

    source.start();
  }

  stop() {
    this.queue = [];
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Already stopped
      }
      this.currentSource = null;
    }
    this.playing = false;
    this.onStopPlaying?.();
  }

  isPlaying() {
    return this.playing;
  }

  async destroy() {
    this.stop();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
    this.audioContext = null;
  }
}

export function useVoiceChat({
  onTranscript,
  onAssistantMessage,
  provider,
  model,
  language,
  systemPrompt,
}: UseVoiceChatOptions): UseVoiceChatReturn {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vadRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const playbackQueueRef = useRef<AudioPlaybackQueue | null>(null);
  const enabledRef = useRef(false);
  const accumulatedTextRef = useRef('');

  // Keep enabledRef in sync
  useEffect(() => {
    enabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  // Send interrupt when user speaks while AI is playing
  const interrupt = useCallback(() => {
    playbackQueueRef.current?.stop();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }
  }, []);

  // Initialize or destroy VAD + WebSocket
  useEffect(() => {
    if (!voiceEnabled) {
      // Cleanup
      if (vadRef.current) {
        vadRef.current.destroy();
        vadRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      playbackQueueRef.current?.destroy();
      playbackQueueRef.current = null;
      setVoiceState('idle');
      return;
    }

    let cancelled = false;

    async function initVoice() {
      try {
        const { MicVAD } = await import('@ricky0123/vad-web');

        if (cancelled) return;

        // Create playback queue
        playbackQueueRef.current = new AudioPlaybackQueue(
          () => {
            if (enabledRef.current) setVoiceState('speaking');
          },
          () => {
            if (enabledRef.current) setVoiceState('listening');
          }
        );

        // Open WebSocket
        const wsUrl = getVoiceWebSocketUrl();
        const ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
          // Send config message
          ws.send(JSON.stringify({
            type: 'config',
            provider: provider || undefined,
            model: model || undefined,
            language: language || undefined,
            system_prompt: systemPrompt || undefined,
          }));
        };

        ws.onmessage = (event) => {
          if (!enabledRef.current) return;

          if (event.data instanceof ArrayBuffer) {
            // Binary frame = WAV audio from TTS
            playbackQueueRef.current?.enqueueBuffer(event.data);
            return;
          }

          // Text frame = JSON event
          try {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
              case 'transcript':
                setTranscript(msg.text || '');
                onTranscript(msg.text || '');
                setVoiceState('thinking');
                break;
              case 'llm_token':
                accumulatedTextRef.current += msg.content || '';
                break;
              case 'tts_start':
                setVoiceState('speaking');
                break;
              case 'done':
                if (accumulatedTextRef.current) {
                  onAssistantMessage(accumulatedTextRef.current);
                  accumulatedTextRef.current = '';
                }
                if (!playbackQueueRef.current?.isPlaying()) {
                  setVoiceState('listening');
                }
                break;
              case 'error':
                toast.error(msg.message || 'Erreur du pipeline vocal');
                setVoiceState('listening');
                accumulatedTextRef.current = '';
                break;
            }
          } catch {
            // Non-JSON text frame, ignore
          }
        };

        ws.onerror = () => {
          // WebSocket error
        };

        ws.onclose = () => {
          if (enabledRef.current && !cancelled) {
            toast.error('Connexion vocale perdue');
            setVoiceEnabled(false);
          }
        };

        wsRef.current = ws;

        if (cancelled) {
          ws.close();
          return;
        }

        // Initialize VAD
        const vad = await MicVAD.new({
          baseAssetPath: '/vad/',
          onnxWASMBasePath: '/vad/',
          model: 'v5',
          startOnLoad: true,

          onSpeechStart: () => {
            if (!enabledRef.current) return;

            // If the AI is speaking, interrupt
            if (playbackQueueRef.current?.isPlaying()) {
              interrupt();
            }

            setVoiceState('listening');
          },

          onFrameProcessed: (probs: { isSpeech: number }, frame: Float32Array) => {
            if (!enabledRef.current) return;
            if (probs.isSpeech < 0.5) return;

            // Send raw PCM f32le as binary frame
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(frame.buffer);
            }
          },

          onSpeechEnd: () => {
            if (!enabledRef.current) return;

            setVoiceState('transcribing');

            // Signal end of speech to server
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'speech_end' }));
            }
          },

          onVADMisfire: () => {
            if (enabledRef.current) {
              setVoiceState('listening');
            }
          },
        });

        if (cancelled) {
          vad.destroy();
          ws.close();
          return;
        }

        vadRef.current = vad;
        setVoiceState('listening');
        toast.success('Mode vocal active');
      } catch (err) {
        toast.error(
          'Impossible d\'activer le micro : ' +
            (err instanceof Error ? err.message : String(err))
        );
        setVoiceEnabled(false);
        setVoiceState('idle');
      }
    }

    initVoice();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceEnabled]);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => !prev);
  }, []);

  return {
    voiceEnabled,
    voiceState,
    transcript,
    toggleVoice,
  };
}
