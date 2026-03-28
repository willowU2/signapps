'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const VOICE_COMMANDS: Record<string, string> = {
  'go home': '/',
  'go to dashboard': '/dashboard',
  'go to mail': '/mail',
  'go to calendar': '/calendar',
  'go to contacts': '/contacts',
  'go to tasks': '/tasks',
  'go to docs': '/docs',
  'go to settings': '/settings',
  'go to storage': '/storage',
  'go to drive': '/drive',
  'go to meet': '/meet',
  'go to chat': '/chat',
  'go to analytics': '/analytics',
  'go to admin': '/admin',
  'go back': '__BACK__',
  'scroll up': '__SCROLL_UP__',
  'scroll down': '__SCROLL_DOWN__',
  'click': '__CLICK__',
  'submit': '__SUBMIT__',
  'close': '__CLOSE__',
};

export function VoiceNavigation() {
  const router = useRouter();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SpeechRec);
  }, []);

  const executeCommand = useCallback((text: string) => {
    const lower = text.toLowerCase().trim();
    const match = Object.entries(VOICE_COMMANDS).find(([cmd]) => lower.includes(cmd));
    if (!match) {
      toast.info(`Commande non reconnue: "${text}"`);
      return;
    }
    const [cmd, action] = match;
    if (action === '__BACK__') {
      router.back();
    } else if (action === '__SCROLL_UP__') {
      window.scrollBy({ top: -300, behavior: 'smooth' });
    } else if (action === '__SCROLL_DOWN__') {
      window.scrollBy({ top: 300, behavior: 'smooth' });
    } else if (action === '__CLOSE__') {
      const closeBtn = document.querySelector('[aria-label="Close"], [data-dismiss]') as HTMLElement;
      closeBtn?.click();
    } else if (action === '__SUBMIT__') {
      const submitBtn = document.querySelector('button[type="submit"], form button') as HTMLElement;
      submitBtn?.click();
    } else {
      router.push(action);
      toast.success(`Navigation: ${cmd}`);
    }
  }, [router]);

  const startListening = useCallback(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'fr-FR';

    rec.onresult = (e: any) => {
      const last = e.results[e.results.length - 1];
      const text = last[0].transcript;
      setTranscript(text);
      if (last.isFinal) {
        executeCommand(text);
        setListening(false);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [executeCommand]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  if (!supported) return null;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={listening ? 'default' : 'outline'}
        size="sm"
        onClick={listening ? stopListening : startListening}
        className="gap-2"
        aria-label="Voice navigation"
      >
        {listening ? <Mic className="h-4 w-4 animate-pulse text-red-500" /> : <MicOff className="h-4 w-4" />}
        {listening ? 'Listening...' : 'Voice Nav'}
      </Button>
      {listening && transcript && (
        <Badge variant="secondary" className="text-xs max-w-[200px] truncate">
          <Volume2 className="h-3 w-3 mr-1" />
          {transcript}
        </Badge>
      )}
    </div>
  );
}
