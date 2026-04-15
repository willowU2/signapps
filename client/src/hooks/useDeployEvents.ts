/**
 * Subscribe to /api/v1/deploy/events WebSocket.
 *
 * Auto-reconnects with exponential backoff (1s, 2s, 4s, 8s, max 30s).
 * Emits each JSON frame to the provided callback.
 */
import { useEffect, useRef } from "react";
import { getServiceBaseUrl, ServiceName } from "@/lib/api/factory";

export interface DeployEvent {
  channel: string;
  payload: unknown;
}

export function useDeployEvents(onEvent: (event: DeployEvent) => void) {
  const reconnectDelay = useRef(1000);
  const shouldRun = useRef(true);

  useEffect(() => {
    shouldRun.current = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!shouldRun.current) return;

      const baseUrl = getServiceBaseUrl(ServiceName.DEPLOY);
      const wsUrl = baseUrl.replace(/^http/, "ws") + "/api/v1/deploy/events";
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        reconnectDelay.current = 1000;
      };

      socket.onmessage = (e) => {
        try {
          const frame: DeployEvent = JSON.parse(e.data);
          onEvent(frame);
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        if (!shouldRun.current) return;
        reconnectTimer = setTimeout(connect, reconnectDelay.current);
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      shouldRun.current = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [onEvent]);
}
