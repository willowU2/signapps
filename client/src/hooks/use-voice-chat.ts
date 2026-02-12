'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking';

interface UseVoiceChatOptions {
  onTranscript: (text: string) => void;
  abortControllerRef: React.RefObject<AbortController | null>;
  getStreamingText: () => string;
  isLoading: boolean;
}

interface UseVoiceChatReturn {
  voiceEnabled: boolean;
  voiceState: VoiceState;
  transcript: string;
  toggleVoice: () => void;
}

const MEDIA_URL =
  process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:3009/api/v1';

/** Convert Float32Array (PCM 16kHz mono) to WAV blob */
function float32ToWavBlob(float32: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = float32.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/** Split streaming text into sentences for TTS */
class SentenceSplitter {
  private buffer = '';
  private flushed = 0;

  /** Feed new text, returns complete sentences ready for TTS */
  feed(fullText: string): string[] {
    const newText = fullText.slice(this.flushed);
    this.buffer += newText;
    this.flushed = fullText.length;

    const sentences: string[] = [];
    // Match sentence-ending punctuation
    const regex = /[^.!?\n]*[.!?\n]/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = regex.exec(this.buffer)) !== null) {
      const sentence = match[0].trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      lastIndex = regex.lastIndex;
    }

    // For long buffers without punctuation, split on comma/colon after 100+ chars
    const remaining = this.buffer.slice(lastIndex);
    if (remaining.length > 100) {
      const splitMatch = remaining.match(/^(.{50,}?[,:;])\s/);
      if (splitMatch) {
        sentences.push(splitMatch[1].trim());
        this.buffer = remaining.slice(splitMatch[0].length);
        return sentences;
      }
    }

    this.buffer = this.buffer.slice(lastIndex);
    return sentences;
  }

  /** Flush any remaining text as a final sentence */
  flush(): string | null {
    const remaining = this.buffer.trim();
    this.buffer = '';
    this.flushed = 0;
    return remaining.length > 0 ? remaining : null;
  }

  reset() {
    this.buffer = '';
    this.flushed = 0;
  }
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

  private playNext() {
    if (this.queue.length === 0) {
      this.playing = false;
      this.onStopPlaying?.();
      return;
    }

    this.playing = true;
    if (this.queue.length === this.queue.length) {
      // First item starting
      this.onStartPlaying?.();
    }

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

/** Fetch TTS for a sentence */
async function synthesizeSpeech(
  text: string,
  signal?: AbortSignal
): Promise<Blob> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token')
      : null;

  const response = await fetch(`${MEDIA_URL}/tts/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      text,
      voice: 'fr_FR-siwis-medium',
      format: 'wav',
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`TTS error: ${response.status}`);
  }

  return response.blob();
}

/** Transcribe audio via STT */
async function transcribeAudio(blob: Blob): Promise<string> {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('access_token')
      : null;

  const formData = new FormData();
  formData.append('file', blob, 'recording.wav');

  const response = await fetch(`${MEDIA_URL}/stt/transcribe`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`STT error: ${response.status}`);
  }

  const data = await response.json();
  return data.text || '';
}

export function useVoiceChat({
  onTranscript,
  abortControllerRef,
  getStreamingText,
  isLoading,
}: UseVoiceChatOptions): UseVoiceChatReturn {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');

  // MicVAD has a private constructor so we can't use InstanceType; use the
  // return type of MicVAD.new() instead (Awaited<ReturnType<...>>).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vadRef = useRef<any>(null);
  const playbackQueueRef = useRef<AudioPlaybackQueue | null>(null);
  const splitterRef = useRef<SentenceSplitter>(new SentenceSplitter());
  const ttsAbortRef = useRef<AbortController | null>(null);
  const lastStreamTextRef = useRef('');
  const streamingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const enabledRef = useRef(false);

  // Keep enabledRef in sync
  useEffect(() => {
    enabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  // Process streaming text into TTS sentences
  const processStreamingText = useCallback(() => {
    if (!enabledRef.current) return;

    const currentText = getStreamingText();
    if (currentText === lastStreamTextRef.current) return;

    const sentences = splitterRef.current.feed(currentText);
    lastStreamTextRef.current = currentText;

    for (const sentence of sentences) {
      if (!ttsAbortRef.current?.signal.aborted) {
        synthesizeSpeech(sentence, ttsAbortRef.current?.signal)
          .then((blob) => {
            if (enabledRef.current) {
              playbackQueueRef.current?.enqueue(blob);
            }
          })
          .catch(() => {
            // TTS failed or aborted
          });
      }
    }
  }, [getStreamingText]);

  // Watch streaming state and process TTS
  useEffect(() => {
    if (voiceEnabled && isLoading) {
      setVoiceState('thinking');
      ttsAbortRef.current = new AbortController();
      splitterRef.current.reset();
      lastStreamTextRef.current = '';

      // Poll streaming text for new sentences
      streamingIntervalRef.current = setInterval(processStreamingText, 150);
    }

    if (voiceEnabled && !isLoading && voiceState === 'thinking') {
      // Streaming finished - flush remaining text
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }

      // Process any remaining text
      processStreamingText();
      const remaining = splitterRef.current.flush();
      if (remaining && !ttsAbortRef.current?.signal.aborted) {
        synthesizeSpeech(remaining, ttsAbortRef.current?.signal)
          .then((blob) => {
            if (enabledRef.current) {
              playbackQueueRef.current?.enqueue(blob);
            }
          })
          .catch(() => {});
      }

      // If nothing is playing, go back to listening
      if (!playbackQueueRef.current?.isPlaying()) {
        setVoiceState('listening');
      }
    }

    return () => {
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceEnabled, isLoading]);

  // Interrupt: stop TTS + abort SSE
  const interrupt = useCallback(() => {
    // Abort TTS fetches
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;

    // Stop audio playback
    playbackQueueRef.current?.stop();

    // Clear streaming interval
    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }

    // Abort SSE fetch (text already accumulated is preserved in messages)
    abortControllerRef.current?.abort();

    splitterRef.current.reset();
    lastStreamTextRef.current = '';
  }, [abortControllerRef]);

  // Initialize or destroy VAD
  useEffect(() => {
    if (!voiceEnabled) {
      // Cleanup
      if (vadRef.current) {
        vadRef.current.destroy();
        vadRef.current = null;
      }
      playbackQueueRef.current?.destroy();
      playbackQueueRef.current = null;
      interrupt();
      setVoiceState('idle');
      return;
    }

    let cancelled = false;

    async function initVAD() {
      try {
        console.log('[VoiceChat] Loading VAD module...');
        // Dynamic import to avoid SSR issues
        const { MicVAD } = await import('@ricky0123/vad-web');
        console.log('[VoiceChat] VAD module loaded');

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

        console.log('[VoiceChat] Initializing MicVAD...');
        const vad = await MicVAD.new({
          baseAssetPath: '/vad/',
          onnxWASMBasePath: '/vad/',
          model: 'v5',
          startOnLoad: true,

          onSpeechStart: () => {
            console.log('[VoiceChat] Speech start detected');
            if (!enabledRef.current) return;

            // If the AI is speaking or thinking, interrupt
            if (playbackQueueRef.current?.isPlaying()) {
              interrupt();
            }

            setVoiceState('listening');
          },

          onSpeechEnd: async (audio: Float32Array) => {
            console.log('[VoiceChat] Speech end detected, audio length:', audio.length);
            if (!enabledRef.current) return;

            setVoiceState('transcribing');

            try {
              const wavBlob = float32ToWavBlob(audio, 16000);
              console.log('[VoiceChat] Sending to STT, blob size:', wavBlob.size);
              const text = await transcribeAudio(wavBlob);
              console.log('[VoiceChat] STT result:', text);

              if (text.trim() && enabledRef.current) {
                setTranscript(text.trim());
                onTranscript(text.trim());
              } else {
                setVoiceState('listening');
              }
            } catch (err) {
              console.error('[VoiceChat] STT error:', err);
              toast.error('Erreur de transcription vocale');
              setVoiceState('listening');
            }
          },

          onVADMisfire: () => {
            console.log('[VoiceChat] VAD misfire (speech too short)');
            if (enabledRef.current) {
              setVoiceState('listening');
            }
          },
        });

        if (cancelled) {
          vad.destroy();
          return;
        }

        vadRef.current = vad;
        setVoiceState('listening');
        console.log('[VoiceChat] VAD ready, listening...');
        toast.success('Mode vocal active');
      } catch (err) {
        console.error('[VoiceChat] VAD initialization failed:', err);
        toast.error('Impossible d\'activer le micro : ' + (err instanceof Error ? err.message : String(err)));
        setVoiceEnabled(false);
        setVoiceState('idle');
      }
    }

    initVAD();

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
