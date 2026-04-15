"use client";

import { cn } from "@/lib/utils";

const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

interface TimeDisplayProps {
  date?: Date | string | number | null;
  /** If provided, renders a static time string (e.g. "14:30") */
  time?: string;
  className?: string;
}

/**
 * COH-052 — TimeDisplay: formats time as HH:mm in FR locale
 * Usage: <TimeDisplay date={new Date()} /> → "14:30"
 *        <TimeDisplay time="09:05" />      → "09:05"
 */
export function TimeDisplay({ date, time, className }: TimeDisplayProps) {
  let display = "—";

  if (time) {
    display = time;
  } else if (date) {
    try {
      display = TIME_FORMATTER.format(new Date(date));
    } catch {
      display = "—";
    }
  }

  return (
    <time
      className={cn("tabular-nums", className)}
      dateTime={date ? new Date(date).toISOString() : undefined}
    >
      {display}
    </time>
  );
}
