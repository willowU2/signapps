"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { cn } from "@/lib/utils";

/**
 * OfflineBanner — PW1
 *
 * Shows a persistent yellow banner when the browser is offline, and a brief
 * green "reconnected" flash when connectivity is restored.
 * Also renders a small sync-pending indicator in the header area when there
 * are mutations queued in the offline sync queue.
 */
export function OfflineBanner() {
  const [mounted, setMounted] = useState(false);
  const { isOnline, queueSize } = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowReconnected(false);
    } else if (wasOffline) {
      // Briefly show the "reconnected" banner then hide it
      setShowReconnected(true);
      setWasOffline(false);
      const t = setTimeout(() => setShowReconnected(false), 3500);
      return () => clearTimeout(t);
    }
  }, [isOnline, wasOffline]);

  if (!mounted || (isOnline && !showReconnected)) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium shadow-md transition-all duration-300",
        showReconnected
          ? "bg-green-500 text-white"
          : "bg-amber-400 text-amber-950",
      )}
    >
      {showReconnected ? (
        <>
          <Wifi className="h-4 w-4 shrink-0" />
          <span>Connexion retablie — synchronisation en cours&hellip;</span>
          {queueSize > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
              <RefreshCw className="h-3 w-3 animate-spin" />
              {queueSize}
            </span>
          )}
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            Vous etes hors ligne — les modifications seront synchronisees
          </span>
          {queueSize > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/20 px-2 py-0.5 text-xs">
              {queueSize} en attente
            </span>
          )}
        </>
      )}
    </div>
  );
}

/**
 * SyncIndicator — small icon shown in header when pending mutations exist.
 */
export function SyncIndicator() {
  const { isOnline, queueSize } = useOnlineStatus();

  if (isOnline && queueSize === 0) return null;

  return (
    <span
      title={
        isOnline
          ? `${queueSize} modification(s) en cours de sync`
          : `Hors ligne — ${queueSize} modification(s) en attente`
      }
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        isOnline
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      )}
    >
      {isOnline ? (
        <RefreshCw className="h-3 w-3 animate-spin" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      {queueSize}
    </span>
  );
}
