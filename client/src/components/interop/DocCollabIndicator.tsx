"use client";

/**
 * Feature 15: Doc collab → show who's editing in real-time indicator
 */

import { useEffect, useState } from "react";
import { Users, Circle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Editor {
  id: string;
  name: string;
  color: string;
  cursor?: { line: number; ch: number };
  lastSeen: number;
}

interface DocCollabIndicatorProps {
  docId: string;
  currentUserId?: string;
}

const COLORS = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#3b82f6",
  "#8b5cf6",
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function DocCollabIndicator({
  docId,
  currentUserId,
}: DocCollabIndicatorProps) {
  const [editors, setEditors] = useState<Editor[]>([]);

  useEffect(() => {
    if (!docId) return;

    // Announce presence via BroadcastChannel
    const channel = new BroadcastChannel(`doc-collab:${docId}`);

    const myself: Editor = {
      id: currentUserId ?? `user-${Math.random().toString(36).slice(2, 8)}`,
      name: "Vous",
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      lastSeen: Date.now(),
    };

    // Broadcast own presence every 5s
    const announce = () => {
      channel.postMessage({
        type: "presence",
        editor: { ...myself, lastSeen: Date.now() },
      });
    };
    announce();
    const timer = setInterval(announce, 5000);

    channel.onmessage = (e) => {
      if (e.data?.type !== "presence") return;
      const incoming: Editor = e.data.editor;
      if (incoming.id === myself.id) return;
      setEditors((prev) => {
        const filtered = prev.filter((ed) => ed.id !== incoming.id);
        return [...filtered, incoming];
      });
    };

    // Remove stale editors (>15s without ping)
    const pruneTimer = setInterval(() => {
      const cutoff = Date.now() - 15_000;
      setEditors((prev) => prev.filter((ed) => ed.lastSeen > cutoff));
    }, 5000);

    return () => {
      clearInterval(timer);
      clearInterval(pruneTimer);
      channel.close();
    };
  }, [docId, currentUserId]);

  if (editors.length === 0) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="flex -space-x-1.5">
          {editors.slice(0, 5).map((ed) => (
            <Tooltip key={ed.id}>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Avatar
                    className="h-6 w-6 border-2 border-background"
                    style={{ borderColor: ed.color }}
                  >
                    <AvatarFallback
                      style={{ backgroundColor: ed.color, color: "white" }}
                      className="text-[10px] font-semibold"
                    >
                      {getInitials(ed.name)}
                    </AvatarFallback>
                  </Avatar>
                  <Circle className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-green-500 text-green-500" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {ed.name} édite ce document
              </TooltipContent>
            </Tooltip>
          ))}
          {editors.length > 5 && (
            <div className="h-6 w-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
              +{editors.length - 5}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
