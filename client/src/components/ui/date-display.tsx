"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const MONTHS_FR = [
  "jan",
  "fév",
  "mar",
  "avr",
  "mai",
  "juin",
  "juil",
  "août",
  "sep",
  "oct",
  "nov",
  "déc",
];

function formatDate(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTHS_FR[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatDateTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "—";
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)} ${hours}:${minutes}`;
}

interface DateDisplayProps {
  date: Date | string | number | null | undefined;
  withTime?: boolean;
  className?: string;
  fallback?: string;
}

/**
 * Standard date display component. Format: "dd MMM yyyy" (e.g. "29 mar 2026").
 * Use everywhere a date needs to be displayed.
 */
export function DateDisplay({
  date,
  withTime = false,
  className,
  fallback = "—",
}: DateDisplayProps) {
  if (date == null) {
    return (
      <span className={cn("text-muted-foreground", className)}>{fallback}</span>
    );
  }

  const formatted = withTime ? formatDateTime(date) : formatDate(date);

  return (
    <time
      dateTime={new Date(date).toISOString()}
      className={cn("text-sm tabular-nums", className)}
    >
      {formatted}
    </time>
  );
}
