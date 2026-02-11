'use client';

import { Button } from '@/components/ui/button';
import { Mic, Loader2, Bot, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VoiceState } from '@/hooks/use-voice-chat';

interface VoiceChatButtonProps {
  voiceEnabled: boolean;
  voiceState: VoiceState;
  onToggle: () => void;
}

const stateConfig: Record<
  VoiceState,
  { icon: typeof Mic; label: string; className: string }
> = {
  idle: {
    icon: Mic,
    label: 'Activer le mode vocal',
    className: 'text-muted-foreground',
  },
  listening: {
    icon: Mic,
    label: 'Ecoute en cours...',
    className: 'text-green-500 animate-pulse',
  },
  transcribing: {
    icon: Loader2,
    label: 'Transcription...',
    className: 'text-yellow-500 animate-spin',
  },
  thinking: {
    icon: Bot,
    label: "L'IA reflechit...",
    className: 'text-purple-500 animate-pulse',
  },
  speaking: {
    icon: Volume2,
    label: "L'IA parle...",
    className: 'text-blue-500 animate-pulse',
  },
};

export function VoiceChatButton({
  voiceEnabled,
  voiceState,
  onToggle,
}: VoiceChatButtonProps) {
  const state = voiceEnabled ? voiceState : 'idle';
  const { icon: Icon, label, className } = stateConfig[state];

  return (
    <Button
      variant={voiceEnabled ? 'default' : 'outline'}
      size="icon"
      onClick={onToggle}
      title={label}
      className={cn(
        'relative shrink-0',
        voiceEnabled && 'ring-2 ring-primary/30'
      )}
    >
      <Icon className={cn('h-4 w-4', voiceEnabled && className)} />
      {voiceEnabled && voiceState === 'listening' && (
        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-green-500 animate-ping" />
      )}
    </Button>
  );
}
