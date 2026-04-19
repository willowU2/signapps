"use client";

/**
 * Hook `usePxeDeploymentStream`
 *
 * Subscribes to the SSE endpoint
 * `GET /api/v1/pxe/deployments/:mac/stream` and accumulates updates.
 *
 * Cookies (JWT) are sent automatically via `EventSource` because the
 * connection is same-origin through the Next.js dev server or the
 * gateway in production. Note: `EventSource` does not allow custom
 * headers, so auth MUST rely on the session cookie set by the identity
 * service.
 *
 * Returns:
 *   - `updates`    — rolling list of progress events received so far
 *   - `error`      — non-null when the connection is dropped
 *   - `connected`  — true after the first event
 */

import { useEffect, useRef, useState } from "react";
import { GATEWAY_URL } from "@/lib/api/core";

export type DeploymentUpdate = {
  mac: string;
  progress: number;
  status: string;
  step?: string | null;
};

export function usePxeDeploymentStream(mac: string | undefined) {
  const [updates, setUpdates] = useState<DeploymentUpdate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const srcRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!mac) return;

    const encoded = encodeURIComponent(mac);
    const url = `${GATEWAY_URL}/api/v1/pxe/deployments/${encoded}/stream`;
    const src = new EventSource(url, { withCredentials: true });
    srcRef.current = src;

    src.onopen = () => {
      setError(null);
    };

    src.onmessage = (ev) => {
      setConnected(true);
      try {
        const data = JSON.parse(ev.data) as DeploymentUpdate;
        setUpdates((prev) => [...prev, data]);
      } catch {
        // Payload was not valid JSON — keep a debug trail without
        // poisoning the user-visible state. We intentionally avoid
        // console.error in production code.
      }
    };

    src.onerror = () => {
      setError("Connexion SSE perdue — reconnexion auto…");
    };

    return () => {
      src.close();
      srcRef.current = null;
    };
  }, [mac]);

  return { updates, error, connected };
}
