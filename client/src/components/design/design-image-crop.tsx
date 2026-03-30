"use client";

// IDEA-059: Image crop tool — crop selection overlay on selected images with aspect ratio presets

import { useState, useRef, useCallback, useEffect } from "react";
import { Crop, Check, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type * as fabric from "fabric";

/** fabric.FabricImage with the getElement() method present at runtime */
interface FabricImageWithElement extends fabric.FabricImage {
  getElement(): HTMLImageElement;
}

/** Minimal typed interface for accessing fabric.Rect constructor at runtime */
interface FabricModuleWithRect {
  Rect: new (options: Record<string, unknown>) => fabric.Rect;
}

interface ImageCropToolProps {
  fabricCanvasRef: React.MutableRefObject<fabric.Canvas | null>;
}

interface AspectPreset {
  label: string;
  ratio: number | null; // null = freeform
}

const ASPECT_PRESETS: AspectPreset[] = [
  { label: "Free", ratio: null },
  { label: "1:1", ratio: 1 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "3:2", ratio: 3 / 2 },
  { label: "2:3", ratio: 2 / 3 },
  { label: "9:16", ratio: 9 / 16 },
];

export default function DesignImageCrop({ fabricCanvasRef }: ImageCropToolProps) {
  const [selectedPreset, setSelectedPreset] = useState<AspectPreset>(ASPECT_PRESETS[1]);
  const [isCropping, setIsCropping] = useState(false);
  const [hasImageSelected, setHasImageSelected] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 10, y: 10, w: 80, h: 80 }); // % of image

  // Detect selected object type
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const check = () => {
      const obj = canvas.getActiveObject();
      setHasImageSelected(!!(obj && (obj.type === "image" || obj.type === "Image")));
    };
    canvas.on("selection:created", check);
    canvas.on("selection:updated", check);
    canvas.on("selection:cleared", () => setHasImageSelected(false));
    return () => {
      canvas.off("selection:created", check);
      canvas.off("selection:updated", check);
      canvas.off("selection:cleared");
    };
  }, [fabricCanvasRef]);

  // Apply aspect ratio to cropRect
  useEffect(() => {
    if (selectedPreset.ratio === null) return;
    setCropRect((prev) => {
      const w = prev.w;
      const h = w / selectedPreset.ratio!;
      return { ...prev, h: Math.min(h, 100 - prev.y) };
    });
  }, [selectedPreset]);

  const applyCrop = useCallback(async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj || (obj.type !== "image" && obj.type !== "Image")) return;

    const imgEl = (obj as FabricImageWithElement).getElement();
    if (!imgEl) return;

    const natW = imgEl.naturalWidth || imgEl.width;
    const natH = imgEl.naturalHeight || imgEl.height;

    const sx = (cropRect.x / 100) * natW;
    const sy = (cropRect.y / 100) * natH;
    const sw = (cropRect.w / 100) * natW;
    const sh = (cropRect.h / 100) * natH;

    // Use fabric clipPath
    const fab = await import("fabric") as unknown as FabricModuleWithRect;
    const clipRect = new fab.Rect({
      left: -(obj.width! * (obj.scaleX ?? 1)) / 2 + sx * ((obj.scaleX ?? 1)),
      top: -(obj.height! * (obj.scaleY ?? 1)) / 2 + sy * ((obj.scaleY ?? 1)),
      width: sw * ((obj.scaleX ?? 1)),
      height: sh * ((obj.scaleY ?? 1)),
      absolutePositioned: false,
    });

    obj.clipPath = clipRect;
    obj.dirty = true;
    canvas.requestRenderAll();
    setIsCropping(false);
  }, [fabricCanvasRef, cropRect]);

  const resetCrop = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    obj.clipPath = undefined;
    obj.dirty = true;
    canvas.requestRenderAll();
    setCropRect({ x: 0, y: 0, w: 100, h: 100 });
  }, [fabricCanvasRef]);

  if (!hasImageSelected) {
    return (
      <div className="p-3 text-center text-xs text-muted-foreground py-6">
        <Crop className="w-6 h-6 mx-auto mb-2 opacity-40" />
        Select an image to use the crop tool
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-1.5">
        <Crop className="w-3.5 h-3.5 text-green-500" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Crop Image</span>
      </div>

      {/* Aspect ratio presets */}
      <div className="space-y-1">
        <Label className="text-[10px]">Aspect Ratio</Label>
        <div className="flex flex-wrap gap-1">
          {ASPECT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setSelectedPreset(preset)}
              className={cn(
                "text-[10px] px-2 py-1 rounded border transition-all",
                selectedPreset.label === preset.label
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-muted-foreground/40"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Crop region sliders */}
      <div className="space-y-2 bg-muted/20 rounded-md p-2">
        <Label className="text-[10px] text-muted-foreground">Crop Region (% of image)</Label>
        {[
          { key: "x" as const, label: "Left" },
          { key: "y" as const, label: "Top" },
          { key: "w" as const, label: "Width" },
          { key: "h" as const, label: "Height" },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <Label className="text-[10px] w-10 shrink-0">{label}</Label>
            <input
              type="range"
              min={0}
              max={100}
              value={cropRect[key]}
              onChange={(e) => {
                const val = Number(e.target.value);
                setCropRect((prev) => {
                  const next = { ...prev, [key]: val };
                  if (selectedPreset.ratio !== null && (key === "w" || key === "h")) {
                    if (key === "w") next.h = val / selectedPreset.ratio;
                    else next.w = val * selectedPreset.ratio;
                  }
                  return next;
                });
              }}
              className="flex-1 h-1.5 accent-primary"
            />
            <span className="text-[10px] tabular-nums w-6 text-right">{Math.round(cropRect[key])}</span>
          </div>
        ))}
      </div>

      {/* Preview box */}
      <div className="relative w-full h-24 bg-muted/30 rounded border overflow-hidden">
        <div
          className="absolute border-2 border-primary bg-primary/10"
          style={{
            left: `${cropRect.x}%`,
            top: `${cropRect.y}%`,
            width: `${Math.min(cropRect.w, 100 - cropRect.x)}%`,
            height: `${Math.min(cropRect.h, 100 - cropRect.y)}%`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[9px] text-muted-foreground pointer-events-none">
          Crop preview
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-7 text-xs"
          onClick={resetCrop}
          title="Remove clip"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset
        </Button>
        <Button
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={applyCrop}
        >
          <Check className="w-3 h-3 mr-1" />
          Apply Crop
        </Button>
      </div>
    </div>
  );
}
