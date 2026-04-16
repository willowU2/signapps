"use client";

// DW2: Whiteboard page wrapper with board management
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
  Plus,
  Pencil,
  Trash2,
  Layout,
  GitBranch,
  Network,
  Brain,
  FileText,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { COLLAB_ENABLED, COLLAB_WS_URL } from "@/lib/api/core";
import {
  collaborationApi,
  type Board,
  type CreateBoardPayload,
} from "@/lib/api/collaboration";

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
// Shape presets (DW4) — SVG builder via DOM API (no innerHTML)
// ─────────────────────────────────────────────────────────────────────────────

function createSvgElement(
  tag: string,
  attrs: Record<string, string | number>,
): SVGElement {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

function buildArrowShape(x: number, y: number): SVGElement {
  const g = createSvgElement("g", {
    "data-id": Date.now(),
    "data-shape": "arrow",
  });
  const markerId = `arrowhead-${Date.now()}`;
  const defs = createSvgElement("defs", {});
  const marker = createSvgElement("marker", {
    id: markerId,
    markerWidth: 10,
    markerHeight: 7,
    refX: 10,
    refY: 3.5,
    orient: "auto",
  });
  const polygon = createSvgElement("polygon", {
    points: "0 0, 10 3.5, 0 7",
    fill: "#1e293b",
  });
  marker.appendChild(polygon);
  defs.appendChild(marker);
  g.appendChild(defs);
  const line = createSvgElement("line", {
    x1: x,
    y1: y,
    x2: x + 120,
    y2: y,
    stroke: "#1e293b",
    "stroke-width": 2,
    "marker-end": `url(#${markerId})`,
  });
  g.appendChild(line);
  return g;
}

function buildStickyShape(x: number, y: number): SVGElement {
  const g = createSvgElement("g", {
    "data-id": Date.now(),
    "data-shape": "sticky",
  });
  g.appendChild(
    createSvgElement("rect", {
      x,
      y,
      width: 120,
      height: 100,
      rx: 4,
      fill: "#fef08a",
      stroke: "#eab308",
      "stroke-width": 1.5,
    }),
  );
  const text = createSvgElement("text", {
    x: x + 10,
    y: y + 22,
    "font-size": 12,
    fill: "#713f12",
    "font-family": "Arial",
  });
  text.textContent = "Note";
  g.appendChild(text);
  return g;
}

function buildRectTextShape(x: number, y: number): SVGElement {
  const g = createSvgElement("g", {
    "data-id": Date.now(),
    "data-shape": "rect-text",
  });
  g.appendChild(
    createSvgElement("rect", {
      x,
      y,
      width: 160,
      height: 60,
      rx: 6,
      fill: "white",
      stroke: "#3b82f6",
      "stroke-width": 2,
    }),
  );
  const text = createSvgElement("text", {
    x: x + 80,
    y: y + 35,
    "font-size": 13,
    fill: "#1e293b",
    "font-family": "Arial",
    "text-anchor": "middle",
  });
  text.textContent = "Texte";
  g.appendChild(text);
  return g;
}

function buildCircleTextShape(x: number, y: number): SVGElement {
  const g = createSvgElement("g", {
    "data-id": Date.now(),
    "data-shape": "circle-text",
  });
  g.appendChild(
    createSvgElement("circle", {
      cx: x + 50,
      cy: y + 50,
      r: 50,
      fill: "white",
      stroke: "#10b981",
      "stroke-width": 2,
    }),
  );
  const text = createSvgElement("text", {
    x: x + 50,
    y: y + 55,
    "font-size": 13,
    fill: "#1e293b",
    "font-family": "Arial",
    "text-anchor": "middle",
  });
  text.textContent = "Texte";
  g.appendChild(text);
  return g;
}

function buildDiamondShape(x: number, y: number): SVGElement {
  const g = createSvgElement("g", {
    "data-id": Date.now(),
    "data-shape": "diamond",
  });
  g.appendChild(
    createSvgElement("polygon", {
      points: `${x + 80},${y} ${x + 160},${y + 50} ${x + 80},${y + 100} ${x},${y + 50}`,
      fill: "white",
      stroke: "#f59e0b",
      "stroke-width": 2,
    }),
  );
  const text = createSvgElement("text", {
    x: x + 80,
    y: y + 55,
    "font-size": 12,
    fill: "#1e293b",
    "font-family": "Arial",
    "text-anchor": "middle",
  });
  text.textContent = "Decision";
  g.appendChild(text);
  return g;
}

function buildConnectorShape(x: number, y: number): SVGElement {
  const g = createSvgElement("g", {
    "data-id": Date.now(),
    "data-shape": "connector",
  });
  g.appendChild(
    createSvgElement("line", {
      x1: x,
      y1: y,
      x2: x + 120,
      y2: y,
      stroke: "#94a3b8",
      "stroke-width": 2,
      "stroke-dasharray": "8 4",
    }),
  );
  return g;
}

const SHAPE_PRESETS = [
  { id: "arrow", label: "Fleche", Icon: ArrowRight, build: buildArrowShape },
  { id: "sticky", label: "Post-it", Icon: StickyNote, build: buildStickyShape },
  {
    id: "rect-text",
    label: "Rectangle",
    Icon: RectangleHorizontal,
    build: buildRectTextShape,
  },
  {
    id: "circle-text",
    label: "Cercle",
    Icon: Circle,
    build: buildCircleTextShape,
  },
  { id: "diamond", label: "Decision", Icon: Diamond, build: buildDiamondShape },
  {
    id: "connector",
    label: "Connecteur",
    Icon: Minus,
    build: buildConnectorShape,
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

interface BoardTemplate {
  id: string;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  boardType: string;
  data: Record<string, unknown>;
}

const TEMPLATES: BoardTemplate[] = [
  {
    id: "blank",
    label: "Vierge",
    description: "Un tableau blanc vide",
    Icon: FileText,
    boardType: "whiteboard",
    data: {},
  },
  {
    id: "flowchart",
    label: "Diagramme de flux",
    description: "Processus avec decisions et etapes",
    Icon: GitBranch,
    boardType: "flowchart",
    data: {
      template: "flowchart",
      presetShapes: [
        { type: "rect-text", x: 100, y: 50, text: "Debut" },
        { type: "diamond", x: 100, y: 150, text: "Condition?" },
        { type: "rect-text", x: 100, y: 280, text: "Etape" },
        { type: "rect-text", x: 100, y: 380, text: "Fin" },
      ],
    },
  },
  {
    id: "orgchart",
    label: "Organigramme",
    description: "Hierarchie d'equipe et d'organisation",
    Icon: Network,
    boardType: "orgchart",
    data: {
      template: "orgchart",
      presetShapes: [
        { type: "rect-text", x: 300, y: 30, text: "Direction" },
        { type: "rect-text", x: 100, y: 140, text: "Equipe A" },
        { type: "rect-text", x: 300, y: 140, text: "Equipe B" },
        { type: "rect-text", x: 500, y: 140, text: "Equipe C" },
      ],
    },
  },
  {
    id: "mindmap",
    label: "Mind Map",
    description: "Brainstorming et idees en arbre",
    Icon: Brain,
    boardType: "mindmap",
    data: {
      template: "mindmap",
      presetShapes: [
        { type: "circle-text", x: 300, y: 220, text: "Idee centrale" },
        { type: "rect-text", x: 100, y: 80, text: "Branche 1" },
        { type: "rect-text", x: 300, y: 80, text: "Branche 2" },
        { type: "rect-text", x: 500, y: 80, text: "Branche 3" },
        { type: "rect-text", x: 100, y: 360, text: "Branche 4" },
        { type: "rect-text", x: 500, y: 360, text: "Branche 5" },
      ],
    },
  },
  {
    id: "kanban",
    label: "Kanban",
    description: "Colonnes de taches a faire / en cours / fait",
    Icon: Layout,
    boardType: "kanban",
    data: {
      template: "kanban",
      presetShapes: [
        { type: "rect-text", x: 30, y: 30, text: "A faire" },
        { type: "rect-text", x: 250, y: 30, text: "En cours" },
        { type: "rect-text", x: 470, y: 30, text: "Fait" },
        { type: "sticky", x: 30, y: 110 },
        { type: "sticky", x: 30, y: 230 },
        { type: "sticky", x: 250, y: 110 },
        { type: "sticky", x: 470, y: 110 },
      ],
    },
  },
];

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
    const baseWs = COLLAB_WS_URL;
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

    // Listen for remote shape changes and apply to SVG — uses DOMParser for safe SVG parsing
    yShapes.observe(() => {
      if (!svgRef.current || isBroadcasting.current) return;
      svgRef.current
        .querySelectorAll("[data-remote]")
        .forEach((el) => el.remove());
      yShapes.forEach((svgStr, _key) => {
        const parser = new DOMParser();
        const parsed = parser.parseFromString(svgStr, "image/svg+xml");
        const child = parsed.documentElement;
        if (child && !parsed.querySelector("parsererror")) {
          const imported = document.importNode(
            child,
            true,
          ) as unknown as SVGElement;
          imported.setAttribute("data-remote", "true");
          svgRef.current?.appendChild(imported);
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
  const broadcastShape = useCallback((svgEl: SVGElement) => {
    if (!docRef.current) return;
    const yShapes = docRef.current.getMap<string>("shapes");
    isBroadcasting.current = true;
    const shapeId = svgEl.getAttribute("data-id") || `shape-${Date.now()}`;
    yShapes.set(shapeId, new XMLSerializer().serializeToString(svgEl));
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
// Board List View
// ─────────────────────────────────────────────────────────────────────────────

interface BoardListProps {
  onSelectBoard: (board: Board) => void;
  onNewBoard: (template: BoardTemplate) => void;
}

function BoardList({ onSelectBoard, onNewBoard }: BoardListProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [renameBoard, setRenameBoard] = useState<Board | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const loadBoards = useCallback(async () => {
    setLoading(true);
    try {
      const data = await collaborationApi.listBoards();
      setBoards(data);
    } catch {
      // Service may be offline, show empty list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await collaborationApi.deleteBoard(id);
      toast.success("Tableau supprime");
      loadBoards();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleRename = async () => {
    if (!renameBoard || !renameTitle.trim()) return;
    try {
      await collaborationApi.updateBoard(renameBoard.id, {
        title: renameTitle.trim(),
      });
      toast.success("Tableau renomme");
      setRenameBoard(null);
      loadBoards();
    } catch {
      toast.error("Erreur lors du renommage");
    }
  };

  const openRename = (board: Board, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameBoard(board);
    setRenameTitle(board.title);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">Tableaux blancs</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Collaborez en temps reel sur vos tableaux
          </p>
        </div>
        <Button onClick={() => setShowTemplates(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau tableau
        </Button>
      </div>

      {/* Board grid */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : boards.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <Layout className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              Aucun tableau. Creez-en un pour commencer.
            </p>
            <Button onClick={() => setShowTemplates(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Creer un tableau
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {boards.map((board) => (
              <Card
                key={board.id}
                className="cursor-pointer hover:border-primary/50 transition-colors group"
                onClick={() => onSelectBoard(board)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm font-medium truncate pr-2">
                      {board.title}
                    </CardTitle>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => openRename(board, e)}
                        className="p-1 rounded hover:bg-muted"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(board.id, e)}
                        className="p-1 rounded hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="h-24 bg-muted/50 rounded border border-border flex items-center justify-center">
                    <Layout className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    {board.board_type && (
                      <Badge variant="outline" className="text-[10px]">
                        {board.board_type}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(board.updated_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Template gallery dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choisir un modele</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => {
                  setShowTemplates(false);
                  onNewBoard(tpl);
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-center"
              >
                <tpl.Icon className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">{tpl.label}</span>
                <span className="text-xs text-muted-foreground">
                  {tpl.description}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog
        open={renameBoard !== null}
        onOpenChange={(o) => !o && setRenameBoard(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer le tableau</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            placeholder="Nouveau nom..."
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameBoard(null)}>
              Annuler
            </Button>
            <Button onClick={handleRename}>Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

export function WhiteboardPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [view, setView] = useState<"list" | "canvas">("list");

  const roomId = activeBoard?.id || "whiteboard-main";
  const { isConnected, remoteCursors, broadcastShape, broadcastCursor } =
    useWhiteboardCollab(roomId, svgRef);

  // DW4: Insert a shape preset — uses DOM builder (no innerHTML)
  const insertShape = useCallback(
    (preset: (typeof SHAPE_PRESETS)[number]) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = Math.round(rect.width / 2 - 80);
      const y = Math.round(rect.height / 2 - 50);
      const child = preset.build(x, y);
      svg.appendChild(child);
      broadcastShape(child);
    },
    [broadcastShape],
  );

  const handleSelectBoard = (board: Board) => {
    setActiveBoard(board);
    setView("canvas");
  };

  const handleNewBoard = async (template: BoardTemplate) => {
    try {
      const payload: CreateBoardPayload = {
        title: `${template.label} - ${new Date().toLocaleDateString("fr-FR")}`,
        board_type: template.boardType,
        data: template.data,
      };
      const board = await collaborationApi.createBoard(payload);
      toast.success("Tableau cree");
      setActiveBoard(board);
      setView("canvas");
    } catch {
      // Fallback: open canvas without backend persistence
      toast.info("Mode local - le tableau ne sera pas sauvegarde");
      setActiveBoard(null);
      setView("canvas");
    }
  };

  const handleBackToList = () => {
    setView("list");
    setActiveBoard(null);
  };

  // Save board data periodically
  useEffect(() => {
    if (!activeBoard || !svgRef.current) return;
    const interval = setInterval(async () => {
      const svg = svgRef.current;
      if (!svg) return;
      const shapes: string[] = [];
      svg.querySelectorAll("[data-id]").forEach((el) => {
        shapes.push(new XMLSerializer().serializeToString(el));
      });
      try {
        await collaborationApi.updateBoard(activeBoard.id, {
          data: { shapes, updatedAt: new Date().toISOString() },
        });
      } catch {
        // Silent fail — auto-save is best-effort
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeBoard]);

  const collabCount = Object.keys(remoteCursors).length;

  // Board list view
  if (view === "list") {
    return (
      <BoardList
        onSelectBoard={handleSelectBoard}
        onNewBoard={handleNewBoard}
      />
    );
  }

  // Canvas view
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0 bg-background/95">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToList}
            className="gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Tableaux
          </Button>
          <span className="font-semibold text-sm">
            {activeBoard?.title || "Tableau blanc"}
          </span>
          {/* Connection status */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {isConnected ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-green-500" />
                <span className="text-green-600">Connecte</span>
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
        className="flex-1 overflow-hidden relative"
        onMouseMove={(e: React.MouseEvent) => {
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

        {/* Whiteboard canvas with tools */}
        <WhiteboardCanvas svgRef={svgRef} />
      </div>
    </div>
  );
}
