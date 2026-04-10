"use client";

import React, { useRef, useState, useCallback } from "react";
import {
  Trash2,
  Download,
  Pencil,
  Minus,
  Square,
  CircleIcon,
  Type,
  Eraser,
  Image,
  MoveRight,
  StickyNote,
  ZoomIn,
  ZoomOut,
  Maximize,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

type DrawingTool =
  | "pen"
  | "line"
  | "rectangle"
  | "circle"
  | "text"
  | "eraser"
  | "arrow"
  | "sticky";

const COLORS = [
  "#FFFFFF",
  "#000000",
  "#FF0000",
  "#00AA00",
  "#3B82F6",
  "#F59E0B",
  "#A855F7",
  "#EC4899",
  "#14B8A6",
  "#F97316",
];
const STROKE_WIDTHS = [2, 4, 8, 12, 16];

const TOOL_CONFIG: {
  id: DrawingTool;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "pen", label: "Crayon", Icon: Pencil },
  { id: "line", label: "Ligne", Icon: Minus },
  { id: "arrow", label: "Fleche", Icon: MoveRight },
  { id: "rectangle", label: "Rectangle", Icon: Square },
  { id: "circle", label: "Cercle", Icon: CircleIcon },
  { id: "text", label: "Texte", Icon: Type },
  { id: "sticky", label: "Post-it", Icon: StickyNote },
  { id: "eraser", label: "Gomme", Icon: Eraser },
];

interface WhiteboardCanvasProps {
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  svgRef: externalRef,
}) => {
  const internalRef = useRef<SVGSVGElement>(null);
  const canvasRef =
    (externalRef as React.RefObject<SVGSVGElement>) || internalRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<DrawingTool>("pen");
  const [color, setColor] = useState<string>(COLORS[1]);
  const [strokeWidth, setStrokeWidth] = useState<number>(STROKE_WIDTHS[1]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const currentPathRef = useRef<SVGPathElement | null>(null);
  const pathDataRef = useRef<string>("");

  const getMousePos = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      return {
        x: (e.clientX - (rect?.left || 0)) / zoom,
        y: (e.clientY - (rect?.top || 0)) / zoom,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoom],
  );

  const createShape = (
    startPos: { x: number; y: number },
    endPos: { x: number; y: number },
    isTemp: boolean,
  ) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "g");
    if (isTemp) svg.setAttribute("data-temp", "true");

    const attrs = {
      stroke: tool === "eraser" ? "#0f172a" : color,
      "stroke-width": strokeWidth.toString(),
      fill: "none",
    };

    switch (tool) {
      case "line": {
        const line = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line",
        );
        Object.entries({
          x1: startPos.x,
          y1: startPos.y,
          x2: endPos.x,
          y2: endPos.y,
          ...attrs,
          "stroke-linecap": "round",
        }).forEach(([k, v]) => line.setAttribute(k, v.toString()));
        svg.appendChild(line);
        break;
      }
      case "arrow": {
        const markerId = `arrowhead-${Date.now()}`;
        const defs = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "defs",
        );
        const marker = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "marker",
        );
        marker.setAttribute("id", markerId);
        marker.setAttribute("markerWidth", "10");
        marker.setAttribute("markerHeight", "7");
        marker.setAttribute("refX", "10");
        marker.setAttribute("refY", "3.5");
        marker.setAttribute("orient", "auto");
        const polygon = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "polygon",
        );
        polygon.setAttribute("points", "0 0, 10 3.5, 0 7");
        polygon.setAttribute("fill", color);
        marker.appendChild(polygon);
        defs.appendChild(marker);
        svg.appendChild(defs);
        const line = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line",
        );
        Object.entries({
          x1: startPos.x,
          y1: startPos.y,
          x2: endPos.x,
          y2: endPos.y,
          ...attrs,
          "stroke-linecap": "round",
          "marker-end": `url(#${markerId})`,
        }).forEach(([k, v]) => line.setAttribute(k, v.toString()));
        svg.appendChild(line);
        break;
      }
      case "rectangle": {
        const rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        const x = Math.min(startPos.x, endPos.x);
        const y = Math.min(startPos.y, endPos.y);
        Object.entries({
          x,
          y,
          width: Math.abs(endPos.x - startPos.x),
          height: Math.abs(endPos.y - startPos.y),
          rx: 4,
          ...attrs,
        }).forEach(([k, v]) => rect.setAttribute(k, v.toString()));
        svg.appendChild(rect);
        break;
      }
      case "circle": {
        const circle = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle",
        );
        const r = Math.sqrt(
          Math.pow(endPos.x - startPos.x, 2) +
            Math.pow(endPos.y - startPos.y, 2),
        );
        Object.entries({
          cx: startPos.x,
          cy: startPos.y,
          r,
          ...attrs,
        }).forEach(([k, v]) => circle.setAttribute(k, v.toString()));
        svg.appendChild(circle);
        break;
      }
      case "text": {
        const text = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );
        text.setAttribute("x", startPos.x.toString());
        text.setAttribute("y", startPos.y.toString());
        text.setAttribute("font-size", (strokeWidth * 4).toString());
        text.setAttribute("fill", color);
        text.setAttribute("font-family", "Arial, sans-serif");
        text.textContent = "Texte";
        svg.appendChild(text);
        break;
      }
      case "sticky": {
        const rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        const w = Math.max(Math.abs(endPos.x - startPos.x), 120);
        const h = Math.max(Math.abs(endPos.y - startPos.y), 100);
        rect.setAttribute("x", Math.min(startPos.x, endPos.x).toString());
        rect.setAttribute("y", Math.min(startPos.y, endPos.y).toString());
        rect.setAttribute("width", w.toString());
        rect.setAttribute("height", h.toString());
        rect.setAttribute("rx", "4");
        rect.setAttribute("fill", "#fef08a");
        rect.setAttribute("stroke", "#eab308");
        rect.setAttribute("stroke-width", "1.5");
        svg.appendChild(rect);
        const text = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );
        text.setAttribute(
          "x",
          (Math.min(startPos.x, endPos.x) + 10).toString(),
        );
        text.setAttribute(
          "y",
          (Math.min(startPos.y, endPos.y) + 22).toString(),
        );
        text.setAttribute("font-size", "12");
        text.setAttribute("fill", "#713f12");
        text.setAttribute("font-family", "Arial, sans-serif");
        text.textContent = "Note";
        svg.appendChild(text);
        break;
      }
    }
    return svg;
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const pos = getMousePos(e);
    setStartPos(pos);
    setIsDrawing(true);

    if (tool === "pen" || tool === "eraser") {
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute("data-temp", "true");
      path.setAttribute("stroke", tool === "eraser" ? "#09090b" : color);
      path.setAttribute("stroke-width", strokeWidth.toString());
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");

      pathDataRef.current = `M ${pos.x} ${pos.y}`;
      path.setAttribute("d", pathDataRef.current);

      canvasRef.current?.appendChild(path);
      currentPathRef.current = path;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const pos = getMousePos(e);

    if (tool === "pen" || tool === "eraser") {
      if (currentPathRef.current) {
        pathDataRef.current += ` L ${pos.x} ${pos.y}`;
        currentPathRef.current.setAttribute("d", pathDataRef.current);
      }
    } else {
      const temp = canvasRef.current.querySelector('[data-temp="true"]');
      if (temp) temp.remove();
      const shape = createShape(startPos, pos, true);
      canvasRef.current.appendChild(shape);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !canvasRef.current) return;
    setIsDrawing(false);

    if (tool === "pen" || tool === "eraser") {
      if (currentPathRef.current) {
        currentPathRef.current.removeAttribute("data-temp");
        currentPathRef.current.setAttribute("data-id", Date.now().toString());
        currentPathRef.current = null;
      }
    } else {
      const temp = canvasRef.current.querySelector('[data-temp="true"]');
      if (temp) {
        temp.removeAttribute("data-temp");
        temp.setAttribute("data-id", Date.now().toString());
      }
    }
  };

  const handleClear = () => {
    const svg = canvasRef.current;
    if (svg) svg.querySelectorAll("[data-id]").forEach((el) => el.remove());
  };

  const handleExportSvg = () => {
    const svg = canvasRef.current;
    if (!svg) return;
    const svgClone = svg.cloneNode(true) as SVGSVGElement;
    svgClone.querySelectorAll("[data-temp]").forEach((el) => el.remove());
    const blob = new Blob([new XMLSerializer().serializeToString(svgClone)], {
      type: "image/svg+xml",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `whiteboard-${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleExportPng = () => {
    const svg = canvasRef.current;
    if (!svg) return;
    const svgClone = svg.cloneNode(true) as SVGSVGElement;
    svgClone.querySelectorAll("[data-temp]").forEach((el) => el.remove());
    // Set explicit background for PNG
    const bgRect = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    bgRect.setAttribute("width", "100%");
    bgRect.setAttribute("height", "100%");
    bgRect.setAttribute("fill", "#ffffff");
    svgClone.insertBefore(bgRect, svgClone.firstChild);

    const svgData = new XMLSerializer().serializeToString(svgClone);
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new window.Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 1600, 1200);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `whiteboard-${Date.now()}.png`;
        link.click();
        URL.revokeObjectURL(link.href);
        toast.success("Exporte en PNG");
      }, "image/png");
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));
  const handleZoomFit = () => setZoom(1);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 items-center bg-card p-2 border-b border-border shrink-0">
          {/* Drawing tools */}
          <div className="flex gap-0.5 border-r border-border pr-2">
            {TOOL_CONFIG.map((t) => (
              <Tooltip key={t.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setTool(t.id)}
                    className={`p-2 rounded transition-colors ${
                      tool === t.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <t.Icon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Color picker */}
          <div className="flex gap-0.5 border-r border-border pr-2">
            {COLORS.map((c) => (
              <Tooltip key={c}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      color === c
                        ? "border-primary scale-110 ring-2 ring-primary/30"
                        : "border-border"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{c}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Stroke width */}
          <div className="flex items-center gap-1 border-r border-border pr-2">
            {STROKE_WIDTHS.map((w) => (
              <Tooltip key={w}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setStrokeWidth(w)}
                    className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                      strokeWidth === w
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div
                      className="rounded-full bg-current"
                      style={{ width: w, height: w }}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{w}px</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border-r border-border pr-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleZoomOut}
                  className="p-2 rounded hover:bg-muted transition-colors"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Zoom -</p>
              </TooltipContent>
            </Tooltip>
            <span className="text-xs font-mono min-w-[3rem] text-center text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleZoomIn}
                  className="p-2 rounded hover:bg-muted transition-colors"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Zoom +</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleZoomFit}
                  className="p-2 rounded hover:bg-muted transition-colors"
                >
                  <Maximize className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Ajuster</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleClear}
                  className="p-2 rounded hover:bg-destructive/10 text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Effacer tout</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleExportSvg}
                  className="p-2 rounded hover:bg-muted transition-colors"
                >
                  <Download className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Exporter SVG</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleExportPng}
                  className="p-2 rounded hover:bg-muted transition-colors"
                >
                  <Image className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Exporter PNG</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Canvas area with zoom */}
        <div ref={containerRef} className="flex-1 overflow-auto bg-muted/30">
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              width: 800 / zoom,
              height: 600 / zoom,
              minWidth: 800,
              minHeight: 600,
            }}
          >
            <svg
              ref={canvasRef}
              width="800"
              height="600"
              className="bg-card cursor-crosshair shadow-md"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default WhiteboardCanvas;
