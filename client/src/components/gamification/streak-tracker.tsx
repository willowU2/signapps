'use client';

import { useEffect, useState, useCallback } from 'react';
import { Flame, CheckCircle2, Circle, Target } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// ── Storage keys ──────────────────────────────────────────────
const STREAK_KEY = 'signapps-streak-v2';
const GOALS_KEY = 'signapps-daily-goals';

// ── Streak types ──────────────────────────────────────────────
interface StreakState {
  /** Inbox Zero streak: days in a row user had 0 unread at EOD */
  inboxZero: { current: number; longest: number; lastDate: string };
  /** Task Crusher: days in a row user completed all tasks */
  taskCrusher: { current: number; longest: number; lastDate: string };
  /** Generic daily login streak */
  dailyLogin: { current: number; longest: number; lastDate: string };
}

interface DailyGoals {
  date: string;
  tasksDone: number;
  tasksTarget: number;
  emailsSent: number;
  emailsTarget: number;
  eventsDone: number;
  eventsTarget: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  return new Date(Date.now() - 86400000).toISOString().slice(0, 10);
}

function defaultStreaks(): StreakState {
  const base = { current: 0, longest: 0, lastDate: '' };
  return { inboxZero: { ...base }, taskCrusher: { ...base }, dailyLogin: { ...base } };
}

function defaultGoals(): DailyGoals {
  return {
    date: today(),
    tasksDone: 0,
    tasksTarget: 3,
    emailsSent: 0,
    emailsTarget: 5,
    eventsDone: 0,
    eventsTarget: 1,
  };
}

function loadStreaks(): StreakState {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return defaultStreaks();
    return JSON.parse(raw) as StreakState;
  } catch {
    return defaultStreaks();
  }
}

function loadGoals(): DailyGoals {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    if (!raw) return defaultGoals();
    const g = JSON.parse(raw) as DailyGoals;
    // Reset if it's a new day
    if (g.date !== today()) return defaultGoals();
    return g;
  } catch {
    return defaultGoals();
  }
}

function saveStreaks(s: StreakState) {
  try { localStorage.setItem(STREAK_KEY, JSON.stringify(s)); } catch {}
}

function saveGoals(g: DailyGoals) {
  try { localStorage.setItem(GOALS_KEY, JSON.stringify(g)); } catch {}
}

/**
 * Increment the daily login streak (call once per app session).
 * Returns the updated state.
 */
export function tickLoginStreak(): StreakState {
  const state = loadStreaks();
  const t = today();
  const yd = yesterday();
  const dl = state.dailyLogin;

  if (dl.lastDate === t) return state; // already counted today

  const newCurrent = dl.lastDate === yd ? dl.current + 1 : 1;
  const updated: StreakState = {
    ...state,
    dailyLogin: {
      current: newCurrent,
      longest: Math.max(dl.longest, newCurrent),
      lastDate: t,
    },
  };
  saveStreaks(updated);
  return updated;
}

/**
 * Mark today's inbox as zero (call when unread === 0 at EOD or immediately).
 */
export function markInboxZero(): StreakState {
  const state = loadStreaks();
  const t = today();
  const yd = yesterday();
  const iz = state.inboxZero;
  if (iz.lastDate === t) return state;
  const newCurrent = iz.lastDate === yd ? iz.current + 1 : 1;
  const updated: StreakState = {
    ...state,
    inboxZero: { current: newCurrent, longest: Math.max(iz.longest, newCurrent), lastDate: t },
  };
  saveStreaks(updated);
  return updated;
}

/**
 * Increment daily task count. Returns updated goals.
 */
export function incrementTaskGoal(): DailyGoals {
  const g = loadGoals();
  const updated = { ...g, tasksDone: g.tasksDone + 1 };
  saveGoals(updated);

  // Update Task Crusher streak when all tasks done
  if (updated.tasksDone >= updated.tasksTarget) {
    const state = loadStreaks();
    const t = today();
    const yd = yesterday();
    const tc = state.taskCrusher;
    if (tc.lastDate !== t) {
      const newCurrent = tc.lastDate === yd ? tc.current + 1 : 1;
      saveStreaks({
        ...state,
        taskCrusher: { current: newCurrent, longest: Math.max(tc.longest, newCurrent), lastDate: t },
      });
    }
  }

  return updated;
}

// ── Component ─────────────────────────────────────────────────

interface StreakTrackerProps {
  /** compact mode: just shows streak counts inline */
  compact?: boolean;
}

export function StreakTracker({ compact = false }: StreakTrackerProps) {
  const [streaks, setStreaks] = useState<StreakState | null>(null);
  const [goals, setGoals] = useState<DailyGoals | null>(null);

  const refresh = useCallback(() => {
    setStreaks(loadStreaks());
    setGoals(loadGoals());
  }, []);

  useEffect(() => {
    refresh();
    const handler = (e: StorageEvent) => {
      if (e.key === STREAK_KEY || e.key === GOALS_KEY) refresh();
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [refresh]);

  if (!streaks || !goals) return null;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-500">
        <Flame className="h-3.5 w-3.5" />
        {streaks.dailyLogin.current}
      </span>
    );
  }

  const goalItems = [
    {
      label: 'Complete 3 tasks today',
      icon: '✅',
      done: goals.tasksDone,
      target: goals.tasksTarget,
    },
    {
      label: 'Send 5 emails',
      icon: '✉️',
      done: goals.emailsSent,
      target: goals.emailsTarget,
    },
    {
      label: 'Create 1 calendar event',
      icon: '📅',
      done: goals.eventsDone,
      target: goals.eventsTarget,
    },
  ];

  const streakItems: Array<{ label: string; icon: string; current: number; longest: number }> = [
    { label: 'Daily login', icon: '🔥', current: streaks.dailyLogin.current, longest: streaks.dailyLogin.longest },
    { label: 'Inbox Zero', icon: '📭', current: streaks.inboxZero.current, longest: streaks.inboxZero.longest },
    { label: 'Task Crusher', icon: '⚡', current: streaks.taskCrusher.current, longest: streaks.taskCrusher.longest },
  ];

  return (
    <div className="space-y-4">
      {/* Daily goals */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Daily goals</h3>
          <span className="text-xs text-muted-foreground ml-auto">{new Date().toLocaleDateString()}</span>
        </div>
        <div className="space-y-2.5">
          {goalItems.map((g) => {
            const pct = Math.min((g.done / g.target) * 100, 100);
            const done = g.done >= g.target;
            return (
              <div key={g.label} className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  {done
                    ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    : <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  }
                  <span className={cn('flex-1', done && 'text-muted-foreground line-through')}>
                    {g.icon} {g.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {g.done}/{g.target}
                  </span>
                </div>
                <Progress value={pct} className={cn('h-1.5', done && '[&>div]:bg-green-500')} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Streaks */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Flame className="h-4 w-4 text-orange-500" />
          <h3 className="text-sm font-semibold">Streaks</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {streakItems.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center p-2.5 rounded-lg bg-muted/50 border border-border text-center"
            >
              <span className="text-xl mb-1">{s.icon}</span>
              <span
                className={cn(
                  'text-2xl font-bold',
                  s.current > 0 ? 'text-orange-500' : 'text-muted-foreground',
                )}
              >
                {s.current}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">{s.label}</span>
              {s.longest > 1 && (
                <span className="text-[10px] text-muted-foreground mt-0.5">Best: {s.longest}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
