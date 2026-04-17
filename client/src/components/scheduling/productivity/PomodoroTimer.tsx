"use client";

/**
 * PomodoroTimer Component
 * Phase 3: Productivity Features
 *
 * Pomodoro technique timer with work/break cycles.
 * Integrates with scheduling for time tracking.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Settings,
  Coffee,
  Brain,
  Target,
  Volume2,
  VolumeX,
  CheckCircle2,
} from "lucide-react";
import { usePreferencesStore } from "@/stores/scheduling/preferences-store";
import type { TimeItem } from "@/lib/scheduling/types";

// ============================================================================
// Types
// ============================================================================

interface PomodoroTimerProps {
  className?: string;
  currentTask?: TimeItem | null;
  onSessionComplete?: (type: "work" | "break", duration: number) => void;
  onPomodoroComplete?: (count: number) => void;
  compact?: boolean;
}

type TimerPhase = "work" | "shortBreak" | "longBreak";

interface PomodoroSettings {
  workDuration: number; // minutes
  shortBreakDuration: number;
  longBreakDuration: number;
  pomodorosUntilLongBreak: number;
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;
  soundEnabled: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  pomodorosUntilLongBreak: 4,
  autoStartBreaks: true,
  autoStartPomodoros: false,
  soundEnabled: true,
};

const PHASE_COLORS: Record<TimerPhase, string> = {
  work: "text-red-500",
  shortBreak: "text-green-500",
  longBreak: "text-blue-500",
};

const PHASE_BG_COLORS: Record<TimerPhase, string> = {
  work: "bg-red-500/10",
  shortBreak: "bg-green-500/10",
  longBreak: "bg-blue-500/10",
};

const PHASE_LABELS: Record<TimerPhase, string> = {
  work: "Focus",
  shortBreak: "Pause courte",
  longBreak: "Pause longue",
};

const PHASE_ICONS: Record<TimerPhase, React.ReactNode> = {
  work: <Brain className="h-5 w-5" />,
  shortBreak: <Coffee className="h-5 w-5" />,
  longBreak: <Target className="h-5 w-5" />,
};

// ============================================================================
// Hook for timer logic
// ============================================================================

function usePomodoroTimer(settings: PomodoroSettings) {
  const [phase, setPhase] = React.useState<TimerPhase>("work");
  const [timeLeft, setTimeLeft] = React.useState(settings.workDuration * 60);
  const [isRunning, setIsRunning] = React.useState(false);
  const [completedPomodoros, setCompletedPomodoros] = React.useState(0);
  const [todayPomodoros, setTodayPomodoros] = React.useState(0);

  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const totalTime = React.useMemo(() => {
    switch (phase) {
      case "work":
        return settings.workDuration * 60;
      case "shortBreak":
        return settings.shortBreakDuration * 60;
      case "longBreak":
        return settings.longBreakDuration * 60;
    }
  }, [phase, settings]);

  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  const playSound = React.useCallback(() => {
    if (settings.soundEnabled && typeof window !== "undefined") {
      try {
        const audio = new Audio("/sounds/bell.mp3");
        audio.volume = 0.5;
        audio.play().catch(() => {
          // Fallback: Use Web Audio API
          const context = new AudioContext();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.frequency.value = 800;
          gain.gain.setValueAtTime(0.5, context.currentTime);
          gain.gain.exponentialRampToValueAtTime(
            0.01,
            context.currentTime + 0.5,
          );
          oscillator.start(context.currentTime);
          oscillator.stop(context.currentTime + 0.5);
        });
      } catch (e) {
        // Sound not available in this environment
      }
    }
  }, [settings.soundEnabled]);

  const handlePhaseComplete = React.useCallback(() => {
    playSound();

    if (phase === "work") {
      const newCount = completedPomodoros + 1;
      setCompletedPomodoros(newCount);
      setTodayPomodoros((t) => t + 1);

      // Determine next break type
      if (newCount % settings.pomodorosUntilLongBreak === 0) {
        setPhase("longBreak");
        setTimeLeft(settings.longBreakDuration * 60);
      } else {
        setPhase("shortBreak");
        setTimeLeft(settings.shortBreakDuration * 60);
      }

      if (settings.autoStartBreaks) {
        setIsRunning(true);
      } else {
        setIsRunning(false);
      }
    } else {
      // Break complete, back to work
      setPhase("work");
      setTimeLeft(settings.workDuration * 60);

      if (settings.autoStartPomodoros) {
        setIsRunning(true);
      } else {
        setIsRunning(false);
      }
    }
  }, [phase, completedPomodoros, settings, playSound]);

  // Timer tick
  React.useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            handlePhaseComplete();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, handlePhaseComplete]);

  const start = () => setIsRunning(true);
  const pause = () => setIsRunning(false);
  const toggle = () => setIsRunning(!isRunning);

  const reset = () => {
    setIsRunning(false);
    setPhase("work");
    setTimeLeft(settings.workDuration * 60);
    setCompletedPomodoros(0);
  };

  const skip = () => {
    setIsRunning(false);
    handlePhaseComplete();
  };

  const setNewPhase = (newPhase: TimerPhase) => {
    setIsRunning(false);
    setPhase(newPhase);
    switch (newPhase) {
      case "work":
        setTimeLeft(settings.workDuration * 60);
        break;
      case "shortBreak":
        setTimeLeft(settings.shortBreakDuration * 60);
        break;
      case "longBreak":
        setTimeLeft(settings.longBreakDuration * 60);
        break;
    }
  };

  return {
    phase,
    timeLeft,
    isRunning,
    completedPomodoros,
    todayPomodoros,
    progress,
    totalTime,
    start,
    pause,
    toggle,
    reset,
    skip,
    setPhase: setNewPhase,
  };
}

// ============================================================================
// Component
// ============================================================================

export function PomodoroTimer({
  className,
  currentTask,
  onSessionComplete,
  onPomodoroComplete,
  compact = false,
}: PomodoroTimerProps) {
  const [settings, setSettings] =
    React.useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const {
    phase,
    timeLeft,
    isRunning,
    completedPomodoros,
    todayPomodoros,
    progress,
    toggle,
    reset,
    skip,
    setPhase,
  } = usePomodoroTimer(settings);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Notify on pomodoro complete
  React.useEffect(() => {
    if (phase !== "work" && completedPomodoros > 0) {
      onPomodoroComplete?.(completedPomodoros);
    }
  }, [completedPomodoros, phase, onPomodoroComplete]);

  // Compact view for sidebar/widget
  if (compact) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full",
            PHASE_BG_COLORS[phase],
          )}
        >
          {PHASE_ICONS[phase]}
        </div>
        <div className="flex-1">
          <div
            className={cn("text-2xl font-mono font-bold", PHASE_COLORS[phase])}
          >
            {formatTime(timeLeft)}
          </div>
          <div className="text-xs text-muted-foreground">
            {PHASE_LABELS[phase]} • {completedPomodoros} pomodoros
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className={cn(isRunning && "text-primary")}
          aria-label={isRunning ? "Pause" : "Démarrer"}
        >
          {isRunning ? (
            <Pause className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Play className="h-5 w-5" aria-hidden="true" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <Card className={cn("w-full max-w-sm", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {PHASE_ICONS[phase]}
            {PHASE_LABELS[phase]}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                setSettings((s) => ({ ...s, soundEnabled: !s.soundEnabled }))
              }
              aria-label={
                settings.soundEnabled ? "Couper le son" : "Activer le son"
              }
            >
              {settings.soundEnabled ? (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </Button>
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Paramètres Pomodoro"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Paramètres Pomodoro</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Durée de travail: {settings.workDuration} min
                    </label>
                    <Slider
                      value={[settings.workDuration]}
                      onValueChange={([v]) =>
                        setSettings((s) => ({ ...s, workDuration: v }))
                      }
                      min={5}
                      max={60}
                      step={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Pause courte: {settings.shortBreakDuration} min
                    </label>
                    <Slider
                      value={[settings.shortBreakDuration]}
                      onValueChange={([v]) =>
                        setSettings((s) => ({ ...s, shortBreakDuration: v }))
                      }
                      min={1}
                      max={15}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Pause longue: {settings.longBreakDuration} min
                    </label>
                    <Slider
                      value={[settings.longBreakDuration]}
                      onValueChange={([v]) =>
                        setSettings((s) => ({ ...s, longBreakDuration: v }))
                      }
                      min={5}
                      max={30}
                      step={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Pomodoros avant pause longue:{" "}
                      {settings.pomodorosUntilLongBreak}
                    </label>
                    <Slider
                      value={[settings.pomodorosUntilLongBreak]}
                      onValueChange={([v]) =>
                        setSettings((s) => ({
                          ...s,
                          pomodorosUntilLongBreak: v,
                        }))
                      }
                      min={2}
                      max={8}
                      step={1}
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Timer display */}
        <div className="flex flex-col items-center">
          <div
            className={cn(
              "text-6xl font-mono font-bold tracking-tight",
              PHASE_COLORS[phase],
            )}
          >
            {formatTime(timeLeft)}
          </div>

          {/* Progress bar */}
          <div className="w-full mt-4">
            <Progress
              value={progress}
              className={cn("h-2", PHASE_BG_COLORS[phase])}
            />
          </div>

          {/* Current task */}
          {currentTask && (
            <div className="mt-3 text-sm text-muted-foreground text-center">
              Travail sur:{" "}
              <span className="font-medium">{currentTask.title}</span>
            </div>
          )}
        </div>

        {/* Phase selector */}
        <div className="flex justify-center gap-2">
          {(["work", "shortBreak", "longBreak"] as TimerPhase[]).map((p) => (
            <Button
              key={p}
              variant={phase === p ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPhase(p)}
              className="text-xs"
            >
              {PHASE_LABELS[p]}
            </Button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={reset}
            aria-label="Réinitialiser"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button size="lg" className="w-16 h-16 rounded-full" onClick={toggle}>
            {isRunning ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6 ml-1" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={skip}
            aria-label="Passer au prochain cycle"
          >
            <SkipForward className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-4 pt-2 border-t">
          <div className="flex items-center gap-1 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>
              {completedPomodoros} session{completedPomodoros !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            Aujourd'hui: {todayPomodoros}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PomodoroTimer;
