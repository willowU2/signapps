'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ISpeechRecognitionErrorEvent extends Event {
  error: 'no-speech' | 'audio-capture' | 'not-allowed' | 'network' | 'aborted' | 'language-not-supported' | 'service-not-allowed' | 'bad-grammar';
  message: string;
}

interface ISpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: any; // SpeechRecognitionResultList
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => any) | null;
  onerror: ((this: ISpeechRecognition, ev: ISpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: ISpeechRecognition, ev: Event) => any) | null;
}

type ISpeechRecognitionCtor = new () => ISpeechRecognition;
interface SpeechWindow {
  SpeechRecognition?: ISpeechRecognitionCtor;
  webkitSpeechRecognition?: ISpeechRecognitionCtor;
}

interface VoiceInputProps {
  onTranscription: (text: string, isFinal: boolean) => void;
  className?: string;
  isActive?: boolean;
  onActiveChange?: (active: boolean) => void;
  lang?: string;
  title?: string;
}

export function VoiceInput({ 
  onTranscription, 
  className, 
  isActive: controlledIsActive, 
  onActiveChange, 
  lang = 'fr-FR',
  title = "Dictée vocale"
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  const active = controlledIsActive !== undefined ? controlledIsActive : isListening;
  
  // Réf vitale pour le Web Speech API dont les events (onend) ne captent pas la mise à jour d'état
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const w = window as unknown as SpeechWindow;
      const SpeechRecognitionConstructor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (!SpeechRecognitionConstructor) {
        setIsSupported(false);
        return;
      }

      const recognition = new SpeechRecognitionConstructor();
      recognition.continuous = true;
      recognition.interimResults = true; // Full duplex!
      recognition.lang = lang;

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          onTranscription(finalTranscript, true);
        } else if (interimTranscript) {
          onTranscription(interimTranscript, false);
        }
      };

      recognition.onerror = (event) => {
        if (event.error !== 'aborted') {
          if (event.error === 'no-speech') {
             // no-speech est un timeout normal, on laissera onend redémarrer via activeRef
             return;
          }
          setIsListening(false);
          onActiveChange?.(false);
        }
      };

      recognition.onend = () => {
        // En mode Full Duplex, le Web Speech API Native s'arrête souvent tout seul après un silence
        // Si l'utilisateur a toujours son micro actvé (activeRef.current), on le force à redémarrer avec un délai
        if (activeRef.current && recognitionRef.current) {
            setTimeout(() => {
                if (!activeRef.current || !recognitionRef.current) return;
                try {
                    recognitionRef.current.start();
                } catch (e: any) {
                    if (e?.name !== 'InvalidStateError') console.error('Erreur redémarrage dictée:', e);
                }
            }, 150); // Petit délai pour laisser le navigateur réinitialiser le flux audio (évite le plantage)
        } else {
            setIsListening(false);
            onActiveChange?.(false);
        }
      };

      recognitionRef.current = recognition;
    }
  }, [lang, onTranscription, onActiveChange]);

  const toggleListening = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!recognitionRef.current) return;

    if (active) {
      recognitionRef.current.stop();
      setIsListening(false);
      onActiveChange?.(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        onActiveChange?.(true);
      } catch (err: any) {
        if (err?.name === 'NotAllowedError') {
          console.error('Microphone access denied:', err);
        } else if (err?.name !== 'InvalidStateError') {
           console.error('Failed to start recognition:', err);
        }
      }
    }
  }, [active, onActiveChange]);

  // Sync external state
  useEffect(() => {
    if (controlledIsActive && !isListening && recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch(e: any) {
         if (e?.name !== 'InvalidStateError') {
            console.error('External sync failed to start recognition:', e);
         }
      }
    } else if (controlledIsActive === false && isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [controlledIsActive, isListening]);

  if (!isSupported) {
    return null; 
  }

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
        active 
          ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 animate-pulse" 
          : "text-slate-400 hover:bg-background/10 hover:text-white",
        className
      )}
      title={active ? "Arrêter la dictée" : title}
    >
      {active ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}
