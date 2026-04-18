"use client";

import { useState, useEffect, useMemo } from "react";
import { useDesignStore } from "@/stores/design-store";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Square,
  Circle,
  Triangle,
  Star,
  Diamond,
  Hexagon,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Minus,
  MoveRight,
  Search,
  Heart,
  Shield,
  Zap,
  Cloud,
  Sun,
  Moon,
  Flag,
  Bookmark,
  Bell,
  Phone,
  Mail,
  MapPin,
  Home,
  Settings,
  Camera,
  Music,
  Wifi,
  Lock,
  Unlock,
  Eye,
  Check,
  X,
  Plus,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import type { DesignObject } from "./types";
import { cn } from "@/lib/utils";
import type * as fabric from "fabric";

/** fabric.Object extended with the id property used in this codebase */
interface FabricObjectWithId extends fabric.Object {
  id?: string;
}

interface DesignShapesLibraryProps {
  fabricCanvasRef: React.MutableRefObject<fabric.Canvas | null>;
}

interface ShapeDef {
  id: string;
  name: string;
  icon: LucideIcon;
  category: string;
  createFn: (fabricModule: any) => any;
}

const SHAPES: ShapeDef[] = [
  // Basic
  {
    id: "rect",
    name: "Rectangle",
    icon: Square,
    category: "Basic",
    createFn: (fm) =>
      new fm.Rect({
        left: 100,
        top: 100,
        width: 200,
        height: 150,
        fill: "#4f46e5",
        rx: 8,
        ry: 8,
      }),
  },
  {
    id: "circle",
    name: "Circle",
    icon: Circle,
    category: "Basic",
    createFn: (fm) =>
      new fm.Circle({ left: 100, top: 100, radius: 80, fill: "#059669" }),
  },
  {
    id: "triangle",
    name: "Triangle",
    icon: Triangle,
    category: "Basic",
    createFn: (fm) =>
      new fm.Triangle({
        left: 100,
        top: 100,
        width: 160,
        height: 140,
        fill: "#d97706",
      }),
  },
  {
    id: "star",
    name: "Star",
    icon: Star,
    category: "Basic",
    createFn: (fm) => {
      const pts = starPoints(5, 80, 40);
      return new fm.Polygon(pts, { left: 100, top: 100, fill: "#e11d48" });
    },
  },
  {
    id: "diamond",
    name: "Diamond",
    icon: Diamond,
    category: "Basic",
    createFn: (fm) => {
      const pts = [
        { x: 80, y: 0 },
        { x: 160, y: 100 },
        { x: 80, y: 200 },
        { x: 0, y: 100 },
      ];
      return new fm.Polygon(pts, { left: 100, top: 100, fill: "#7c3aed" });
    },
  },
  {
    id: "hexagon",
    name: "Hexagon",
    icon: Hexagon,
    category: "Basic",
    createFn: (fm) => {
      const pts = regularPolygonPoints(6, 80);
      return new fm.Polygon(pts, { left: 100, top: 100, fill: "#0891b2" });
    },
  },
  // Lines
  {
    id: "line",
    name: "Line",
    icon: Minus,
    category: "Lines",
    createFn: (fm) =>
      new fm.Line([100, 100, 400, 100], { stroke: "#000000", strokeWidth: 3 }),
  },
  {
    id: "arrow-line",
    name: "Arrow",
    icon: MoveRight,
    category: "Lines",
    createFn: (fm) =>
      new fm.Line([100, 100, 400, 100], { stroke: "#000000", strokeWidth: 3 }),
  },
  // Arrows
  {
    id: "arrow-right",
    name: "Arrow Right",
    icon: ArrowRight,
    category: "Arrows",
    createFn: (fm) => {
      const pts = [
        { x: 0, y: 30 },
        { x: 100, y: 30 },
        { x: 100, y: 0 },
        { x: 150, y: 50 },
        { x: 100, y: 100 },
        { x: 100, y: 70 },
        { x: 0, y: 70 },
      ];
      return new fm.Polygon(pts, { left: 100, top: 100, fill: "#4f46e5" });
    },
  },
  {
    id: "arrow-left",
    name: "Arrow Left",
    icon: ArrowLeft,
    category: "Arrows",
    createFn: (fm) => {
      const pts = [
        { x: 150, y: 30 },
        { x: 50, y: 30 },
        { x: 50, y: 0 },
        { x: 0, y: 50 },
        { x: 50, y: 100 },
        { x: 50, y: 70 },
        { x: 150, y: 70 },
      ];
      return new fm.Polygon(pts, { left: 100, top: 100, fill: "#059669" });
    },
  },
  {
    id: "arrow-up",
    name: "Arrow Up",
    icon: ArrowUp,
    category: "Arrows",
    createFn: (fm) => {
      const pts = [
        { x: 30, y: 150 },
        { x: 30, y: 50 },
        { x: 0, y: 50 },
        { x: 50, y: 0 },
        { x: 100, y: 50 },
        { x: 70, y: 50 },
        { x: 70, y: 150 },
      ];
      return new fm.Polygon(pts, { left: 100, top: 100, fill: "#d97706" });
    },
  },
  {
    id: "arrow-down",
    name: "Arrow Down",
    icon: ArrowDown,
    category: "Arrows",
    createFn: (fm) => {
      const pts = [
        { x: 30, y: 0 },
        { x: 30, y: 100 },
        { x: 0, y: 100 },
        { x: 50, y: 150 },
        { x: 100, y: 100 },
        { x: 70, y: 100 },
        { x: 70, y: 0 },
      ];
      return new fm.Polygon(pts, { left: 100, top: 100, fill: "#e11d48" });
    },
  },
];

// Icons that can be inserted as SVG text on canvas
const ICON_LIST: { name: string; icon: LucideIcon }[] = [
  { name: "Heart", icon: Heart },
  { name: "Star", icon: Star },
  { name: "Shield", icon: Shield },
  { name: "Zap", icon: Zap },
  { name: "Cloud", icon: Cloud },
  { name: "Sun", icon: Sun },
  { name: "Moon", icon: Moon },
  { name: "Flag", icon: Flag },
  { name: "Bookmark", icon: Bookmark },
  { name: "Bell", icon: Bell },
  { name: "Phone", icon: Phone },
  { name: "Mail", icon: Mail },
  { name: "MapPin", icon: MapPin },
  { name: "Home", icon: Home },
  { name: "Settings", icon: Settings },
  { name: "Camera", icon: Camera },
  { name: "Music", icon: Music },
  { name: "Wifi", icon: Wifi },
  { name: "Lock", icon: Lock },
  { name: "Eye", icon: Eye },
  { name: "Check", icon: Check },
  { name: "Plus", icon: Plus },
];

// ─── External icon libraries (FOSS) ───
// Loaded lazily from jsdelivr CDN. No bundle impact.
type LibraryId = "lineicons" | "remix" | "minicons" | "lucide";

interface LibraryConfig {
  id: LibraryId;
  label: string;
  description: string;
  svgPathPrefix: string; // filter files starting with this path
  listEndpoint: string; // jsdelivr listing endpoint
  cdnBase: string; // base URL for raw file access
}

const ICON_LIBRARIES: LibraryConfig[] = [
  {
    id: "lucide",
    label: "Lucide (local)",
    description: "Icônes incluses dans l'app — instantanées",
    svgPathPrefix: "",
    listEndpoint: "",
    cdnBase: "",
  },
  {
    id: "lineicons",
    label: "Lineicons",
    description: "600+ icônes line-style Lineicons (MIT)",
    svgPathPrefix: "/assets/svgs/regular/",
    listEndpoint:
      "https://data.jsdelivr.com/v1/package/gh/LineiconsHQ/Lineicons@main/flat",
    cdnBase: "https://cdn.jsdelivr.net/gh/LineiconsHQ/Lineicons@main",
  },
  {
    id: "remix",
    label: "Remix Icon",
    description: "3200+ icônes Remix Icon (Apache 2.0)",
    svgPathPrefix: "/icons/",
    listEndpoint:
      "https://data.jsdelivr.com/v1/package/npm/remixicon@4.9.1/flat",
    cdnBase: "https://cdn.jsdelivr.net/npm/remixicon@4.9.1",
  },
  {
    id: "minicons",
    label: "Minicons (dev brands)",
    description: "546 logos de technologies (Paulo Archanjo)",
    svgPathPrefix: "/",
    listEndpoint:
      "https://data.jsdelivr.com/v1/package/gh/pauloarchanjo/minicons@main/flat",
    cdnBase: "https://cdn.jsdelivr.net/gh/pauloarchanjo/minicons@main",
  },
];

interface IconFile {
  name: string;
  path: string;
  url: string;
}

async function fetchLibraryIndex(lib: LibraryConfig): Promise<IconFile[]> {
  if (!lib.listEndpoint) return [];
  const r = await fetch(lib.listEndpoint);
  if (!r.ok) throw new Error(`Index fetch failed: ${r.status}`);
  const d = (await r.json()) as { files: { name: string }[] };
  return (d.files ?? [])
    .filter((f) => {
      if (!f.name.endsWith(".svg")) return false;
      if (!lib.svgPathPrefix || lib.svgPathPrefix === "/") return true;
      return f.name.startsWith(lib.svgPathPrefix);
    })
    .map((f) => {
      const base = f.name.split("/").pop()!.replace(/\.svg$/, "");
      return {
        name: base.replace(/^ln-/, "").replace(/[-_]/g, " "),
        path: f.name,
        url: `${lib.cdnBase}${f.name}`,
      };
    });
}

export default function DesignShapesLibrary({
  fabricCanvasRef,
}: DesignShapesLibraryProps) {
  const { addObject, pushUndo } = useDesignStore();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"shapes" | "icons">("shapes");
  const [library, setLibrary] = useState<LibraryId>("lucide");
  const [libIcons, setLibIcons] = useState<IconFile[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [libError, setLibError] = useState<string | null>(null);
  const [insertLoading, setInsertLoading] = useState<string | null>(null);

  // Load library index when switching to non-local libraries
  useEffect(() => {
    if (library === "lucide") {
      setLibIcons([]);
      return;
    }
    const lib = ICON_LIBRARIES.find((l) => l.id === library)!;
    let cancelled = false;
    setLibLoading(true);
    setLibError(null);
    fetchLibraryIndex(lib)
      .then((icons) => {
        if (!cancelled) setLibIcons(icons);
      })
      .catch((e) => {
        if (!cancelled) setLibError(e.message || "Erreur");
      })
      .finally(() => {
        if (!cancelled) setLibLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [library]);

  const handleAddShape = async (shapeDef: ShapeDef) => {
    const fabricModule = await import("fabric");
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    pushUndo();
    const shape = shapeDef.createFn(fabricModule);
    shape.id = crypto.randomUUID();
    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.requestRenderAll();

    const newObj: DesignObject = {
      id: shape.id,
      type: "shape",
      name: shapeDef.name,
      fabricData: shape.toObject(["id"]),
      locked: false,
      visible: true,
    };
    addObject(newObj);
  };

  /** Insert an SVG string as a grouped, editable vector into the canvas. */
  const insertSvgAsVector = async (svgString: string, name: string) => {
    const fabricModule = await import("fabric");
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    pushUndo();
    const loaded = await fabricModule.loadSVGFromString(svgString);
    const elements = loaded.objects.filter(
      (o): o is fabric.Object => o !== null,
    );
    const group =
      elements.length === 1
        ? elements[0]
        : fabricModule.util.groupSVGElements(elements, loaded.options);

    // Size & center
    const maxSize = 120;
    const curW = group.width ?? 24;
    const curH = group.height ?? 24;
    const scale = Math.min(maxSize / curW, maxSize / curH);
    group.set({
      left: 120,
      top: 120,
      scaleX: scale,
      scaleY: scale,
    });
    (group as FabricObjectWithId).id = crypto.randomUUID();
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();

    const newObj: DesignObject = {
      id: (group as FabricObjectWithId).id!,
      type: "shape",
      name: `Icon: ${name}`,
      fabricData: group.toObject(["id"]),
      locked: false,
      visible: true,
    };
    addObject(newObj);
  };

  /** Convert a Lucide React icon to SVG string by rendering + serializing. */
  const handleAddLucideIcon = async (
    iconName: string,
    IconComponent: LucideIcon,
  ) => {
    setInsertLoading(iconName);
    try {
      // Render Lucide icon to offscreen SVG via react-dom/server
      const { renderToStaticMarkup } = await import("react-dom/server");
      const React = await import("react");
      const svgString = renderToStaticMarkup(
        React.createElement(IconComponent, {
          size: 48,
          stroke: "currentColor",
          strokeWidth: 2,
          color: "#4f46e5",
        }),
      );
      await insertSvgAsVector(svgString, iconName);
    } finally {
      setInsertLoading(null);
    }
  };

  /** Fetch remote SVG from CDN and insert it. */
  const handleAddRemoteIcon = async (icon: IconFile) => {
    setInsertLoading(icon.url);
    try {
      const r = await fetch(icon.url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const svg = await r.text();
      await insertSvgAsVector(svg, icon.name);
    } catch (e) {
      console.error("Icon fetch failed:", e);
    } finally {
      setInsertLoading(null);
    }
  };

  const categories = [...new Set(SHAPES.map((s) => s.category))];
  const filteredShapes = search
    ? SHAPES.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : SHAPES;
  const filteredLucide = useMemo(
    () =>
      search
        ? ICON_LIST.filter((i) =>
            i.name.toLowerCase().includes(search.toLowerCase()),
          )
        : ICON_LIST,
    [search],
  );
  const filteredRemote = useMemo(
    () =>
      search
        ? libIcons.filter((i) =>
            i.name.toLowerCase().includes(search.toLowerCase()),
          )
        : libIcons,
    [search, libIcons],
  );
  // Limit remote list display to avoid rendering 5000 DOM nodes
  const MAX_DISPLAYED = 300;
  const displayedRemote = filteredRemote.slice(0, MAX_DISPLAYED);
  const activeLib = ICON_LIBRARIES.find((l) => l.id === library)!;

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher..."
          className="h-8 text-xs pl-8"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        <button
          onClick={() => setTab("shapes")}
          className={cn(
            "flex-1 text-xs font-medium py-1.5 rounded-md transition-all",
            tab === "shapes"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          Shapes
        </button>
        <button
          onClick={() => setTab("icons")}
          className={cn(
            "flex-1 text-xs font-medium py-1.5 rounded-md transition-all",
            tab === "icons"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          Icons
        </button>
      </div>

      {tab === "shapes" ? (
        <div className="space-y-3">
          {categories.map((cat) => {
            const shapes = filteredShapes.filter((s) => s.category === cat);
            if (shapes.length === 0) return null;
            return (
              <div key={cat} className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {cat}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {shapes.map((shapeDef) => {
                    const Icon = shapeDef.icon;
                    return (
                      <button
                        key={shapeDef.id}
                        onClick={() => handleAddShape(shapeDef)}
                        className="flex flex-col items-center gap-1 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 p-2.5 transition-all"
                        title={shapeDef.name}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-[10px] truncate w-full text-center">
                          {shapeDef.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Library selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">
              Bibliothèque
            </label>
            <Select
              value={library}
              onValueChange={(v) => setLibrary(v as LibraryId)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ICON_LIBRARIES.map((lib) => (
                  <SelectItem key={lib.id} value={lib.id} className="text-xs">
                    {lib.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {activeLib.description}
            </p>
          </div>

          {library === "lucide" ? (
            <div className="grid grid-cols-4 gap-1.5">
              {filteredLucide.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  onClick={() => handleAddLucideIcon(name, Icon)}
                  disabled={insertLoading === name}
                  className="flex flex-col items-center gap-1 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 p-2 transition-all"
                  title={name}
                >
                  {insertLoading === name ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span className="text-[9px] truncate w-full text-center">
                    {name}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              {libLoading && (
                <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement de {activeLib.label}...
                </div>
              )}
              {libError && (
                <p className="text-[10px] text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-2 py-1.5">
                  {libError}
                </p>
              )}
              {!libLoading && !libError && (
                <>
                  <p className="text-[10px] text-muted-foreground">
                    {filteredRemote.length} icônes
                    {filteredRemote.length > MAX_DISPLAYED && (
                      <span>
                        {" "}
                        — {MAX_DISPLAYED} affichées (précise ta recherche)
                      </span>
                    )}
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {displayedRemote.map((icon) => (
                      <button
                        key={icon.path}
                        onClick={() => handleAddRemoteIcon(icon)}
                        disabled={insertLoading === icon.url}
                        className="relative flex flex-col items-center gap-1 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 p-2 transition-all aspect-square"
                        title={icon.name}
                      >
                        {insertLoading === icon.url ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <object
                            data={icon.url}
                            type="image/svg+xml"
                            className="h-5 w-5 pointer-events-none"
                            aria-label={icon.name}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={icon.url}
                              alt={icon.name}
                              className="h-5 w-5"
                              loading="lazy"
                            />
                          </object>
                        )}
                        <span className="text-[8px] truncate w-full text-center leading-none">
                          {icon.name.slice(0, 12)}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function starPoints(points: number, outerR: number, innerR: number) {
  const result = [];
  const step = Math.PI / points;
  for (let i = 0; i < 2 * points; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step - Math.PI / 2;
    result.push({
      x: outerR + r * Math.cos(angle),
      y: outerR + r * Math.sin(angle),
    });
  }
  return result;
}

function regularPolygonPoints(sides: number, radius: number) {
  const result = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    result.push({
      x: radius + radius * Math.cos(angle),
      y: radius + radius * Math.sin(angle),
    });
  }
  return result;
}
