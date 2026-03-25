"use client";

import { useState } from "react";
import { useDesignStore } from "@/stores/design-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Undo2,
  Redo2,
  Type,
  Square,
  Circle,
  Triangle,
  Star,
  Minus,
  ImagePlus,
  Download,
  Share2,
  Grid3X3,
  Magnet,
  ChevronDown,
  Hexagon,
  Diamond,
  ArrowRight,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  Paintbrush,
  Palette,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { DesignObject } from "./types";
import { TEXT_STYLES } from "./types";

interface DesignToolbarProps {
  fabricCanvasRef: React.MutableRefObject<any | null>;
  onOpenExport: () => void;
  onOpenResize: () => void;
}

export default function DesignToolbar({ fabricCanvasRef, onOpenExport, onOpenResize }: DesignToolbarProps) {
  const {
    undoStack,
    redoStack,
    undo,
    redo,
    showGrid,
    snapToGrid,
    setShowGrid,
    setSnapToGrid,
    addObject,
    pushUndo,
    currentDesign,
    currentPageIndex,
    updatePageBackground,
  } = useDesignStore();

  const [bgColor, setBgColor] = useState("#ffffff");

  const createFabricText = async (style: typeof TEXT_STYLES[0]) => {
    const fabricModule = await import("fabric");
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    pushUndo();
    const textbox = new fabricModule.Textbox("Your text here", {
      left: 100,
      top: 100,
      width: 400,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fontFamily: style.fontFamily,
      fill: "#000000",
      editable: true,
    } as any);
    (textbox as any).id = crypto.randomUUID();
    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    canvas.requestRenderAll();

    const newObj: DesignObject = {
      id: (textbox as any).id,
      type: "text",
      name: style.name,
      fabricData: textbox.toObject(["id"]),
      locked: false,
      visible: true,
    };
    addObject(newObj);
  };

  const createFabricShape = async (shapeType: string) => {
    const fabricModule = await import("fabric");
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    pushUndo();
    let shape: any;

    switch (shapeType) {
      case "rect":
        shape = new fabricModule.Rect({
          left: 100, top: 100, width: 200, height: 150,
          fill: "#4f46e5", stroke: "", strokeWidth: 0, rx: 8, ry: 8,
        });
        break;
      case "circle":
        shape = new fabricModule.Circle({
          left: 100, top: 100, radius: 80,
          fill: "#059669", stroke: "", strokeWidth: 0,
        });
        break;
      case "triangle":
        shape = new fabricModule.Triangle({
          left: 100, top: 100, width: 160, height: 140,
          fill: "#d97706", stroke: "", strokeWidth: 0,
        });
        break;
      case "star": {
        const points = createStarPoints(5, 80, 40);
        shape = new fabricModule.Polygon(points, {
          left: 100, top: 100,
          fill: "#e11d48", stroke: "", strokeWidth: 0,
        });
        break;
      }
      case "diamond": {
        const pts = [{ x: 80, y: 0 }, { x: 160, y: 100 }, { x: 80, y: 200 }, { x: 0, y: 100 }];
        shape = new fabricModule.Polygon(pts, {
          left: 100, top: 100,
          fill: "#7c3aed", stroke: "", strokeWidth: 0,
        });
        break;
      }
      case "hexagon": {
        const hexPts = createRegularPolygonPoints(6, 80);
        shape = new fabricModule.Polygon(hexPts, {
          left: 100, top: 100,
          fill: "#0891b2", stroke: "", strokeWidth: 0,
        });
        break;
      }
      case "line":
        shape = new fabricModule.Line([100, 100, 400, 100], {
          stroke: "#000000", strokeWidth: 3,
        });
        break;
      case "arrow-line":
        shape = new fabricModule.Line([100, 100, 400, 100], {
          stroke: "#000000", strokeWidth: 3,
        });
        break;
      default:
        shape = new fabricModule.Rect({
          left: 100, top: 100, width: 200, height: 150,
          fill: "#4f46e5", stroke: "", strokeWidth: 0,
        });
    }

    shape.id = crypto.randomUUID();
    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.requestRenderAll();

    const newObj: DesignObject = {
      id: shape.id,
      type: "shape",
      name: shapeType.charAt(0).toUpperCase() + shapeType.slice(1),
      fabricData: shape.toObject(["id"]),
      locked: false,
      visible: true,
    };
    addObject(newObj);
  };

  const handleImageUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        const fabricModule = await import("fabric");
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        pushUndo();
        fabricModule.FabricImage.fromURL(dataUrl).then((img: any) => {
          // Scale image to fit within canvas
          const maxW = (currentDesign?.format.width || 1080) * 0.8;
          const maxH = (currentDesign?.format.height || 1080) * 0.8;
          const scale = Math.min(maxW / (img.width || 1), maxH / (img.height || 1), 1);
          img.set({ scaleX: scale, scaleY: scale, left: 50, top: 50 });
          img.id = crypto.randomUUID();
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.requestRenderAll();

          const newObj: DesignObject = {
            id: img.id,
            type: "image",
            name: file.name.slice(0, 20),
            fabricData: img.toObject(["id"]),
            locked: false,
            visible: true,
          };
          addObject(newObj);
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleBgColorChange = (color: string) => {
    setBgColor(color);
    updatePageBackground(currentPageIndex, color);
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.backgroundColor = color;
      canvas.requestRenderAll();
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-background/95 backdrop-blur-sm shrink-0">
        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5 border-r pr-2 mr-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={undoStack.length === 0} onClick={undo}>
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={redoStack.length === 0} onClick={redo}>
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>

        {/* Text */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2.5 text-xs">
              <Type className="h-4 w-4" />
              Text
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {TEXT_STYLES.map((style) => (
              <DropdownMenuItem
                key={style.id}
                onClick={() => createFabricText(style)}
                className="gap-2"
              >
                {style.id.startsWith("heading") ? (
                  style.id === "heading-lg" ? <Heading1 className="h-4 w-4" /> :
                  style.id === "heading-md" ? <Heading2 className="h-4 w-4" /> :
                  <Heading3 className="h-4 w-4" />
                ) : (
                  <AlignLeft className="h-4 w-4" />
                )}
                <span style={{ fontSize: Math.min(style.fontSize / 4, 16), fontWeight: style.fontWeight as any }}>
                  {style.name}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Shapes */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2.5 text-xs">
              <Square className="h-4 w-4" />
              Shape
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => createFabricShape("rect")} className="gap-2">
              <Square className="h-4 w-4" /> Rectangle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => createFabricShape("circle")} className="gap-2">
              <Circle className="h-4 w-4" /> Circle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => createFabricShape("triangle")} className="gap-2">
              <Triangle className="h-4 w-4" /> Triangle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => createFabricShape("star")} className="gap-2">
              <Star className="h-4 w-4" /> Star
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => createFabricShape("diamond")} className="gap-2">
              <Diamond className="h-4 w-4" /> Diamond
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => createFabricShape("hexagon")} className="gap-2">
              <Hexagon className="h-4 w-4" /> Hexagon
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => createFabricShape("line")} className="gap-2">
              <Minus className="h-4 w-4" /> Line
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => createFabricShape("arrow-line")} className="gap-2">
              <ArrowRight className="h-4 w-4" /> Arrow
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Image */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2.5 text-xs" onClick={handleImageUpload}>
              <ImagePlus className="h-4 w-4" />
              Image
            </Button>
          </TooltipTrigger>
          <TooltipContent>Upload image</TooltipContent>
        </Tooltip>

        {/* Background */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2.5 text-xs">
              <Paintbrush className="h-4 w-4" />
              Background
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="p-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Canvas Background</p>
              <div className="grid grid-cols-6 gap-1.5">
                {["#ffffff", "#f8f9fa", "#e9ecef", "#dee2e6", "#1a1a2e", "#16213e", "#0f3460", "#533483",
                  "#e94560", "#f8b500", "#3ec70b", "#0dcaf0"].map((c) => (
                  <button
                    key={c}
                    className="w-7 h-7 rounded-md border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: bgColor === c ? "var(--primary)" : "transparent",
                    }}
                    onClick={() => handleBgColorChange(c)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => handleBgColorChange(e.target.value)}
                  className="h-7 w-7 rounded border cursor-pointer"
                />
                <span className="text-xs text-muted-foreground">{bgColor}</span>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        {/* Grid & Snap */}
        <div className="flex items-center gap-0.5 border-r pr-2 mr-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showGrid ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowGrid(!showGrid)}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Grid</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={snapToGrid ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setSnapToGrid(!snapToGrid)}
              >
                <Magnet className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Snap to Grid</TooltipContent>
          </Tooltip>
        </div>

        {/* Resize */}
        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2.5 text-xs" onClick={onOpenResize}>
          <Palette className="h-4 w-4" />
          Resize
        </Button>

        {/* Export */}
        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2.5 text-xs" onClick={onOpenExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>

        {/* Share */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Share2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Share</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

function createStarPoints(points: number, outerR: number, innerR: number) {
  const result = [];
  const step = Math.PI / points;
  for (let i = 0; i < 2 * points; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step - Math.PI / 2;
    result.push({ x: outerR + r * Math.cos(angle), y: outerR + r * Math.sin(angle) });
  }
  return result;
}

function createRegularPolygonPoints(sides: number, radius: number) {
  const result = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    result.push({ x: radius + radius * Math.cos(angle), y: radius + radius * Math.sin(angle) });
  }
  return result;
}
