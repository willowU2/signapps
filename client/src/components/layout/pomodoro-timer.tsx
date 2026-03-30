'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Play, Pause, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

type Phase = 'work' | 'break';

const STORAGE_KEY = 'pomodoro-completed';

function loadCompleted(): number {
  if (typeof window === 'undefined') return 0;
  return Number(localStorage.getItem(STORAGE_KEY) ?? '0');
}

function saveCompleted(n: number) {
  localStorage.setItem(STORAGE_KEY, String(n));
}

// ─── Subtle audio beep via Web Audio API ─────────────────────────────────────

function playBeep(frequency = 880, duration = 0.3) {
  try {
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available — silent
  }
}

// ─── Timer ────────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * PomodoroTimer — PR2
 *
 * Floating button in the bottom-right corner.
 * Click to expand a compact overlay with:
 *   - Phase label (Travail / Pause)
 *   - Countdown
 *   - Play/Pause + Reset controls
 *   - Completed pomodoros dot counter
 */
export function PomodoroTimer() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('work');
  const [secondsLeft, setSecondsLeft] = useState(WORK_SECONDS);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);

  // Hydration guard — only render on client
  useEffect(() => {
    setMounted(true);
    setCompleted(loadCompleted());
  }, []);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = phase === 'work' ? WORK_SECONDS : BREAK_SECONDS;
  const progress = 1 - secondsLeft / totalSeconds;

  const switchPhase = useCallback((next: Phase) => {
    setPhase(next);
    setSecondsLeft(next === 'work' ? WORK_SECONDS : BREAK_SECONDS);
    setRunning(false);
    playBeep(next === 'work' ? 660 : 440);
  }, []);

  // Tick
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          // Phase complete
          if (phase === 'work') {
            const n = completed + 1;
            setCompleted(n);
            saveCompleted(n);
            switchPhase('break');
          } else {
            switchPhase('work');
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, phase, completed, switchPhase]);

  // Update document title while running
  useEffect(() => {
    if (running) {
      const orig = document.title;
      document.title = `${formatTime(secondsLeft)} ${phase === 'work' ? '🍅' : '☕'} — SignApps`;
      return () => { document.title = orig; };
    }
  }, [running, secondsLeft, phase]);

  const handleReset = () => {
    setRunning(false);
    setSecondsLeft(phase === 'work' ? WORK_SECONDS : BREAK_SECONDS);
  };

  // Circumference for SVG progress ring
  const radius = 22;
  const circ = 2 * Math.PI * radius;

  if (!mounted) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col items-center gap-2">
      {/* Expanded panel */}
      {open && (
        <div className="w-56 rounded-xl border border-border bg-card shadow-xl p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between">
            <span className={cn(
              'text-xs font-semibold uppercase tracking-wider',
              phase === 'work' ? 'text-red-500' : 'text-green-500',
            )}>
              {phase === 'work' ? 'Travail' : 'Pause'}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setOpen(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* SVG ring + countdown */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-16 h-16">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
                <circle
                  cx="28" cy="28" r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-muted/30"
                />
                <circle
                  cx="28" cy="28" r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={circ}
                  strokeDashoffset={circ * (1 - progress)}
                  strokeLinecap="round"
                  className={phase === 'work' ? 'text-red-500' : 'text-green-500'}
                  style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold">
                {formatTime(secondsLeft)}
              </span>
            </div>

            <div className="flex gap-2">
              <Button
                size="icon"
                variant={running ? 'outline' : 'default'}
                className="h-8 w-8"
                onClick={() => setRunning((r) => !r)}
              >
                {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={handleReset}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Completed pomodoros */}
          <div className="flex items-center gap-1 justify-center flex-wrap">
            {Array.from({ length: Math.min(completed, 8) }).map((_, i) => (
              <span key={i} className="w-2.5 h-2.5 rounded-full bg-red-500/80" title="Pomodoro termine" />
            ))}
            {completed > 8 && (
              <span className="text-xs text-muted-foreground">+{completed - 8}</span>
            )}
            {completed === 0 && (
              <span className="text-xs text-muted-foreground">Aucun pomodoro termine</span>
            )}
          </div>

          {/* Switch phase */}
          <div className="flex gap-2">
            <Button
              variant={phase === 'work' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 text-xs h-7"
              onClick={() => switchPhase('work')}
            >
              Travail
            </Button>
            <Button
              variant={phase === 'break' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 text-xs h-7"
              onClick={() => switchPhase('break')}
            >
              Pause
            </Button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title={running ? `${formatTime(secondsLeft)} — ${phase === 'work' ? 'Travail' : 'Pause'}` : 'Pomodoro'}
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-200',
          'bg-card border border-border hover:scale-105 active:scale-95',
          running && phase === 'work' && 'border-red-500 bg-red-50 dark:bg-red-950/30',
          running && phase === 'break' && 'border-green-500 bg-green-50 dark:bg-green-950/30',
        )}
      >
        <Timer
          className={cn(
            'h-5 w-5',
            running ? (phase === 'work' ? 'text-red-500' : 'text-green-500') : 'text-muted-foreground',
          )}
        />
        {running && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
        )}
      </button>
    </div>
  );
}
