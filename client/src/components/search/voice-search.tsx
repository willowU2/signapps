'use client';

import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VoiceSearchProps {
  onResult: (transcript: string) => void;
  className?: string;
}

// ─── SpeechRecognition types ──────────────────────────────────────────────────

interface SpeechRecognitionResult {
  readonly length: number;
  [index: number]: { transcript: string; confidence: number };
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventCompat extends Event {
  results: SpeechRecognitionResultList;
}

// We use 'any' constructor type to avoid conflicts with the DOM lib's own declarations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionCtor = new () => any;

// ─── Component ────────────────────────────────────────────────────────────────

export function VoiceSearch({ onResult, className = '' }: VoiceSearchProps) {
  const [listening, setListening] = useState(false);
  const getSpeechRecognitionCtor = (): SpeechRecognitionCtor | null => {
    if (typeof window === 'undefined') return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
  };

  const [supported] = useState(() => !!getSpeechRecognitionCtor());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    if (!supported) {
      toast.error('La reconnaissance vocale n\'est pas supportée par ce navigateur');
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEventCompat) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      toast.success(`Reconnaissance : "${transcript}"`);
    };

    recognition.onerror = () => {
      toast.error('Erreur de reconnaissance vocale');
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    toast.info('Parlez maintenant…', { duration: 3000 });
  }, [supported, onResult]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant={listening ? 'default' : 'ghost'}
      size="icon"
      className={`shrink-0 transition-all ${listening ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 'text-muted-foreground hover:text-foreground'} ${className}`}
      onClick={listening ? stopListening : startListening}
      title={listening ? 'Arrêter l\'écoute' : 'Recherche vocale'}
    >
      {listening ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}

// ─── Search bar with integrated voice ────────────────────────────────────────

interface VoiceSearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export function VoiceSearchBar({ value, onChange, onSearch, placeholder = 'Rechercher...', className = '' }: VoiceSearchBarProps) {
  const [thinking, setThinking] = useState(false);

  const handleVoiceResult = useCallback((transcript: string) => {
    setThinking(true);
    onChange(transcript);
    setTimeout(() => {
      setThinking(false);
      onSearch?.(transcript);
    }, 300);
  }, [onChange, onSearch]);

  return (
    <div className={`relative flex items-center gap-1 ${className}`}>
      <div className="relative flex-1">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSearch?.(value); }}
          placeholder={placeholder}
          className="w-full h-10 pl-3 pr-10 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {thinking && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      <VoiceSearch onResult={handleVoiceResult} />
    </div>
  );
}
