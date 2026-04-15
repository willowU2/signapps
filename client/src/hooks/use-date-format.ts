import { useMemo } from "react";

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const DATE_SHORT_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * COH-040 — useDateFormat: formats dates in FR locale
 * Returns helpers: formatDate, formatDateShort, formatDateTime
 */
export function useDateFormat() {
  return useMemo(
    () => ({
      /** "12 mars 2025" */
      formatDate: (date: Date | string | number | null | undefined): string => {
        if (!date) return "—";
        try {
          return DATE_FORMATTER.format(new Date(date));
        } catch {
          return "—";
        }
      },
      /** "12/03/2025" */
      formatDateShort: (
        date: Date | string | number | null | undefined,
      ): string => {
        if (!date) return "—";
        try {
          return DATE_SHORT_FORMATTER.format(new Date(date));
        } catch {
          return "—";
        }
      },
      /** "12 mars 2025 à 14:30" */
      formatDateTime: (
        date: Date | string | number | null | undefined,
      ): string => {
        if (!date) return "—";
        try {
          return DATETIME_FORMATTER.format(new Date(date));
        } catch {
          return "—";
        }
      },
    }),
    [],
  );
}
