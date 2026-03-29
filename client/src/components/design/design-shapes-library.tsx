"use client";

import { useState } from "react";
import { useDesignStore } from "@/stores/design-store";
import { Input } from "@/components/ui/input";
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
  type LucideIcon,
} from "lucide-react";
import type { DesignObject } from "./types";
import { cn } from "@/lib/utils";

interface DesignShapesLibraryProps {
  fabricCanvasRef: React.MutableRefObject<any | null>;
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
    id: "rect", name: "Rectangle", icon: Square, category: "Basic",
    createFn: (fm) => new fm.Rect({ left: 100, top: 100, width: 200, height: 150, fill: "#4f46e5", rx: 8, ry: 8 }),
  },
  {
    id: "circle", name: "Circle", icon: Circle, category: "Basic",
    createFn: (fm) => new fm.Circle({ left: 100, top: 100, radius: 80, fill: "#059669" }),
  },
  {
    id: "triangle", name: "Triangle", icon: Triangle, category: "Basic",
    createFn: (fm) => new fm.Triangle({ left: 100, top: 100, width: 160, height: 140, fill: "#d97706" }),
  },
  {
    id: "star", name: "Star", icon: Star, category: "Basic",
    createFn: (fm) => {
      const pts = starPoints(5, 80, 40);
      return new fm.Polygon(pts, { left: 100, top: 100, fill: "#e11d48" });
    },
  },
  {
    id: "diamond", name: "Diamond", icon: Diamond, category: "Basic",
    createFn: (fm) => {
      const pts = [{ x: 80, y: 0 }, { x: 160, y: 100 }, { x: 80, y: 200 }, { x: 0, y: 100 }];
      return new fm.Polygon(pts, { left: 100, top: 100, fill: "#7c3aed" });
    },
  },
  {
    id: "hexagon", name: "Hexagon", icon: Hexagon, category: "Basic",
    createFn: (fm) => {
      const pts = regularPolygonPoints(6, 80);
      return new fm.Polygon(pts, { left: 100, top: 100, fill: "#0891b2" });
    },
  },
  // Lines
  {
    id: "line", name: "Line", icon: Minus, category: "Lines",
    createFn: (fm) => new fm.Line([100, 100, 400, 100], { stroke: "#000000", strokeWidth: 3 }),
  },
  {
    id: "arrow-line", name: "Arrow", icon: MoveRight, category: "Lines",
    createFn: (fm) => new fm.Line([100, 100, 400, 100], { stroke: "#000000", strokeWidth: 3 }),
  },
  // Arrows
  {
    id: "arrow-right", name: "Arrow Right", icon: ArrowRight, category: "Arrows",
    createFn: (fm) => {
      const pts = [{ x: 0, y: 30 }, { x: 100, y: 30 }, { x: 100, y: 0 }, { x: 150, y: 50 }, { x: 100, y: 100 }, { x: 100, y: 70 }, { x: 0, y: 70 }];
      return new fm.Polygon(pts, { left: 100, top: 100, fill: "#4f46e5" });
    },
  },
  {
    id: "arrow-left", name: "Arrow Left", icon: ArrowLeft, category: "Arrows",
    createFn: (fm) => {
      const pts = [{ x: 150, y: 30 }, { x: 50, y: 30 }, { x: 50, y: 0 }, { x: 0, y: 50 }, { x: 50, y: 100 }, { x: 50, y: 70 }, { x: 150, y: 70 }];
      return new fm.Polygon(pts, { left: 100, top: 100, fill: "#059669" });
    },
  },
  {
    id: "arrow-up", name: "Arrow Up", icon: ArrowUp, category: "Arrows",
    createFn: (fm) => {
      const pts = [{ x: 30, y: 150 }, { x: 30, y: 50 }, { x: 0, y: 50 }, { x: 50, y: 0 }, { x: 100, y: 50 }, { x: 70, y: 50 }, { x: 70, y: 150 }];
      return new fm.Polygon(pts, { left: 100, top: 100, fill: "#d97706" });
    },
  },
  {
    id: "arrow-down", name: "Arrow Down", icon: ArrowDown, category: "Arrows",
    createFn: (fm) => {
      const pts = [{ x: 30, y: 0 }, { x: 30, y: 100 }, { x: 0, y: 100 }, { x: 50, y: 150 }, { x: 100, y: 100 }, { x: 70, y: 100 }, { x: 70, y: 0 }];
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

export default function DesignShapesLibrary({ fabricCanvasRef }: DesignShapesLibraryProps) {
  const { addObject, pushUndo } = useDesignStore();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"shapes" | "icons">("shapes");

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

  const handleAddIcon = async (iconName: string, IconComponent: LucideIcon) => {
    const fabricModule = await import("fabric");
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    pushUndo();
    // Create icon as a text object with the icon name (since we can't easily render Lucide SVG directly)
    // Instead, create a circle with the icon name as a simple representation
    const group = new fabricModule.Circle({
      left: 100,
      top: 100,
      radius: 30,
      fill: "#4f46e5",
      stroke: "",
      strokeWidth: 0,
    });
    (group as any).id = crypto.randomUUID();
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();

    const newObj: DesignObject = {
      id: (group as any).id,
      type: "shape",
      name: `Icon: ${iconName}`,
      fabricData: group.toObject(["id"]),
      locked: false,
      visible: true,
    };
    addObject(newObj);
  };

  const categories = [...new Set(SHAPES.map((s) => s.category))];
  const filteredShapes = search
    ? SHAPES.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : SHAPES;
  const filteredIcons = search
    ? ICON_LIST.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : ICON_LIST;

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
            tab === "shapes" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          Shapes
        </button>
        <button
          onClick={() => setTab("icons")}
          className={cn(
            "flex-1 text-xs font-medium py-1.5 rounded-md transition-all",
            tab === "icons" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
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
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{cat}</p>
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
                        <span className="text-[10px] truncate w-full text-center">{shapeDef.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {filteredIcons.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => handleAddIcon(name, Icon)}
              className="flex flex-col items-center gap-1 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 p-2 transition-all"
              title={name}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[9px] truncate w-full text-center">{name}</span>
            </button>
          ))}
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
    result.push({ x: outerR + r * Math.cos(angle), y: outerR + r * Math.sin(angle) });
  }
  return result;
}

function regularPolygonPoints(sides: number, radius: number) {
  const result = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    result.push({ x: radius + radius * Math.cos(angle), y: radius + radius * Math.sin(angle) });
  }
  return result;
}
