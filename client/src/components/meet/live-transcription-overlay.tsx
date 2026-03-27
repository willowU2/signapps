'use client';

// IDEA-129: Real-time transcription overlay — whisper-rs via media service, live meeting

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Mic,
  MicOff,
  Subtitles,
  X,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getClient, ServiceName } from '@/lib/api/factory';
import { toast } from 'sonner';

interface TranscriptLine {
  id: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

interface LiveTranscriptionOverlayProps {
  /** Whether to show the overlay */
  visible: boolean;
  onClose: () => void;
  /** Use whisper-rs backend (via signapps-ai) instead of Web Speech API */
  useWhisper?: boolean;
  className?: string;
}

export function LiveTranscriptionOverlay({
  visible,
  onClose,
  useWhisper = false,
  className,
}: LiveTranscriptionOverlayProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [interim, setInterim] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const recognitionRef = useRef<unknown>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines, interim]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const addFinalLine = useCallback((text: string) => {
    const ts = Date.now() - startTimeRef.current;
    setLines((prev) => [...prev, {
      id: `line_${Date.now()}_${Math.random()}`,
      text: text.trim(),
      timestamp: ts,
      isFinal: true,
    }]);
    setInterim('');
  }, []);

  // ─── Whisper backend ──────────────────────────────────────────────────────
  const startWhisper = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Microphone non disponible');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        chunks.length = 0;
        if (blob.size < 1000) return;
        const fd = new FormData();
        fd.append('audio', blob, 'audio.webm');
        fd.append('language', navigator.language?.split('-')[0] ?? 'fr');
        try {
          const client = getClient(ServiceName.AI);
          const res = await client.post<{ text: string }>('/transcribe', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const text = res.data?.text?.trim();
          if (text) addFinalLine(text);
        } catch {
          // Silently skip failed chunk
        }
      };

      recorder.start();
      const interval = setInterval(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
          recorder.start();
        } else {
          clearInterval(interval);
        }
      }, 8000);

      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      startTimeRef.current = Date.now();
    } catch {
      toast.error('Impossible d\'accéder au microphone');
    }
  };

  const stopWhisper = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  // ─── Web Speech API fallback ──────────────────────────────────────────────
  const startSpeechApi = () => {
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SR) {
      toast.error('Speech Recognition non supporté dans ce navigateur');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SR as any)();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'fr-FR';

    rec.onstart = () => {
      setIsRecording(true);
      startTimeRef.current = Date.now();
    };

    rec.onresult = (event: { resultIndex: number; results: SpeechRecognitionResultList }) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          addFinalLine(r[0].transcript);
        } else {
          interimText += r[0].transcript;
        }
      }
      setInterim(interimText);
    };

    rec.onerror = (e: { error: string }) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        toast.error(`Erreur transcription: ${e.error}`);
      }
    };

    rec.onend = () => {
      if (isRecording) {
        try { rec.start(); } catch { setIsRecording(false); }
      }
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const stopSpeechApi = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (recognitionRef.current as any)?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
    setInterim('');
  };

  const startRecording = () => useWhisper ? startWhisper() : startSpeechApi();
  const stopRecording = () => useWhisper ? stopWhisper() : stopSpeechApi();
  const toggleRecording = () => isRecording ? stopRecording() : startRecording();

  const handleExport = () => {
    const text = lines.map((l) => `[${formatTs(l.timestamp)}] ${l.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!visible) return null;

  return (
    <div className={cn(
      'absolute bottom-20 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl rounded-xl border bg-black/80 text-white backdrop-blur-sm shadow-2xl',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Subtitles className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium">Transcription live</span>
          {isRecording && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              Enregistrement
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-white hover:bg-white/10"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          {lines.length > 0 && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-white hover:bg-white/10"
              onClick={handleExport}
              title="Exporter"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-white hover:bg-white/10"
            onClick={() => { stopRecording(); onClose(); }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Transcript area */}
      {!collapsed && (
        <div
          ref={scrollRef}
          className="max-h-40 overflow-y-auto p-3 space-y-1 custom-scrollbar"
        >
          {lines.length === 0 && !interim && !isRecording && (
            <p className="text-xs text-white/40 text-center py-2">
              Cliquez sur le micro pour démarrer la transcription
            </p>
          )}
          {lines.map((line) => (
            <div key={line.id} className="flex gap-2 text-sm">
              <span className="text-white/40 text-xs font-mono shrink-0 mt-0.5">
                {formatTs(line.timestamp)}
              </span>
              <span>{line.text}</span>
            </div>
          ))}
          {interim && (
            <div className="flex gap-2 text-sm text-white/60 italic">
              <span className="text-white/30 text-xs font-mono shrink-0 mt-0.5">...</span>
              <span>{interim}</span>
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10">
        <Button
          size="sm"
          variant={isRecording ? 'destructive' : 'default'}
          className="gap-2 h-7 text-xs"
          onClick={toggleRecording}
        >
          {isRecording ? (
            <><MicOff className="h-3.5 w-3.5" />Arrêter</>
          ) : (
            <><Mic className="h-3.5 w-3.5" />Démarrer</>
          )}
        </Button>
        <span className="text-xs text-white/40 ml-auto">
          {lines.length} segment(s)
        </span>
      </div>
    </div>
  );
}
