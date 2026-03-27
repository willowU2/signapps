"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type * as fabric from "fabric";
import { useDesignStore } from "@/stores/design-store";
import type { DesignObject } from "./types";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";

const GRID_SIZE = 20;

interface FabricCanvasObject extends fabric.Object {
  id?: string;
}

interface DesignCanvasProps {
  fabricCanvasRef: React.MutableRefObject<fabric.Canvas | null>;
}

export default function DesignCanvas({ fabricCanvasRef }: DesignCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef({ x: 0, y: 0 });
  const spaceDownRef = useRef(false);

  const {
    currentDesign,
    currentPageIndex,
    zoom,
    showGrid,
    snapToGrid,
    selectedObjectIds,
    setZoom,
    setSelectedObjects,
    updateObject,
    removeObject,
    pushUndo,
    addObject,
    saveDesign,
  } = useDesignStore();

  const page = currentDesign?.pages[currentPageIndex];
  const canvasW = currentDesign?.format.width || 1080;
  const canvasH = currentDesign?.format.height || 1080;

  // Scale to fit container
  const [displayScale, setDisplayScale] = useState(1);

  const recalcScale = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 80;
    const scaleX = (rect.width - padding) / canvasW;
    const scaleY = (rect.height - padding) / canvasH;
    const base = Math.min(scaleX, scaleY, 1);
    setDisplayScale(base);
  }, [canvasW, canvasH]);

  useEffect(() => {
    recalcScale();
    window.addEventListener("resize", recalcScale);
    return () => window.removeEventListener("resize", recalcScale);
  }, [recalcScale]);

  // Initialize fabric canvas
  useEffect(() => {
    let canvas: fabric.Canvas | null = null;

    import("fabric").then((fabricModule) => {
      if (!canvasElRef.current) return;
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
      }

      canvas = new fabricModule.Canvas(canvasElRef.current, {
        width: canvasW,
        height: canvasH,
        backgroundColor: page?.background || "#ffffff",
        preserveObjectStacking: true,
        selection: true,
      });
      fabricCanvasRef.current = canvas;

      // Selection handling
      canvas.on("selection:created", (e: { selected?: FabricCanvasObject[] }) => {
        const ids = (e.selected || []).map((o) => o.id).filter((id): id is string => Boolean(id));
        setSelectedObjects(ids);
      });
      canvas.on("selection:updated", (e: { selected?: FabricCanvasObject[] }) => {
        const ids = (e.selected || []).map((o) => o.id).filter((id): id is string => Boolean(id));
        setSelectedObjects(ids);
      });
      canvas.on("selection:cleared", () => {
        setSelectedObjects([]);
      });

      // Object modified
      canvas.on("object:modified", (e: { target?: FabricCanvasObject }) => {
        const target = e.target;
        if (target?.id) {
          const data = target.toObject(["id"]);
          updateObject(target.id, { fabricData: data });
        }
        saveDesign();
      });

      // Grid rendering
      canvas.on("after:render", (opt: { ctx?: CanvasRenderingContext2D }) => {
        if (!showGrid) return;
        const ctx = opt.ctx;
        if (!ctx) return;
        ctx.save();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
        ctx.lineWidth = 0.5;
        for (let x = 0; x < canvasW; x += GRID_SIZE) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvasH);
          ctx.stroke();
        }
        for (let y = 0; y < canvasH; y += GRID_SIZE) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvasW, y);
          ctx.stroke();
        }
        ctx.restore();
      });

      // Snap to grid
      canvas.on("object:moving", (opt: { target?: fabric.Object }) => {
        if (!snapToGrid) return;
        const target = opt.target;
        if (!target) return;
        const snap = (v: number) => Math.round(v / GRID_SIZE) * GRID_SIZE;
        if (target.left !== undefined) target.set("left", snap(target.left));
        if (target.top !== undefined) target.set("top", snap(target.top));
      });

      // Load objects from current page
      if (page?.objects && canvas) {
        page.objects.forEach((obj) => {
          if (!obj.visible) return;
          addFabricObject(fabricModule, canvas!, obj);
        });
      }
    });

    return () => {
      if (canvas) canvas.dispose();
      fabricCanvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageIndex, currentDesign?.id]);

  // Sync objects when page data changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !page) return;

    import("fabric").then((fabricModule) => {
      // Update background
      canvas.backgroundColor = page.background || "#ffffff";

      // Sync objects
      const canvasObjs = canvas.getObjects() as FabricCanvasObject[];
      const pageObjIds = new Set(page.objects.map((o) => o.id));
      const canvasObjMap = new Map<string, FabricCanvasObject>(canvasObjs.map((o) => [o.id ?? '', o]));

      // Remove objects no longer in page
      canvasObjs.forEach((co) => {
        if (co.id && !pageObjIds.has(co.id)) {
          canvas.remove(co);
        }
      });

      // Add/update objects
      page.objects.forEach((obj, idx) => {
        const existing = canvasObjMap.get(obj.id);
        if (existing) {
          // Update visibility and lock state
          existing.set({
            selectable: !obj.locked,
            evented: !obj.locked,
            visible: obj.visible,
          });
          (existing as any).moveTo?.(idx);
        }
      });

      canvas.requestRenderAll();
    });
  }, [page?.objects, page?.background, fabricCanvasRef]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "Space") {
        e.preventDefault();
        spaceDownRef.current = true;
        if (canvas.defaultCursor) canvas.defaultCursor = "grab";
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const active = canvas.getActiveObjects();
        if (active.length > 0) {
          pushUndo();
          (active as FabricCanvasObject[]).forEach((obj) => {
            if (obj.id) removeObject(obj.id);
            canvas.remove(obj);
          });
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }
      }

      // Ctrl+Z undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        useDesignStore.getState().undo();
      }
      // Ctrl+Y or Ctrl+Shift+Z redo
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        useDesignStore.getState().redo();
      }

      // Ctrl+C copy
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        const active = canvas.getActiveObject() as FabricCanvasObject | null;
        if (active) {
          const cloned = await (active.clone as any)() as FabricCanvasObject;
          (window as unknown as Record<string, FabricCanvasObject>).__designClipboard = cloned;
        }
      }

      // Ctrl+V paste
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        const clipped = (window as unknown as Record<string, FabricCanvasObject>).__designClipboard;
        if (clipped) {
          const pasted = await (clipped.clone as any)() as FabricCanvasObject;
          pasted.set({
            left: (pasted.left || 0) + 20,
            top: (pasted.top || 0) + 20,
            id: crypto.randomUUID(),
          } as Partial<fabric.Object>);
          canvas.add(pasted);
          canvas.setActiveObject(pasted);
          canvas.requestRenderAll();
          const newObj: DesignObject = {
            id: pasted.id ?? crypto.randomUUID(),
            type: pasted.type === "i-text" || pasted.type === "textbox" ? "text" : pasted.type === "image" ? "image" : "shape",
            name: `${pasted.type} copy`,
            fabricData: pasted.toObject(["id"]),
            locked: false,
            visible: true,
          };
          addObject(newObj);
        }
      }

      // Arrow key nudge
      const nudge = e.shiftKey ? 10 : 1;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const active = canvas.getActiveObject();
        if (active) {
          e.preventDefault();
          if (e.key === "ArrowUp") active.set("top", (active.top || 0) - nudge);
          if (e.key === "ArrowDown") active.set("top", (active.top || 0) + nudge);
          if (e.key === "ArrowLeft") active.set("left", (active.left || 0) - nudge);
          if (e.key === "ArrowRight") active.set("left", (active.left || 0) + nudge);
          active.setCoords();
          canvas.requestRenderAll();
          if (active.id) {
            updateObject(active.id, { fabricData: active.toObject(["id"]) });
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDownRef.current = false;
        const canvas = fabricCanvasRef.current;
        if (canvas) canvas.defaultCursor = "default";
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [fabricCanvasRef, pushUndo, removeObject, updateObject, addObject, setSelectedObjects]);

  // Pan with spacebar + mouse drag
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseDown = (e: MouseEvent) => {
      if (spaceDownRef.current) {
        isPanningRef.current = true;
        lastPanPosRef.current = { x: e.clientX, y: e.clientY };
        container.style.cursor = "grabbing";
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (isPanningRef.current) {
        const dx = e.clientX - lastPanPosRef.current.x;
        const dy = e.clientY - lastPanPosRef.current.y;
        container.scrollLeft -= dx;
        container.scrollTop -= dy;
        lastPanPosRef.current = { x: e.clientX, y: e.clientY };
      }
    };
    const onMouseUp = () => {
      isPanningRef.current = false;
      container.style.cursor = "";
    };

    container.addEventListener("mousedown", onMouseDown);
    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseup", onMouseUp);
    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const handleZoomIn = () => setZoom(zoom + 0.25);
  const handleZoomOut = () => setZoom(zoom - 0.25);
  const handleZoomFit = () => setZoom(1);

  const totalScale = displayScale * zoom;

  return (
    <div ref={containerRef} className="relative flex-1 overflow-auto bg-muted/30">
      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 bg-background/90 backdrop-blur-sm border rounded-lg shadow-sm px-1 py-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-medium w-12 text-center tabular-nums">
          {Math.round(totalScale * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomFit}>
          <Maximize className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Canvas wrapper */}
      <div className="flex items-center justify-center min-h-full min-w-full p-10">
        <div
          ref={wrapperRef}
          className="shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] rounded-sm relative"
          style={{
            width: canvasW * totalScale,
            height: canvasH * totalScale,
            transform: `scale(1)`,
            transformOrigin: "center center",
          }}
        >
          <div
            style={{
              width: canvasW,
              height: canvasH,
              transform: `scale(${totalScale})`,
              transformOrigin: "top left",
            }}
          >
            <canvas ref={canvasElRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

function addFabricObject(
  fabricModule: { util: { enlivenObjects: (objects: unknown[]) => Promise<fabric.Object[]> } },
  canvas: fabric.Canvas,
  obj: DesignObject
) {
  if (obj.fabricData && Object.keys(obj.fabricData).length > 0) {
    fabricModule.util.enlivenObjects([obj.fabricData]).then((enlivened) => {
      enlivened.forEach((fObj) => {
        (fObj as FabricCanvasObject).id = obj.id;
        fObj.set({
          selectable: !obj.locked,
          evented: !obj.locked,
          visible: obj.visible,
        });
        canvas.add(fObj);
      });
      canvas.requestRenderAll();
    });
  }
}
