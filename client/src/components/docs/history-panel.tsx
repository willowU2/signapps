"use client";

// RT4: Real-time modification history panel
// Shows a live timeline of recent document changes with user + timestamp

import { useEffect, useRef, useState } from "react";
import { History, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface HistoryEntry {
  id: string;
  author: string;
  authorColor: string;
  description: string;
  timestamp: Date;
}

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  entries: HistoryEntry[];
  className?: string;
}

export function HistoryPanel({
  open,
  onClose,
  entries,
  className,
}: HistoryPanelProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        "flex flex-col h-full w-64 border-l bg-background shrink-0",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Historique</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Timeline */}
      <ScrollArea className="flex-1">
        <div className="px-3 py-2 space-y-1">
          {entries.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Aucune modification récente
            </div>
          ) : (
            entries.map((entry, idx) => (
              <div key={entry.id} className="flex items-start gap-2 py-1.5">
                {/* Avatar */}
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5"
                  style={{ backgroundColor: entry.authorColor }}
                  title={entry.author}
                >
                  {entry.author.slice(0, 2).toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs font-medium truncate">
                      {entry.author}
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(entry.timestamp, {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {entry.description}
                  </p>
                </div>
                {/* Timeline line */}
                {idx < entries.length - 1 && (
                  <div className="absolute left-[19px] top-7 w-px h-full bg-border" />
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Hook to track Yjs awareness updates as history entries.
 * Pass the WebsocketProvider awareness object.
 */
export function useHistoryEntries(maxEntries = 50) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const counterRef = useRef(0);

  const addEntry = (
    author: string,
    authorColor: string,
    description: string,
  ) => {
    counterRef.current += 1;
    const entry: HistoryEntry = {
      id: `${Date.now()}-${counterRef.current}`,
      author,
      authorColor,
      description,
      timestamp: new Date(),
    };
    setEntries((prev) => [entry, ...prev].slice(0, maxEntries));
  };

  return { entries, addEntry };
}
