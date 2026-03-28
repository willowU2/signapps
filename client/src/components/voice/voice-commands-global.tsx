'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const COMMANDS: Array<{ patterns: string[]; action: string; fn: (router: ReturnType<typeof useRouter>) => void }> = [
  { patterns: ['créer document', 'create doc', 'nouveau document'], action: 'Create document', fn: (r) => r.push('/docs/editor') },
  { patterns: ['envoyer mail', 'send email', 'compose email'], action: 'Compose email', fn: (r) => r.push('/mail?compose=true') },
  { patterns: ['planifier réunion', 'schedule meeting', 'nouveau événement'], action: 'Schedule meeting', fn: (r) => r.push('/calendar?new=true') },
  { patterns: ['nouvelle tâche', 'create task', 'ajouter tâche'], action: 'Create task', fn: (r) => r.push('/tasks?new=true') },
  { patterns: ['tableau de bord', 'go to dashboard', 'aller au tableau de bord'], action: 'Dashboard', fn: (r) => r.push('/dashboard') },
  { patterns: ['paramètres', 'settings', 'open settings'], action: 'Settings', fn: (r) => r.push('/settings') },
  { patterns: ['retour', 'go back', 'previous page'], action: 'Go back', fn: (r) => r.back() },
];

interface VoiceCommandsGlobalProps {
  compact?: boolean;
}

export function VoiceCommandsGlobal({ compact = false }: VoiceCommandsGlobalProps) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [lastCommand, setLastCommand] = useState('');
  const recognitionRef = useRef<any>(null);

  const processCommand = useCallback((text: string) => {
    const lower = text.toLowerCase().trim();
    const match = COMMANDS.find(cmd => cmd.patterns.some(p => lower.includes(p)));
    if (match) {
      setLastCommand(match.action);
      toast.success(`Command: ${match.action}`);
      match.fn(router);
    } else {
      toast.info(`Unknown command: "${text}"`);
    }
  }, [router]);

  const start = useCallback(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) { toast.error('Speech recognition not supported'); return; }

    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'fr-FR';
    rec.onresult = (e: any) => {
      const text = e.results[e.results.length - 1][0].transcript;
      processCommand(text);
    };
    rec.onerror = () => setActive(false);
    rec.onend = () => { if (active) rec.start(); };
    recognitionRef.current = rec;
    rec.start();
    setActive(true);
  }, [active, processCommand]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={active ? 'default' : 'outline'}
        size={compact ? 'icon' : 'sm'}
        onClick={active ? stop : start}
        className={compact ? 'h-8 w-8' : 'gap-1.5'}
        aria-label="Voice commands"
      >
        {active ? (
          <Mic className="h-4 w-4 animate-pulse text-red-200" />
        ) : (
          <MicOff className="h-4 w-4" />
        )}
        {!compact && (active ? 'Voice On' : 'Voice Off')}
      </Button>
      {active && lastCommand && (
        <Badge variant="secondary" className="text-xs">{lastCommand}</Badge>
      )}
    </div>
  );
}
