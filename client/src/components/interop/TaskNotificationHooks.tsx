"use client";

/**
 * Feature 10: Task completion → send notification email to assignee
 * Feature 13: Task overdue → email notification to assignee
 * Feature 18: Task comment → notify via email
 * Feature 28: Task status change → log in activity feed
 */

import { useEffect, useCallback } from "react";
import { toast } from "sonner";
import { interopStore } from "@/lib/interop/store";
import { useInteropActivity } from "@/hooks/use-interop";

import { CALENDAR_URL, MAIL_URL } from "@/lib/api/core";
interface Task {
  id: string;
  title: string;
  status: string;
  due_date?: string;
  assigned_to?: string;
  assignee_email?: string;
}

/** Use this hook inside TaskTree / TaskBoard to wire up notifications */
export function useTaskNotifications() {
  const { log } = useInteropActivity();

  /** Feature 10: Call when a task is completed */
  const onTaskCompleted = useCallback(
    (task: Task) => {
      log({
        type: "task_completed",
        title: `Tâche terminée : ${task.title}`,
        entityId: task.id,
        entityType: "task",
        contactEmail: task.assignee_email,
      });
      interopStore.addNotification({
        sourceModule: "task",
        type: "task_completed",
        title: "Tâche terminée",
        body: `« ${task.title} » a été complétée.`,
        entityId: task.id,
      });
      if (task.assignee_email) {
        sendEmailNotification(
          task.assignee_email,
          `Tâche terminée : ${task.title}`,
          `La tâche « ${task.title} » a été marquée comme terminée.`,
        );
      }
    },
    [log],
  );

  /** Feature 13: Call periodically to check overdue tasks */
  const checkOverdueTasks = useCallback(async () => {
    try {
      const API = CALENDAR_URL;
      const calsRes = await fetch(`${API}/calendars`, {
        credentials: "include",
      });
      if (!calsRes.ok) return;
      const cals = await calsRes.json();
      const calId = (cals.data ?? cals)?.[0]?.id;
      if (!calId) return;
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(
        `${CALENDAR_URL}/calendars/${calId}/tasks?status=open,in_progress&due_before=${today}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = await res.json();
      const overdue: Task[] = data.data ?? data ?? [];
      for (const task of overdue.slice(0, 5)) {
        const key = `overdue_notified_${task.id}_${today}`;
        if (localStorage.getItem(key)) continue;
        localStorage.setItem(key, "1");
        interopStore.addNotification({
          sourceModule: "task",
          type: "task_overdue",
          title: "Tâche en retard",
          body: `« ${task.title} » est en retard.`,
          entityId: task.id,
        });
        if (task.assignee_email) {
          sendEmailNotification(
            task.assignee_email,
            `Tâche en retard : ${task.title}`,
            `La tâche « ${task.title} » est en retard. Date d'échéance dépassée.`,
          );
        }
      }
    } catch {
      /* silent */
    }
  }, []);

  /** Feature 28: Call when status changes */
  const onStatusChanged = useCallback(
    (task: Task, oldStatus: string) => {
      log({
        type: "task_status_changed",
        title: `Statut modifié : ${task.title}`,
        description: `${oldStatus} → ${task.status}`,
        entityId: task.id,
        entityType: "task",
        contactEmail: task.assignee_email,
      });
      interopStore.addNotification({
        sourceModule: "task",
        type: "task_status_changed",
        title: "Statut de tâche modifié",
        body: `« ${task.title} » : ${oldStatus} → ${task.status}`,
        entityId: task.id,
      });
    },
    [log],
  );

  /** Feature 18: Call when a comment is added */
  const onCommentAdded = useCallback(
    (task: Task, comment: string, authorEmail?: string) => {
      interopStore.addNotification({
        sourceModule: "task",
        type: "task_comment",
        title: `Commentaire sur « ${task.title} »`,
        body: comment.slice(0, 100),
        entityId: task.id,
      });
      if (task.assignee_email && task.assignee_email !== authorEmail) {
        sendEmailNotification(
          task.assignee_email,
          `Nouveau commentaire : ${task.title}`,
          `Un commentaire a été ajouté à la tâche « ${task.title} » :\n\n${comment}`,
        );
      }
    },
    [],
  );

  // Feature 13: check overdue on mount
  useEffect(() => {
    checkOverdueTasks();
  }, [checkOverdueTasks]);

  return {
    onTaskCompleted,
    onStatusChanged,
    onCommentAdded,
    checkOverdueTasks,
  };
}

/** Sends email notification via mail API (best-effort) */
async function sendEmailNotification(
  to: string,
  subject: string,
  body: string,
) {
  try {
    const MAIL_API = MAIL_URL;
    await fetch(`${MAIL_API}/messages/send`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body_text: body }),
    });
  } catch {
    /* silent — notification is logged locally regardless */
  }
}
