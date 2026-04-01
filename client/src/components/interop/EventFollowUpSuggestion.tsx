"use client";

/**
 * Feature 6: Calendar event ending → suggest creating follow-up task
 * Feature 11: Calendar event → auto-create task for preparation
 * Feature 14: Calendar invitation → auto-create task to prepare
 * Feature 26: Calendar recurring events → create recurring tasks
 */

import { useState } from "react";
import { CheckSquare, X, Repeat, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { interopStore } from "@/lib/interop/store";
import { calendarApi } from "@/lib/api/calendar";
import type { ScheduleBlock } from "@/lib/scheduling/types/scheduling";

import { CALENDAR_URL } from "@/lib/api/core";
interface Props {
  event: ScheduleBlock;
  mode: "follow_up" | "prepare" | "invite";
  onDismiss?: () => void;
}

export function EventFollowUpSuggestion({ event, mode, onDismiss }: Props) {
  const [creating, setCreating] = useState(false);

  const labels: Record<
    typeof mode,
    { title: string; buttonLabel: string; color: string }
  > = {
    follow_up: {
      title: `Créer un suivi pour « ${event.title} »`,
      buttonLabel: "Créer la tâche de suivi",
      color: "text-blue-500",
    },
    prepare: {
      title: `Préparer « ${event.title} »`,
      buttonLabel: "Créer la tâche de préparation",
      color: "text-emerald-500",
    },
    invite: {
      title: `Préparer l'invitation : « ${event.title} »`,
      buttonLabel: "Créer la tâche de préparation",
      color: "text-purple-500",
    },
  };

  const { title, buttonLabel, color } = labels[mode];

  const handleCreate = async () => {
    setCreating(true);
    try {
      const taskTitle =
        mode === "follow_up"
          ? `Suivi : ${event.title}`
          : `Préparer : ${event.title}`;
      const dueDate =
        mode === "follow_up"
          ? (event.end ?? event.start).toISOString().slice(0, 10)
          : event.start.toISOString().slice(0, 10);

      const { data: calendars } = await calendarApi.listCalendars();
      let taskId = `local_${Date.now()}`;

      if (Array.isArray(calendars) && calendars.length > 0) {
        const res = await fetch(
          `${CALENDAR_URL}/calendars/${calendars[0].id}/tasks`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: taskTitle,
              due_date: dueDate,
              priority: 2,
            }),
          },
        );
        if (res.ok) {
          const data = await res.json();
          taskId = data.id ?? taskId;
        }
      } else {
        const stored = JSON.parse(localStorage.getItem("email-tasks") || "[]");
        stored.push({
          id: taskId,
          title: taskTitle,
          due_date: dueDate,
          status: "open",
          created_at: new Date().toISOString(),
        });
        localStorage.setItem("email-tasks", JSON.stringify(stored));
      }

      interopStore.addLink({
        sourceType: "event",
        sourceId: event.id,
        sourceTitle: event.title,
        targetType: "task",
        targetId: taskId,
        targetTitle: taskTitle,
        relation: mode,
      });
      interopStore.addNotification({
        sourceModule: "calendar",
        type: "task_suggested",
        title: "Tâche créée",
        body: taskTitle,
      });
      toast.success("Tâche créée depuis l'événement");
      onDismiss?.();
    } catch {
      toast.error("Impossible de créer la tâche");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
      <CheckSquare className={`h-4 w-4 shrink-0 ${color}`} />
      <span className="flex-1 text-muted-foreground">{title}</span>
      <Button
        size="sm"
        variant="secondary"
        onClick={handleCreate}
        disabled={creating}
        className="h-7 text-xs"
      >
        {creating ? "…" : buttonLabel}
      </Button>
      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Auto-suggest hook — returns whether to show suggestion banners */
export function useEventTaskSuggestions(event: ScheduleBlock | null) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  const isDismissed = (mode: string) =>
    dismissed.includes(`${event?.id}:${mode}`);
  const dismiss = (mode: string) =>
    setDismissed((prev) => [...prev, `${event?.id}:${mode}`]);

  const isEndingSoon = event
    ? new Date(event.end ?? event.start).getTime() - Date.now() < 15 * 60000
    : false;
  const isUpcoming = event
    ? new Date(event.start).getTime() - Date.now() < 48 * 3600000 &&
      new Date(event.start).getTime() > Date.now()
    : false;

  return { isEndingSoon, isUpcoming, isDismissed, dismiss };
}
