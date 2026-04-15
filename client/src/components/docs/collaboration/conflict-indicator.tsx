"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { usePresenceStore } from "@/stores/presence-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConflictIndicatorProps {
  className?: string;
}

interface ConflictEvent {
  id: string;
  timestamp: Date;
  type: "merge" | "auto-resolved" | "overwritten";
  affectedBy: string[];
  description: string;
}

/**
 * Shows when the document has been merged with remote changes.
 * Provides transparency about CRDT conflict resolution.
 */
export function ConflictIndicator({ className }: ConflictIndicatorProps) {
  const [recentConflicts, setRecentConflicts] = useState<ConflictEvent[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const isSynced = usePresenceStore((state) => state.isSynced);
  const connectionStatus = usePresenceStore((state) => state.connectionStatus);

  // Clear old conflicts after 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRecentConflicts((prev) =>
        prev.filter((c) => now - c.timestamp.getTime() < 30000),
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Add a conflict event (called by collaboration system)
  const addConflict = (
    type: ConflictEvent["type"],
    affectedBy: string[],
    description: string,
  ) => {
    const event: ConflictEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type,
      affectedBy,
      description,
    };
    setRecentConflicts((prev) => [...prev.slice(-9), event]);
  };

  // Make addConflict available globally for the collaboration system
  useEffect(() => {
    window.__signAppsAddConflict = addConflict;
    return () => {
      delete window.__signAppsAddConflict;
    };
  }, []);

  if (recentConflicts.length === 0 || connectionStatus === "disconnected") {
    return null;
  }

  const latestConflict = recentConflicts[recentConflicts.length - 1];
  const conflictTypeConfig = {
    merge: {
      icon: "⟳",
      label: "Merged",
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    "auto-resolved": {
      icon: "✓",
      label: "Auto-resolved",
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    overwritten: {
      icon: "!",
      label: "Overwritten",
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
  };

  const config = conflictTypeConfig[latestConflict.type];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
              config.bgColor,
              config.color,
              "hover:opacity-80",
              className,
            )}
          >
            <span className="font-medium">{config.icon}</span>
            <span>{config.label}</span>
            {recentConflicts.length > 1 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-current/10 text-[10px]">
                {recentConflicts.length}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium text-sm">Recent sync events</p>
            <div className="space-y-1">
              {recentConflicts.slice(-5).map((conflict) => (
                <div
                  key={conflict.id}
                  className="text-xs text-muted-foreground"
                >
                  <span className="font-medium">
                    {conflictTypeConfig[conflict.type].label}
                  </span>
                  : {conflict.description}
                  {conflict.affectedBy.length > 0 && (
                    <span className="text-xs opacity-75">
                      {" "}
                      by {conflict.affectedBy.join(", ")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface SyncHistoryProps {
  className?: string;
  maxItems?: number;
}

/**
 * Panel showing the history of sync operations.
 */
export function SyncHistoryPanel({
  className,
  maxItems = 20,
}: SyncHistoryProps) {
  const [history, setHistory] = useState<ConflictEvent[]>([]);
  const connectionStatus = usePresenceStore((state) => state.connectionStatus);
  const pendingChanges = usePresenceStore((state) => state.pendingChanges);

  // Listen for sync events
  useEffect(() => {
    const originalAddConflict = window.__signAppsAddConflict;

    window.__signAppsAddConflict = (
      type: ConflictEvent["type"],
      affectedBy: string[],
      description: string,
    ) => {
      const event: ConflictEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type,
        affectedBy,
        description,
      };
      setHistory((prev) => [...prev.slice(-(maxItems - 1)), event]);

      // Call the original if it exists
      if (originalAddConflict) {
        originalAddConflict(type, affectedBy, description);
      }
    };

    return () => {
      window.__signAppsAddConflict = originalAddConflict;
    };
  }, [maxItems]);

  return (
    <div className={cn("p-4 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Sync History</h3>
        <div className="flex items-center gap-2">
          <StatusBadge status={connectionStatus} />
          {pendingChanges > 0 && (
            <span className="text-xs text-orange-600 dark:text-orange-400">
              {pendingChanges} pending
            </span>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sync events yet</p>
      ) : (
        <div className="space-y-2">
          {history
            .slice()
            .reverse()
            .map((event) => (
              <SyncEventItem key={event.id} event={event} />
            ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "connecting" | "connected" | "disconnected" | "reconnecting";
}) {
  const config = {
    connecting: { color: "bg-yellow-500", label: "Connecting" },
    connected: { color: "bg-green-500", label: "Connecté" },
    disconnected: { color: "bg-red-500", label: "Offline" },
    reconnecting: { color: "bg-yellow-500", label: "Reconnecting" },
  };

  const { color, label } = config[status];

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      {label}
    </span>
  );
}

function SyncEventItem({ event }: { event: ConflictEvent }) {
  const typeConfig = {
    merge: { icon: "⟳", color: "text-blue-500" },
    "auto-resolved": { icon: "✓", color: "text-green-500" },
    overwritten: { icon: "!", color: "text-orange-500" },
  };

  const config = typeConfig[event.type];

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border last:border-0">
      <span className={cn("mt-0.5", config.color)}>{config.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{event.description}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatTime(event.timestamp)}</span>
          {event.affectedBy.length > 0 && (
            <>
              <span>•</span>
              <span>{event.affectedBy.join(", ")}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 60) {
    return "Just now";
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}
