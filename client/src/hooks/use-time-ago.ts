import { useCallback } from "react";

const RTFR = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

type Unit = "second" | "minute" | "hour" | "day" | "week" | "month" | "year";

const THRESHOLDS: [Unit, number][] = [
  ["second", 60],
  ["minute", 3600],
  ["hour", 86400],
  ["day", 604800],
  ["week", 2592000],
  ["month", 31536000],
  ["year", Infinity],
];

const DIVISORS: Record<Unit, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 86400,
  week: 604800,
  month: 2592000,
  year: 31536000,
};

/**
 * COH-042 — useTimeAgo: returns relative time in French
 * "il y a 2 heures", "hier", "il y a 3 jours", etc.
 */
export function useTimeAgo() {
  const timeAgo = useCallback(
    (date: Date | string | number | null | undefined): string => {
      if (!date) return "—";
      try {
        const d = new Date(date);
        const diffSeconds = Math.round((d.getTime() - Date.now()) / 1000);
        const abs = Math.abs(diffSeconds);

        for (const [unit, threshold] of THRESHOLDS) {
          if (abs < threshold) {
            const value = Math.round(diffSeconds / DIVISORS[unit]);
            return RTFR.format(value, unit);
          }
        }
        // Fallback: full date
        return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
          d,
        );
      } catch {
        return "—";
      }
    },
    [],
  );

  return { timeAgo };
}
