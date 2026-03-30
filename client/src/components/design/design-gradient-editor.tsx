"use client";

// IDEA-058: Gradient editor — multi-stop gradient picker for fill/stroke on shapes

import { useState, useCallback, useRef } from "react";
import { Plus, Trash2, Palette, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type * as fabric from "fabric";

/** Minimal typed interface for the fabric module's Gradient constructor */
interface FabricModuleWithGradient {
  Gradient: new (options: {
    type: "linear" | "radial";
    coords: Record<string, number>;
    colorStops: { offset: number; color: string }[];
  }) => fabric.Gradient<"linear" | "radial">;
}

interface GradientStop {
  id: string;
  offset: number; // 0-1
  color: string;
}

interface GradientEditorProps {
  fabricCanvasRef: React.MutableRefObject<fabric.Canvas | null>;
}

const DEFAULT_STOPS: GradientStop[] = [
  { id: "s1", offset: 0, color: "#6366f1" },
  { id: "s2", offset: 1, color: "#ec4899" },
];

type GradientType = "linear" | "radial";

export default function DesignGradientEditor({ fabricCanvasRef }: GradientEditorProps) {
  const [stops, setStops] = useState<GradientStop[]>(DEFAULT_STOPS);
  const [gradientType, setGradientType] = useState<GradientType>("linear");
  const [angle, setAngle] = useState(90);
  const [selectedStopId, setSelectedStopId] = useState<string>("s1");
  const [applyTo, setApplyTo] = useState<"fill" | "stroke">("fill");

  const previewGradient = (() => {
    const sortedStops = [...stops].sort((a, b) => a.offset - b.offset);
    const stops_css = sortedStops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(", ");
    return gradientType === "linear"
      ? `linear-gradient(${angle}deg, ${stops_css})`
      : `radial-gradient(circle, ${stops_css})`;
  })();

  const buildFabricGradient = useCallback(
    async (obj: fabric.Object) => {
      const fab = await import("fabric") as unknown as FabricModuleWithGradient;
      const sortedStops = [...stops].sort((a, b) => a.offset - b.offset);
      const w = (obj.width ?? 100) * (obj.scaleX ?? 1);
      const h = (obj.height ?? 100) * (obj.scaleY ?? 1);

      const colorStops = sortedStops.map((s) => ({ offset: s.offset, color: s.color }));

      let gradient: fabric.Gradient<"linear" | "radial">;
      if (gradientType === "linear") {
        const rad = (angle * Math.PI) / 180;
        gradient = new fab.Gradient({
          type: "linear",
          coords: {
            x1: w / 2 - (Math.cos(rad) * w) / 2,
            y1: h / 2 - (Math.sin(rad) * h) / 2,
            x2: w / 2 + (Math.cos(rad) * w) / 2,
            y2: h / 2 + (Math.sin(rad) * h) / 2,
          },
          colorStops,
        });
      } else {
        gradient = new fab.Gradient({
          type: "radial",
          coords: { x1: w / 2, y1: h / 2, r1: 0, x2: w / 2, y2: h / 2, r2: Math.max(w, h) / 2 },
          colorStops,
        });
      }
      return gradient;
    },
    [stops, gradientType, angle]
  );

  const applyGradient = useCallback(async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const gradient = await buildFabricGradient(obj);
    obj.set(applyTo, gradient);
    obj.setCoords();
    canvas.requestRenderAll();
  }, [fabricCanvasRef, buildFabricGradient, applyTo]);

  const updateStop = (id: string, patch: Partial<GradientStop>) => {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addStop = () => {
    const newOffset = stops.length > 0 ? Math.min(1, (stops[stops.length - 1].offset + 0.1)) : 0.5;
    const newStop: GradientStop = { id: crypto.randomUUID(), offset: newOffset, color: "#f59e0b" };
    setStops((prev) => [...prev, newStop]);
    setSelectedStopId(newStop.id);
  };

  const removeStop = (id: string) => {
    if (stops.length <= 2) return;
    setStops((prev) => prev.filter((s) => s.id !== id));
    if (selectedStopId === id) setSelectedStopId(stops.find((s) => s.id !== id)?.id ?? "");
  };

  const selectedStop = stops.find((s) => s.id === selectedStopId);

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-1.5">
        <Palette className="w-3.5 h-3.5 text-pink-500" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gradient</span>
      </div>

      {/* Type + Apply to */}
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-[10px]">Type</Label>
          <div className="flex gap-1">
            {(["linear", "radial"] as GradientType[]).map((t) => (
              <button
                key={t}
                onClick={() => setGradientType(t)}
                className={cn(
                  "flex-1 text-[10px] py-1 rounded border transition-all capitalize",
                  gradientType === t ? "border-primary bg-primary/10 text-primary" : "border-border"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-[10px]">Apply to</Label>
          <div className="flex gap-1">
            {(["fill", "stroke"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setApplyTo(t)}
                className={cn(
                  "flex-1 text-[10px] py-1 rounded border transition-all capitalize",
                  applyTo === t ? "border-primary bg-primary/10 text-primary" : "border-border"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Angle (linear only) */}
      {gradientType === "linear" && (
        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-[10px]">Angle</Label>
            <div className="flex items-center gap-1">
              <span className="text-[10px] tabular-nums">{angle}°</span>
              <button onClick={() => setAngle((a) => (a + 45) % 360)} className="p-0.5 hover:bg-muted rounded">
                <RotateCw className="w-3 h-3" />
              </button>
            </div>
          </div>
          <Slider value={[angle]} min={0} max={360} step={15} onValueChange={([v]) => setAngle(v)} />
        </div>
      )}

      {/* Gradient preview bar */}
      <div
        className="h-8 rounded-md border cursor-pointer"
        style={{ background: previewGradient }}
        title="Gradient preview"
      />

      {/* Stops bar */}
      <div className="relative h-6 rounded border bg-muted/30">
        <div className="absolute inset-0 rounded" style={{ background: previewGradient }} />
        {stops.map((stop) => (
          <button
            key={stop.id}
            onClick={() => setSelectedStopId(stop.id)}
            className={cn(
              "absolute top-0 w-3 h-6 rounded-sm border-2 transition-all",
              selectedStopId === stop.id ? "border-primary scale-125 z-10" : "border-white/80 z-0"
            )}
            style={{
              left: `calc(${stop.offset * 100}% - 6px)`,
              backgroundColor: stop.color,
            }}
          />
        ))}
      </div>

      {/* Stop list */}
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {stops
          .slice()
          .sort((a, b) => a.offset - b.offset)
          .map((stop) => (
            <div
              key={stop.id}
              className={cn(
                "flex items-center gap-2 p-1.5 rounded border cursor-pointer transition-all",
                selectedStopId === stop.id ? "border-primary bg-primary/5" : "border-border"
              )}
              onClick={() => setSelectedStopId(stop.id)}
            >
              <input
                type="color"
                value={stop.color}
                onChange={(e) => updateStop(stop.id, { color: e.target.value })}
                className="h-5 w-5 rounded border cursor-pointer shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-[10px] flex-1">{Math.round(stop.offset * 100)}%</span>
              <Slider
                value={[stop.offset * 100]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => updateStop(stop.id, { offset: v / 100 })}
                className="w-20"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => { e.stopPropagation(); removeStop(stop.id); }}
                className="p-0.5 hover:text-destructive rounded transition-colors"
                disabled={stops.length <= 2}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={addStop}>
          <Plus className="w-3 h-3 mr-1" /> Stop
        </Button>
        <Button size="sm" className="flex-1 h-7 text-xs" onClick={applyGradient}>
          Apply
        </Button>
      </div>
    </div>
  );
}
