"use client";

import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";

import { Badge } from "@/components/ui/badge";

import { useYjsStoreWhiteboard } from "./use-whiteboard-yjs";

/**
 * In-meeting collaborative whiteboard.
 *
 * Wraps tldraw v4 and binds its store to a Yjs document shared over
 * `signapps-collaboration` (port 3013). The room code isolates the doc
 * per-meeting so whiteboards don't cross-contaminate across rooms.
 */
export function MeetWhiteboard({ roomCode }: { roomCode: string }) {
  const { store, status } = useYjsStoreWhiteboard(roomCode);

  const statusLabel =
    status === "connected"
      ? "Connecté"
      : status === "connecting"
        ? "Connexion…"
        : status === "offline"
          ? "Hors ligne"
          : "Déconnecté";

  const statusTone =
    status === "connected"
      ? "bg-primary/15 text-primary"
      : status === "connecting"
        ? "bg-muted text-muted-foreground"
        : "bg-destructive/15 text-destructive";

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-2 right-2 z-10">
        <Badge className={`${statusTone} text-[10px] gap-1`}>
          {statusLabel}
        </Badge>
      </div>
      <div className="h-full w-full">
        <Tldraw store={store} />
      </div>
    </div>
  );
}
