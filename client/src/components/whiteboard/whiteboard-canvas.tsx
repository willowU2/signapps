"use client";

import React, { useRef, useState, useCallback } from "react";
import { Trash2, Download } from "lucide-react";

type DrawingTool = "pen" | "line" | "rectangle" | "circle" | "text" | "eraser";

const COLORS = ["#FFFFFF", "#000000", "#FF0000", "#00AA00", "#3B82F6", "#F59E0B", "#A855F7"];
const STROKE_WIDTHS = [2, 4, 8, 12, 16];

interface WhiteboardCanvasProps {
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({ svgRef: externalRef }) => {
  const internalRef = useRef<SVGSVGElement>(null);
  const canvasRef = (externalRef as React.RefObject<SVGSVGElement>) || internalRef;
  const [tool, setTool] = useState<DrawingTool>("pen");
  const [color, setColor] = useState<string>(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState<number>(STROKE_WIDTHS[1]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const currentPathRef = useRef<SVGPathElement | null>(null);
  const pathDataRef = useRef<string>("");

  const getMousePos = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return {
      x: e.clientX - (rect?.left || 0),
      y: e.clientY - (rect?.top || 0),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createShape = (startPos: { x: number; y: number }, endPos: { x: number; y: number }, isTemp: boolean) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "g");
    if (isTemp) svg.setAttribute("data-temp", "true");

    const attrs = {
      stroke: tool === "eraser" ? "#0f172a" : color, // Use background color approximation for eraser
      "stroke-width": strokeWidth.toString(),
      fill: "none",
    };

    switch (tool) {
      case "line": {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
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
      case "rectangle": {
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        const x = Math.min(startPos.x, endPos.x);
        const y = Math.min(startPos.y, endPos.y);
        Object.entries({
          x,
          y,
          width: Math.abs(endPos.x - startPos.x),
          height: Math.abs(endPos.y - startPos.y),
          ...attrs,
        }).forEach(([k, v]) => rect.setAttribute(k, v.toString()));
        svg.appendChild(rect);
        break;
      }
      case "circle": {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        const r = Math.sqrt(Math.pow(endPos.x - startPos.x, 2) + Math.pow(endPos.y - startPos.y, 2));
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
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", startPos.x.toString());
        text.setAttribute("y", startPos.y.toString());
        text.setAttribute("font-size", (strokeWidth * 4).toString());
        text.setAttribute("fill", color);
        text.setAttribute("font-family", "Arial");
        text.textContent = "Texte";
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
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("data-temp", "true");
      // Dark mode eraser matches dark background approx (#09090b or transparent logic)
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

  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
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

  const handleExport = () => {
    const svg = canvasRef.current;
    if (!svg) return;
    const svgClone = svg.cloneNode(true) as SVGSVGElement;
    svgClone.querySelectorAll("[data-temp]").forEach((el) => el.remove());
    const blob = new Blob([new XMLSerializer().serializeToString(svgClone)], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `whiteboard-${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-muted rounded-lg shadow-sm">
      <div className="flex flex-wrap gap-2 items-center bg-card p-3 rounded-md border border-border">
        <div className="flex gap-1 border-r border-border pr-2">
          {(["pen", "line", "rectangle", "circle", "text", "eraser"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                tool === t ? "bg-blue-500 text-white" : "bg-muted hover:bg-gray-200"
              }`}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex gap-1 border-r border-border pr-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded border-2 ${color === c ? "border-gray-800" : "border-border"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <select
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="px-2 py-1 text-sm border border-border rounded"
        >
          {STROKE_WIDTHS.map((w) => (
            <option key={w} value={w}>{w}px</option>
          ))}
        </select>

        <button
          onClick={handleClear}
          className="flex items-center gap-1 px-3 py-1 text-sm font-medium bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          <Trash2 size={16} />
          Clear
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-1 px-3 py-1 text-sm font-medium bg-green-100 text-green-700 rounded hover:bg-green-200"
        >
          <Download size={16} />
          Export
        </button>
      </div>

      <svg
        ref={canvasRef}
        width="800"
        height="600"
        className="border-2 border-border bg-card rounded-md cursor-crosshair shadow-md"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
};

export default WhiteboardCanvas;
