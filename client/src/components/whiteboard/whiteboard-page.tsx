"use client";

// DW2: Whiteboard page wrapper
// DW3: Collaborative whiteboard via WebSocket (signapps-collab port 3013)
// DW4: Shape library — arrow, sticky note, text box, circle, diamond, connector

import React, { useRef, useState, useCallback, useEffect } from "react";
import { WhiteboardCanvas } from "./whiteboard-canvas";
import {
  ArrowRight,
  StickyNote,
  RectangleHorizontal,
  Circle,
  Diamond,
  Minus,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { COLLAB_ENABLED } from "@/lib/api/core";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RemoteCursor {
  x: number;
  y: number;
  name: string;
  color: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shape presets (DW4)
// ─────────────────────────────────────────────────────────────────────────────

const SHAPE_PRESETS = [
  {
    id: "arrow",
    label: "Flèche",
    Icon: ArrowRight,
    svgPath: (x: number, y: number) =>
      `<g data-id="${Date.now()}" data-shape="arrow">
  <defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
    <polygon points="0 0, 10 3.5, 0 7" fill="#1e293b" />
  </marker></defs>
  <line x1="${x}" y1="${y}" x2="${x + 120}" y2="${y}" stroke="#1e293b" stroke-width="2" marker-end="url(#arrowhead)" />
</g>`,
  },
  {
    id: "sticky",
    label: "Post-it",
    Icon: StickyNote,
    svgPath: (x: number, y: number) =>
      `<g data-id="${Date.now()}" data-shape="sticky">
  <rect x="${x}" y="${y}" width="120" height="100" rx="4" fill="#fef08a" stroke="#eab308" stroke-width="1.5" />
  <text x="${x + 10}" y="${y + 22}" font-size="12" fill="#713f12" font-family="Arial">Note</text>
</g>`,
  },
  {
    id: "rect-text",
    label: "Rectangle",
    Icon: RectangleHorizontal,
    svgPath: (x: number, y: number) =>
      `<g data-id="${Date.now()}" data-shape="rect-text">
  <rect x="${x}" y="${y}" width="160" height="60" rx="6" fill="white" stroke="#3b82f6" stroke-width="2" />
  <text x="${x + 80}" y="${y + 35}" font-size="13" fill="#1e293b" font-family="Arial" text-anchor="middle">Texte</text>
</g>`,
  },
  {
    id: "circle-text",
    label: "Cercle",
    Icon: Circle,
    svgPath: (x: number, y: number) =>
      `<g data-id="${Date.now()}" data-shape="circle-text">
  <circle cx="${x + 50}" cy="${y + 50}" r="50" fill="white" stroke="#10b981" stroke-width="2" />
  <text x="${x + 50}" y="${y + 55}" font-size="13" fill="#1e293b" font-family="Arial" text-anchor="middle">Texte</text>
</g>`,
  },
  {
    id: "diamond",
    label: "Décision",
    Icon: Diamond,
    svgPath: (x: number, y: number) =>
      `<g data-id="${Date.now()}" data-shape="diamond">
  <polygon points="${x + 80},${y} ${x + 160},${y + 50} ${x + 80},${y + 100} ${x},${y + 50}" fill="white" stroke="#f59e0b" stroke-width="2" />
  <text x="${x + 80}" y="${y + 55}" font-size="12" fill="#1e293b" font-family="Arial" text-anchor="middle">Décision</text>
</g>`,
  },
  {
    id: "connector",
    label: "Connecteur",
    Icon: Minus,
    svgPath: (x: number, y: number) =>
      `<g data-id="${Date.now()}" data-shape="connector">
  <line x1="${x}" y1="${y}" x2="${x + 120}" y2="${y}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="8 4" />
</g>`,
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Collaboration hook (DW3)
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#f87171",
  "#fbbf24",
  "#34d399",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
];

function useWhiteboardCollab(
  roomId: string,
  svgRef: React.RefObject<SVGSVGElement | null>,
) {
  const [isConnected, setIsConnected] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<
    Record<number, RemoteCursor>
  >({});
  const providerRef = useRef<WebsocketProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const isBroadcasting = useRef(false);

  useEffect(() => {
    const collabEnabled = COLLAB_ENABLED;
    if (!collabEnabled) return;

    const doc = new Y.Doc();
    docRef.current = doc;
    const baseWs =
      process.env.NEXT_PUBLIC_COLLAB_WS_URL || "ws://localhost:3013";
    const wsUrl = `${baseWs}/api/v1/collab/ws/${roomId}`;
    const provider = new WebsocketProvider(wsUrl, roomId, doc, {
      connect: true,
    });
    providerRef.current = provider;

    const myColor =
      AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    provider.awareness.setLocalStateField("user", {
      name: "Utilisateur",
      color: myColor,
    });

    provider.on("status", (e: any) => setIsConnected(e.status === "connected"));

    // DW3: Sync SVG updates via Yjs shared map
    const yShapes = doc.getMap<string>("shapes");

    // Listen for remote shape changes and apply to SVG
    yShapes.observe(() => {
      if (!svgRef.current || isBroadcasting.current) return;
      // Remove all remotely-tracked shapes
      svgRef.current
        .querySelectorAll("[data-remote]")
        .forEach((el) => el.remove());
      // Re-add from Yjs
      yShapes.forEach((svgStr, _key) => {
        const tmp = document.createElementNS("http://www.w3.org/2000/svg", "g");
        tmp.innerHTML = svgStr;
        const child = tmp.firstElementChild;
        if (child) {
          (child as SVGElement).setAttribute("data-remote", "true");
          svgRef.current?.appendChild(child);
        }
      });
    });

    // Track remote cursors
    const handleAwareness = () => {
      const cursors: Record<number, RemoteCursor> = {};
      provider.awareness.getStates().forEach((state: any, clientId: number) => {
        if (clientId !== provider.awareness.clientID && state.cursor) {
          cursors[clientId] = {
            x: state.cursor.x,
            y: state.cursor.y,
            name: state.user?.name || "Anonyme",
            color: state.user?.color || "#94a3b8",
          };
        }
      });
      setRemoteCursors(cursors);
    };
    provider.awareness.on("change", handleAwareness);

    return () => {
      provider.awareness.setLocalState(null);
      provider.destroy();
      doc.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Broadcast a new shape to peers
  const broadcastShape = useCallback((svgStr: string, shapeId: string) => {
    if (!docRef.current) return;
    const yShapes = docRef.current.getMap<string>("shapes");
    isBroadcasting.current = true;
    yShapes.set(shapeId, svgStr);
    isBroadcasting.current = false;
  }, []);

  // Broadcast cursor position
  const broadcastCursor = useCallback((x: number, y: number) => {
    if (!providerRef.current) return;
    providerRef.current.awareness.setLocalStateField("cursor", { x, y });
  }, []);

  return { isConnected, remoteCursors, broadcastShape, broadcastCursor };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

export function WhiteboardPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const roomId = "whiteboard-main";
  const { isConnected, remoteCursors, broadcastShape, broadcastCursor } =
    useWhiteboardCollab(roomId, svgRef);

  // DW4: Insert a shape preset
  const insertShape = useCallback(
    (preset: (typeof SHAPE_PRESETS)[number]) => {
      const svg = svgRef.current;
      if (!svg) return;
      // Insert at center of visible area
      const rect = svg.getBoundingClientRect();
      const x = Math.round(rect.width / 2 - 80);
      const y = Math.round(rect.height / 2 - 50);
      const svgStr = preset.svgPath(x, y);
      const tmp = document.createElementNS("http://www.w3.org/2000/svg", "g");
      tmp.innerHTML = svgStr;
      const child = tmp.firstElementChild;
      if (child) {
        svg.appendChild(child);
        // Broadcast to peers
        const shapeId =
          (child as SVGElement).getAttribute("data-id") ||
          `shape-${Date.now()}`;
        broadcastShape(svgStr, shapeId);
      }
    },
    [broadcastShape],
  );

  // Track mouse for cursor broadcast
  const handleSvgMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = (e.target as SVGElement)
        .closest("svg")
        ?.getBoundingClientRect();
      if (!rect) return;
      broadcastCursor(e.clientX - rect.left, e.clientY - rect.top);
    },
    [broadcastCursor],
  );

  const collabCount = Object.keys(remoteCursors).length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0 bg-background/95">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Tableau blanc</span>
          {/* Connection status */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {isConnected ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-green-500" />
                <span className="text-green-600">Connecté</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Local</span>
              </>
            )}
          </div>
          {/* Collaborator count */}
          {collabCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>
                {collabCount} autre{collabCount > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* DW4: Shape library toolbar */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Formes:</span>
          {SHAPE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => insertShape(preset)}
              title={preset.label}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-border hover:bg-muted transition-colors"
            >
              <preset.Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas area */}
      <div
        className="flex-1 overflow-auto relative"
        onMouseMove={(e: React.MouseEvent) => {
          // Forward cursor to collaboration hook
          const svg = (e.currentTarget as HTMLElement).querySelector("svg");
          if (!svg) return;
          const rect = svg.getBoundingClientRect();
          broadcastCursor(e.clientX - rect.left, e.clientY - rect.top);
        }}
      >
        {/* Remote cursors overlay (DW3) */}
        {Object.entries(remoteCursors).map(([id, cursor]) => (
          <div
            key={id}
            className="pointer-events-none absolute z-50 flex items-start gap-1"
            style={{
              left: cursor.x + 16,
              top: cursor.y + 16,
              transform: "translate(0, 0)",
            }}
          >
            <div
              className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.name.slice(0, 1).toUpperCase()}
            </div>
            <span
              className="text-[10px] px-1 rounded text-white whitespace-nowrap"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.name}
            </span>
          </div>
        ))}

        {/* Existing whiteboard canvas — pass svgRef for DW3 broadcasting */}
        <WhiteboardCanvas svgRef={svgRef} />
      </div>
    </div>
  );
}

export default WhiteboardPage;
