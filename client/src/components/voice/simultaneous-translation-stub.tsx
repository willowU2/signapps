'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe, Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SUPPORTED_LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
];

interface TranslationSegment {
  id: number;
  original: string;
  translated: string;
  timestamp: string;
}

/**
 * SimultaneousTranslation — real-time STT via the browser Web Speech API,
 * then calls the AI service for translation.
 *
 * Requires a browser with SpeechRecognition support (Chrome/Edge).
 * Falls back to a clear status message on unsupported browsers.
 */
export function SimultaneousTranslationStub() {
  const [sourceLang, setSourceLang] = useState('fr');
  const [targetLang, setTargetLang] = useState('en');
  const [isListening, setIsListening] = useState(false);
  const [segments, setSegments] = useState<TranslationSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const counterRef = useRef(0);

  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? (window.SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null)
      : null;

  const isSupported = !!SpeechRecognitionCtor;

  const translateText = async (text: string): Promise<string> => {
    try {
      const res = await fetch('/api/v1/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source_lang: sourceLang, target_lang: targetLang }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.translated ?? text;
    } catch {
      // Graceful degradation: return original text with a note.
      return `[translation unavailable] ${text}`;
    }
  };

  const startListening = () => {
    if (!SpeechRecognitionCtor) return;
    setError(null);

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = sourceLang;
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = async (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim();
          if (!transcript) continue;
          const translated = await translateText(transcript);
          const segment: TranslationSegment = {
            id: ++counterRef.current,
            original: transcript,
            translated,
            timestamp: new Date().toLocaleTimeString('fr-FR'),
          };
          setSegments((prev) => [segment, ...prev].slice(0, 50));
        }
      }
    };

    recognition.onerror = (event: any) => {
      setError(`Reconnaissance vocale : ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto p-6 bg-card border border-input rounded-lg shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Traduction Simultanée</h2>
      </div>

      {!isSupported && (
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
          La reconnaissance vocale n&apos;est pas disponible dans ce navigateur.
          Utilisez Chrome ou Edge pour activer cette fonctionnalité.
        </p>
      )}

      {/* Language selectors */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Source</label>
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="w-full text-sm border border-input rounded px-2 py-1.5 bg-background"
            disabled={isListening}
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
        <span className="text-muted-foreground mt-4">→</span>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Cible</label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="w-full text-sm border border-input rounded px-2 py-1.5 bg-background"
            disabled={isListening}
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Record control */}
      <Button
        onClick={isListening ? stopListening : startListening}
        disabled={!isSupported}
        variant={isListening ? 'destructive' : 'default'}
        className="w-full"
      >
        {isListening ? (
          <><Square className="h-4 w-4 mr-2" />Arrêter la traduction</>
        ) : (
          <><Mic className="h-4 w-4 mr-2" />Démarrer la traduction</>
        )}
      </Button>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Segments */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {segments.map((seg) => (
          <div key={seg.id} className="p-3 bg-muted/50 rounded-md text-sm space-y-1">
            <p className="text-muted-foreground text-xs">{seg.timestamp}</p>
            <p className="text-foreground">{seg.original}</p>
            <p className="text-primary font-medium">{seg.translated}</p>
          </div>
        ))}
        {segments.length === 0 && isListening && (
          <p className="text-sm text-muted-foreground text-center py-4">
            En attente de parole…
          </p>
        )}
      </div>
    </div>
  );
}
