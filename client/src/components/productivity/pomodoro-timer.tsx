'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SessionType = 'work' | 'break' | 'long-break';

interface PomodoroState {
  sessionType: SessionType;
  timeRemaining: number;
  isRunning: boolean;
  sessionsCompleted: number;
}

const SESSION_DURATIONS: Record<SessionType, number> = {
  work: 25 * 60,
  break: 5 * 60,
  'long-break': 15 * 60,
};

export default function PomodoroTimer() {
  const [state, setState] = useState<PomodoroState>({
    sessionType: 'work',
    timeRemaining: SESSION_DURATIONS.work,
    isRunning: false,
    sessionsCompleted: 0,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize AudioContext
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioContextRef.current = new AudioCtx();
      }
    }
  }, []);

  // Play notification sound
  const playNotification = useCallback(() => {
    try {
      const audioContext = audioContextRef.current;
      if (!audioContext) return;

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch {
      // Fallback silent if Web Audio API not available
    }
  }, []);

  // Timer logic
  useEffect(() => {
    if (!state.isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.timeRemaining > 1) {
          return { ...prev, timeRemaining: prev.timeRemaining - 1 };
        }

        // Timer ended - play sound and switch session
        playNotification();

        let nextSessionType: SessionType = 'work';
        let nextCompleted = prev.sessionsCompleted;

        if (prev.sessionType === 'work') {
          // After work, check if long break
          nextCompleted = prev.sessionsCompleted + 1;
          nextSessionType = nextCompleted % 4 === 0 ? 'long-break' : 'break';
        } else {
          // After break, back to work
          nextSessionType = 'work';
        }

        return {
          sessionType: nextSessionType,
          timeRemaining: SESSION_DURATIONS[nextSessionType],
          isRunning: false,
          sessionsCompleted: nextCompleted,
        };
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.isRunning, playNotification]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getSessionLabel = (): string => {
    const labels: Record<SessionType, string> = {
      work: 'Work',
      break: 'Short Break',
      'long-break': 'Long Break',
    };
    return labels[state.sessionType];
  };

  const handleToggle = () => {
    setState((prev) => ({ ...prev, isRunning: !prev.isRunning }));
  };

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState({
      sessionType: 'work',
      timeRemaining: SESSION_DURATIONS.work,
      isRunning: false,
      sessionsCompleted: 0,
    });
  };

  const progress = (SESSION_DURATIONS[state.sessionType] - state.timeRemaining) / SESSION_DURATIONS[state.sessionType];
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference * (1 - progress);

  const bgColor = state.sessionType === 'work' ? 'text-red-500' : 'text-blue-500';
  const circleColor = state.sessionType === 'work' ? 'stroke-red-500' : 'stroke-blue-500';

  return (
    <div className="flex flex-col items-center justify-center p-8 rounded-lg border bg-card">
      {/* Cycle Indicator */}
      <div className="mb-6 text-center">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {getSessionLabel()}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Session {state.sessionsCompleted + 1}
        </p>
      </div>

      {/* Circular Timer */}
      <div className="relative w-32 h-32 mb-8">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-muted"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="2"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`${circleColor} transition-all duration-500`}
            strokeLinecap="round"
          />
        </svg>
        {/* Time display */}
        <div className={`absolute inset-0 flex items-center justify-center ${bgColor}`}>
          <span className="text-3xl font-bold font-mono">
            {formatTime(state.timeRemaining)}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 mb-6">
        <Button
          onClick={handleToggle}
          size="sm"
          variant={state.isRunning ? 'destructive' : 'default'}
          className="gap-2"
        >
          {state.isRunning ? (
            <>
              <Pause className="w-4 h-4" /> Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> Start
            </>
          )}
        </Button>
        <Button onClick={handleReset} size="sm" variant="outline" className="gap-2">
          <RotateCcw className="w-4 h-4" /> Reset
        </Button>
      </div>

      {/* Sessions completed counter */}
      <div className="text-center text-sm text-muted-foreground">
        <p>{state.sessionsCompleted} session{state.sessionsCompleted !== 1 ? 's' : ''} completed</p>
      </div>
    </div>
  );
}
