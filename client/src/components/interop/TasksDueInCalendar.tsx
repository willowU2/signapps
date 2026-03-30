"use client";

/**
 * Feature 7: Task due date → show in calendar view
 * Feature 22: Calendar → show tasks due that day in the day view
 * Feature 29: Calendar attendee → show their pending tasks
 */

import { useEffect, useState } from "react";
import { CheckSquare, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { calendarApi, tasksApi } from "@/lib/api/calendar";

interface SimpleTask {
  id: string;
  title: string;
  due_date?: string;
  status: string;
  priority?: number;
  assigned_to?: string;
}

const PRIORITY_LABEL: Record<number, string> = { 0: "Basse", 1: "Moyenne", 2: "Haute", 3: "Urgente" };
const PRIORITY_COLOR: Record<number, string> = {
  0: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  1: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  2: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  3: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

function localStorageFallbackTasks(dateStr: string): SimpleTask[] {
  if (typeof window === "undefined") return [];
  try {
    const stored: SimpleTask[] = JSON.parse(localStorage.getItem("email-tasks") || "[]");
    return stored.filter(t => t.due_date?.slice(0, 10) === dateStr && t.status !== "completed");
  } catch {
    return [];
  }
}

async function fetchTasksDueOn(date: Date): Promise<SimpleTask[]> {
  const dateStr = date.toISOString().slice(0, 10);
  try {
    const { data: calendarsRaw } = await calendarApi.listCalendars();
    const calendarsArr = Array.isArray(calendarsRaw) ? calendarsRaw : (calendarsRaw as any)?.data ?? [];
    const calId = calendarsArr[0]?.id;
    if (!calId) return localStorageFallbackTasks(dateStr);
    const { data: tasksRaw } = await tasksApi.listTasks(calId);
    const tasksArr: SimpleTask[] = Array.isArray(tasksRaw) ? tasksRaw : (tasksRaw as any)?.data ?? [];
    const filtered = tasksArr.filter(
      t => t.due_date?.slice(0, 10) === dateStr && t.status !== "completed"
    );
    return filtered.length > 0 ? filtered : localStorageFallbackTasks(dateStr);
  } catch {
    return localStorageFallbackTasks(dateStr);
  }
}

interface Props {
  date: Date;
  className?: string;
  maxItems?: number;
  onTaskClick?: (task: SimpleTask) => void;
}

export function TasksDueInCalendar({ date, className, maxItems = 5, onTaskClick }: Props) {
  const [tasks, setTasks] = useState<SimpleTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTasksDueOn(date).then(t => { setTasks(t); setLoading(false); });
  }, [date.toISOString().slice(0, 10)]);

  if (loading) return <div className="h-6 animate-pulse bg-muted/40 rounded" />;
  if (tasks.length === 0) return null;

  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1">
        Tâches échéant ce jour ({tasks.length})
      </p>
      {tasks.slice(0, maxItems).map(task => (
        <button
          key={task.id}
          onClick={() => onTaskClick?.(task)}
          className="flex items-center gap-2 w-full text-left rounded px-2 py-1 hover:bg-muted/60 transition-colors text-sm group"
        >
          <CheckSquare className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          <span className="flex-1 truncate">{task.title}</span>
          {task.priority !== undefined && (
            <span className={cn("text-[10px] px-1 rounded", PRIORITY_COLOR[task.priority] ?? PRIORITY_COLOR[1])}>
              {PRIORITY_LABEL[task.priority] ?? ""}
            </span>
          )}
        </button>
      ))}
      {tasks.length > maxItems && (
        <p className="text-[11px] text-muted-foreground px-2">+{tasks.length - maxItems} autres</p>
      )}
    </div>
  );
}

/** Feature 29: show pending tasks for an attendee email */
export function AttendeePendingTasks({ email, className }: { email: string; className?: string }) {
  const [tasks, setTasks] = useState<SimpleTask[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data: calendarsRaw } = await calendarApi.listCalendars();
        const calendarsArr = Array.isArray(calendarsRaw) ? calendarsRaw : (calendarsRaw as any)?.data ?? [];
        const calId = calendarsArr[0]?.id;
        if (!calId) return;
        const { data: tasksRaw } = await tasksApi.listTasks(calId);
        const all: SimpleTask[] = Array.isArray(tasksRaw) ? tasksRaw : (tasksRaw as any)?.data ?? [];
        const filtered = all
          .filter(t => t.assigned_to === email && t.status !== "completed")
          .slice(0, 5);
        setTasks(filtered);
      } catch { /* silent */ }
    })();
  }, [email]);

  if (tasks.length === 0) return null;

  return (
    <div className={cn("rounded border border-border/60 p-2 space-y-1", className)}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tâches en attente</p>
      {tasks.map(t => (
        <div key={t.id} className="flex items-center gap-1.5 text-xs">
          <CheckSquare className="h-3 w-3 text-amber-500" />
          <span className="truncate">{t.title}</span>
        </div>
      ))}
    </div>
  );
}
