import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { ContainerPortMapping } from "@/hooks/use-containers"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
