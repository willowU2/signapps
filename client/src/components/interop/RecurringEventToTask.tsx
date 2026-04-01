"use client";

/**
 * Feature 26: Calendar recurring events → create recurring tasks
 */

import { useState } from "react";
import { Repeat, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { interopStore } from "@/lib/interop/store";

interface Props {
  eventId: string;
  eventTitle: string;
  recurrenceFrequency?: string; // "daily" | "weekly" | "monthly"
  nextOccurrences?: string[]; // ISO date strings
  className?: string;
}

export function RecurringEventToTask({ eventId, eventTitle, recurrenceFrequency, nextOccurrences = [], className }: Props) {
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState(false);

  if (!recurrenceFrequency || recurrenceFrequency === "none") return null;

  const handleCreate = async () => {
    setCreating(true);
    try {
      
      const calsRes = await fetch(`${API}/calendars`, { credentials: "include" });
      const cals = await calsRes.json();
      const calId = (cals.data ?? cals)?.[0]?.id;

      const dates = nextOccurrences.slice(0, 3);
      if (dates.length === 0) {
        // Generate next 3 dates from today
        const today = new Date();
        for (let i = 1; i <= 3; i++) {
          const d = new Date(today);
          if (recurrenceFrequency === "daily") d.setDate(d.getDate() + i);
          else if (recurrenceFrequency === "weekly") d.setDate(d.getDate() + i * 7);
          else if (recurrenceFrequency === "monthly") d.setMonth(d.getMonth() + i);
          dates.push(d.toISOString().slice(0, 10));
        }
      }

      for (const date of dates) {
        const taskTitle = `Préparer : ${eventTitle}`;
        let taskId = `local_${Date.now()}_${date}`;
        if (calId) {
          try {
            const res = await fetch(`${CALENDAR_URL}/calendars/${calId}/tasks`, {
              method: "POST", credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: taskTitle, due_date: date, priority: 1 }),
            });
            if (res.ok) { const d2 = await res.json(); taskId = d2.id ?? taskId; }
          } catch { /* fallback */ }
        }
        interopStore.addLink({ sourceType: "event", sourceId: eventId, sourceTitle: eventTitle, targetType: "task", targetId: taskId, targetTitle: taskTitle, relation: "recurring_task" });
      }
      setDone(true);
      toast.success(`${dates.length} tâches récurrentes créées`);
    } catch {
      toast.error("Impossible de créer les tâches");
    } finally { setCreating(false); }
  };

  return (
    <div className={`flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm ${className}`}>
      <Repeat className="h-4 w-4 text-indigo-500 shrink-0" />
      <span className="flex-1 text-muted-foreground">
        Événement récurrent ({recurrenceFrequency}) — créer des tâches de préparation ?
      </span>
      {!done ? (
        <Button size="sm" variant="secondary" onClick={handleCreate} disabled={creating} className="h-7 text-xs">
          {creating ? "…" : "Créer les tâches"}
        </Button>
      ) : (
        <CheckSquare className="h-4 w-4 text-emerald-500" />
      )}
    </div>
  );
}
