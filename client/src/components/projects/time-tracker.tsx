"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Play, Square, Plus, Clock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimeEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  start: string; // ISO
  end?: string;  // ISO — absent means running
  minutes?: number; // manual entry
}

interface TimeTrackerProps {
  tasks?: { id: string; title: string }[];
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function entryDuration(e: TimeEntry): number {
  if (e.minutes) return e.minutes * 60_000;
  if (!e.end) return Date.now() - new Date(e.start).getTime();
  return new Date(e.end).getTime() - new Date(e.start).getTime();
}

const SAMPLE_TASKS = [
  { id: "1", title: "Design & Requirements" },
  { id: "2", title: "Backend Setup" },
  { id: "3", title: "Frontend Components" },
];

// ── Main Component ─────────────────────────────────────────────────────────────

export function TimeTracker({ tasks = SAMPLE_TASKS }: TimeTrackerProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [running, setRunning] = useState<string | null>(null); // entry id
  const [tick, setTick] = useState(0);
  const [selectedTask, setSelectedTask] = useState(tasks[0]?.id ?? "");
  const [manualMinutes, setManualMinutes] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick every second when timer is running
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const runningEntry = entries.find((e) => e.id === running);

  const handleStart = () => {
    if (running) return;
    const task = tasks.find((t) => t.id === selectedTask);
    if (!task) return;
    const id = crypto.randomUUID();
    const entry: TimeEntry = { id, taskId: task.id, taskTitle: task.title, start: new Date().toISOString() };
    setEntries((p) => [entry, ...p]);
    setRunning(id);
  };

  const handleStop = () => {
    if (!running) return;
    setEntries((p) => p.map((e) => e.id === running ? { ...e, end: new Date().toISOString() } : e));
    setRunning(null);
  };

  const handleManualAdd = () => {
    const mins = parseInt(manualMinutes, 10);
    if (!mins || mins <= 0) return;
    const task = tasks.find((t) => t.id === selectedTask);
    if (!task) return;
    const entry: TimeEntry = {
      id: crypto.randomUUID(), taskId: task.id, taskTitle: task.title,
      start: new Date().toISOString(), end: new Date().toISOString(), minutes: mins,
    };
    setEntries((p) => [entry, ...p]);
    setManualMinutes("");
  };

  const handleDelete = (id: string) => {
    if (running === id) setRunning(null);
    setEntries((p) => p.filter((e) => e.id !== id));
  };

  const totalMs = entries.reduce((acc, e) => acc + entryDuration(e), 0);

  // Group by task
  const byTask = tasks.map((t) => ({
    ...t,
    total: entries.filter((e) => e.taskId === t.id).reduce((acc, e) => acc + entryDuration(e), 0),
  })).filter((t) => t.total > 0);

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background">
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="size-4" /> Suivi du temps
        </h3>
        <Badge variant="secondary">{fmtDuration(totalMs)} total</Badge>
      </div>

      {/* Timer controls */}
      <div className="flex gap-2 flex-wrap items-end">
        <div className="space-y-1 flex-1 min-w-[140px]">
          <label className="text-xs font-medium text-muted-foreground">Tâche</label>
          <select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
            className="w-full h-9 rounded-md border px-3 text-sm bg-background"
          >
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>

        {running ? (
          <Button onClick={handleStop} variant="destructive" className="gap-2">
            <Square className="size-4" />
            Arrêter {runningEntry && <span className="font-mono text-xs">{fmtDuration(entryDuration(runningEntry))}</span>}
          </Button>
        ) : (
          <Button onClick={handleStart} className="gap-2">
            <Play className="size-4" /> Démarrer
          </Button>
        )}
      </div>

      {/* Manual entry */}
      <div className="flex gap-2 items-end">
        <div className="space-y-1 flex-1">
          <label className="text-xs font-medium text-muted-foreground">Ajout manuel (minutes)</label>
          <Input
            type="number" min="1" placeholder="ex: 30"
            value={manualMinutes}
            onChange={(e) => setManualMinutes(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleManualAdd(); }}
          />
        </div>
        <Button variant="outline" onClick={handleManualAdd} className="gap-1">
          <Plus className="size-4" /> Ajouter
        </Button>
      </div>

      {/* Summary by task */}
      {byTask.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Résumé par tâche</p>
          {byTask.map((t) => (
            <div key={t.id} className="flex justify-between text-sm">
              <span className="truncate">{t.title}</span>
              <span className="font-mono text-muted-foreground">{fmtDuration(t.total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Entries list */}
      {entries.length > 0 && (
        <div className="space-y-1 max-h-56 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground">Historique</p>
          {entries.map((e) => (
            <div key={e.id} className={cn("flex items-center gap-2 text-xs border rounded px-2 py-1", e.id === running && "border-primary bg-primary/5")}>
              <span className={cn("size-2 rounded-full shrink-0", e.id === running ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40")} />
              <span className="flex-1 truncate">{e.taskTitle}</span>
              <span className="font-mono text-muted-foreground">{fmtDuration(entryDuration(e))}</span>
              {e.minutes && <Badge variant="outline" className="text-xs">manuel</Badge>}
              <Button size="icon" variant="ghost" className="size-5" onClick={() => handleDelete(e.id)}>
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Aucune entrée de temps.</p>
      )}
    </div>
  );
}
