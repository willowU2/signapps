import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ContainerPortMapping } from "@/hooks/use-containers";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// COH-044 — Unified number formatting (fr-FR)
const NUM_FR = new Intl.NumberFormat("fr-FR");
const CURRENCY_FR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});
const PCT_FR = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

/** COH-044: "1 234" */
export function formatNumber(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return NUM_FR.format(n);
}

/** COH-047: "1 234,56 €" — French currency format */
export function formatCurrency(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return CURRENCY_FR.format(n);
}

/** COH-048: "12,5 %" */
export function formatPercent(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return `${PCT_FR.format(n)} %`;
}

// COH-044 — Unified date formatting (fr-FR)
const DATE_FR = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const DATETIME_FR = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** COH-044: "28/03/2026" */
export function formatDate(
  d: Date | string | number | null | undefined,
): string {
  if (d == null) return "—";
  try {
    return DATE_FR.format(new Date(d));
  } catch {
    return "—";
  }
}

/** COH-044: "28/03/2026 14:30" */
export function formatDateTime(
  d: Date | string | number | null | undefined,
): string {
  if (d == null) return "—";
  try {
    return DATETIME_FR.format(new Date(d));
  } catch {
    return "—";
  }
}

const WEB_PORT_PRIORITY = [80, 443, 8080, 8443, 3000, 8000, 5000, 9000];

export function getContainerUrl(
  portMappings: ContainerPortMapping[],
  hostname: string = window.location.hostname,
): string | null {
  const tcpPorts = portMappings.filter((p) => p.protocol === "tcp");
  if (tcpPorts.length === 0) return null;

  let best = tcpPorts[0];
  let bestIndex = WEB_PORT_PRIORITY.indexOf(best.container);

  for (const p of tcpPorts.slice(1)) {
    const idx = WEB_PORT_PRIORITY.indexOf(p.container);
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
      best = p;
      bestIndex = idx;
    }
  }

  const isHttps = best.container === 443 || best.container === 8443;
  const scheme = isHttps ? "https" : "http";
  const omitPort =
    (scheme === "http" && best.host === 80) ||
    (scheme === "https" && best.host === 443);

  return omitPort
    ? `${scheme}://${hostname}`
    : `${scheme}://${hostname}:${best.host}`;
}
