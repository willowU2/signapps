"use client";

import { useEffect, useState, useRef } from "react";

export function PomodoroTimer() {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(25 * 60);
  const [isBreak, setIsBreak] = useState(false);
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          setRunning(false);
          if (!isBreak) {
            setSessions(p => p + 1);
            setIsBreak(true);
            return 5 * 60;
          } else {
            setIsBreak(false);
            return 25 * 60;
          }
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, isBreak]);

  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="font-mono tabular-nums text-sm">
        {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
      </span>
      <button onClick={() => setRunning(!running)} className="px-2 py-0.5 rounded bg-muted hover:bg-accent transition-colors">
        {running ? "Pause" : isBreak ? "Pause" : "Focus"}
      </button>
      <button onClick={() => { setRunning(false); setSeconds(25 * 60); setIsBreak(false); }} className="px-2 py-0.5 rounded bg-muted hover:bg-accent transition-colors">
        Reset
      </button>
      {sessions > 0 && <span className="text-muted-foreground">{sessions}x</span>}
    </div>
  );
}
