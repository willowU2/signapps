'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// ── Static navigation commands ────────────────────────────────────────────────
const STATIC_COMMANDS: Array<{
  patterns: string[];
  action: string;
  fn: (router: ReturnType<typeof useRouter>, _match?: string) => void;
}> = [
  { patterns: ['créer document', 'create doc', 'nouveau document'], action: 'Create document', fn: (r) => r.push('/docs/editor') },
  { patterns: ['planifier réunion', 'schedule meeting', 'nouveau événement'], action: 'Schedule meeting', fn: (r) => r.push('/calendar?new=true') },
  { patterns: ['tableau de bord', 'go to dashboard', 'aller au tableau de bord'], action: 'Dashboard', fn: (r) => r.push('/dashboard') },
  { patterns: ['paramètres', 'settings', 'open settings'], action: 'Settings', fn: (r) => r.push('/settings') },
  { patterns: ['retour', 'go back', 'previous page'], action: 'Go back', fn: (r) => r.back() },
];

// ── Parameterised command patterns ────────────────────────────────────────────

// "compose email to X" / "envoyer mail à X"
const EMAIL_PATTERN = /(?:envoyer?\s+mail\s+[àa]|compose\s+email\s+to|send\s+email\s+to)\s+(.+)/i;
// "create task: X" / "nouvelle tâche X"
const TASK_PATTERN = /(?:cr[ée]+r?\s+(?:une?\s+)?t[aâ]che|nouvelle\s+t[aâ]che|create\s+task)[:\s]+(.+)/i;
// "search for X" / "rechercher X"
const SEARCH_PATTERN = /(?:rechercher?|search\s+for?|chercher?)\s+(.+)/i;

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

    // 1. Parameterised: compose email to X
    const emailMatch = text.match(EMAIL_PATTERN);
    if (emailMatch) {
      const to = encodeURIComponent(emailMatch[1].trim());
      setLastCommand(`Compose email to ${emailMatch[1].trim()}`);
      toast.success(`Opening compose — To: ${emailMatch[1].trim()}`);
      router.push(`/mail?compose=true&to=${to}`);
      return;
    }

    // 2. Parameterised: create task with title
    const taskMatch = text.match(TASK_PATTERN);
    if (taskMatch) {
      const title = encodeURIComponent(taskMatch[1].trim());
      setLastCommand(`Create task: ${taskMatch[1].trim()}`);
      toast.success(`Creating task: ${taskMatch[1].trim()}`);
      router.push(`/tasks?new=true&title=${title}`);
      return;
    }

    // 3. Parameterised: search
    const searchMatch = text.match(SEARCH_PATTERN);
    if (searchMatch) {
      const q = encodeURIComponent(searchMatch[1].trim());
      setLastCommand(`Search: ${searchMatch[1].trim()}`);
      toast.success(`Searching for: ${searchMatch[1].trim()}`);
      router.push(`/search?q=${q}`);
      return;
    }

    // 4. Static navigation commands
    const staticMatch = STATIC_COMMANDS.find(cmd => cmd.patterns.some(p => lower.includes(p)));
    if (staticMatch) {
      setLastCommand(staticMatch.action);
      toast.success(`Command: ${staticMatch.action}`);
      staticMatch.fn(router);
      return;
    }

    // 5. Simple "send email" / "envoyer mail" without target
    if (/envoyer?\s+mail|send\s+email|compose\s+email/i.test(lower)) {
      setLastCommand('Compose email');
      toast.success('Opening compose');
      router.push('/mail?compose=true');
      return;
    }
    // 6. Simple "create task" without title
    if (/nouvelle\s+t[aâ]che|create\s+task|ajouter\s+t[aâ]che/i.test(lower)) {
      setLastCommand('Create task');
      toast.success('Opening new task');
      router.push('/tasks?new=true');
      return;
    }

    toast.info(`Unknown command: "${text}"`);
  }, [router]);

  const start = useCallback(() => {
    const SpeechRec = window.SpeechRecognition ?? window.webkitSpeechRecognition;
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
