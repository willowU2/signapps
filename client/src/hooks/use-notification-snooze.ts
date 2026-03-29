// Feature 25: Notification → snooze per notification

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

export type SnoozeDuration = "30min" | "1h" | "3h" | "tomorrow" | "custom";

export interface SnoozedNotification {
  notificationId: string;
  snoozedAt: string;
  resumeAt: string;
  duration: SnoozeDuration;
  title: string;
}

const SNOOZE_MS: Record<Exclude<SnoozeDuration, "tomorrow" | "custom">, number> = {
  "30min": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "3h": 3 * 60 * 60 * 1000,
};

function getTomorrowMorning(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d;
}

export function useNotificationSnooze() {
  const [snoozed, setSnoozed] = useState<Map<string, SnoozedNotification>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const snooze = useCallback((notificationId: string, title: string, duration: SnoozeDuration, customMs?: number) => {
    // Clear existing snooze for this notification
    const existing = timers.current.get(notificationId);
    if (existing) clearTimeout(existing);

    let resumeAt: Date;
    if (duration === "tomorrow") {
      resumeAt = getTomorrowMorning();
    } else if (duration === "custom" && customMs) {
      resumeAt = new Date(Date.now() + customMs);
    } else {
      resumeAt = new Date(Date.now() + SNOOZE_MS[duration as keyof typeof SNOOZE_MS]);
    }

    const entry: SnoozedNotification = {
      notificationId,
      snoozedAt: new Date().toISOString(),
      resumeAt: resumeAt.toISOString(),
      duration,
      title,
    };

    setSnoozed((prev) => new Map([...prev, [notificationId, entry]]));

    const delay = resumeAt.getTime() - Date.now();
    const timer = setTimeout(() => {
      setSnoozed((prev) => {
        const next = new Map(prev);
        next.delete(notificationId);
        return next;
      });
      timers.current.delete(notificationId);
      toast(`Rappel: ${title}`, { description: "Notification snoozée revenue." });
    }, delay);

    timers.current.set(notificationId, timer);

    const label = duration === "tomorrow" ? "demain à 8h"
      : duration === "30min" ? "30 minutes"
      : duration === "1h" ? "1 heure"
      : "3 heures";

    toast(`Snoozé jusqu'à ${label}`, { description: title });

    return entry;
  }, []);

  const cancelSnooze = useCallback((notificationId: string) => {
    const timer = timers.current.get(notificationId);
    if (timer) clearTimeout(timer);
    timers.current.delete(notificationId);
    setSnoozed((prev) => {
      const next = new Map(prev);
      next.delete(notificationId);
      return next;
    });
  }, []);

  const isSnoozed = useCallback((notificationId: string) => snoozed.has(notificationId), [snoozed]);

  const getResumeTime = useCallback((notificationId: string): string | null => {
    const entry = snoozed.get(notificationId);
    if (!entry) return null;
    return new Date(entry.resumeAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }, [snoozed]);

  // Cleanup on unmount
  useEffect(() => {
    const t = timers.current;
    return () => { t.forEach((timer) => clearTimeout(timer)); };
  }, []);

  return { snoozed: Array.from(snoozed.values()), snooze, cancelSnooze, isSnoozed, getResumeTime };
}
