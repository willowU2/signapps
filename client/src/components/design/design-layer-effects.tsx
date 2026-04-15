"use client";

// IDEA-057: Layer effects — shadow, blur, glow dropdowns in property panel per fabric.js object

import { useState, useCallback, useEffect } from "react";
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import type * as fabric from "fabric";

interface LayerEffectsProps {
  fabricCanvasRef: React.MutableRefObject<fabric.Canvas | null>;
}

/** Minimal typed interface for fabric.filters.Blur access at runtime */
interface FabricFiltersModule {
  filters: {
    Blur: new (options: { blur: number }) => fabric.filters.BaseFilter<"Blur">;
  };
}

/** fabric.Shadow at runtime exposes numeric properties not always in the declared type */
interface FabricShadowRuntime {
  color?: string;
  blur?: number;
  offsetX?: number;
  offsetY?: number;
}

/** fabric.FabricObject extended with filter/applyFilters props available on image objects */
interface FabricObjectWithFilters extends fabric.Object {
  filters?: fabric.filters.BaseFilter<string>[];
  applyFilters?: () => void;
}

interface EffectState {
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  blurEnabled: boolean;
  blurAmount: number;
  glowEnabled: boolean;
  glowColor: string;
  glowSize: number;
}

const DEFAULT_EFFECTS: EffectState = {
  shadowEnabled: false,
  shadowColor: "#00000066",
  shadowBlur: 10,
  shadowOffsetX: 4,
  shadowOffsetY: 4,
  blurEnabled: false,
  blurAmount: 5,
  glowEnabled: false,
  glowColor: "#6366f1",
  glowSize: 15,
};

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        className="w-full flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1 hover:text-foreground transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        {title}
      </button>
      {open && <div className="space-y-2 pb-2">{children}</div>}
    </div>
  );
}

export default function DesignLayerEffects({
  fabricCanvasRef,
}: LayerEffectsProps) {
  const [effects, setEffects] = useState<EffectState>(DEFAULT_EFFECTS);

  const applyEffects = useCallback(
    (next: EffectState) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const rawObj = canvas.getActiveObject();
      if (!rawObj) return;
      const obj = rawObj as FabricObjectWithFilters;

      // Shadow
      if (next.shadowEnabled) {
        obj.set("shadow", {
          color: next.shadowColor,
          blur: next.shadowBlur,
          offsetX: next.shadowOffsetX,
          offsetY: next.shadowOffsetY,
          affectStroke: false,
        });
      } else {
        obj.set("shadow", null);
      }

      // Blur via filters (fabric v6+)
      if (typeof obj.filters !== "undefined") {
        // Remove existing blur and glow filters
        obj.filters = (obj.filters ?? []).filter(
          (f: fabric.filters.BaseFilter<string>) =>
            f.type !== "Blur" && f.type !== "__glow__",
        );
        if (next.blurEnabled && next.blurAmount > 0) {
          import("fabric").then((fab) => {
            const blur = new (
              fab as unknown as FabricFiltersModule
            ).filters.Blur({ blur: next.blurAmount / 100 });
            obj.filters = [...(obj.filters ?? []), blur];
            obj.applyFilters?.();
            canvas.requestRenderAll();
          });
        }
        if (next.glowEnabled) {
          // Glow: simulate with colored shadow (no fill shift)
          obj.set("shadow", {
            color: next.glowColor + "99",
            blur: next.glowSize * 2,
            offsetX: 0,
            offsetY: 0,
            affectStroke: false,
          });
        }
        obj.applyFilters?.();
      }

      obj.setCoords();
      canvas.requestRenderAll();
    },
    [fabricCanvasRef],
  );

  const setProp = useCallback(
    <K extends keyof EffectState>(key: K, value: EffectState[K]) => {
      setEffects((prev) => {
        const next = { ...prev, [key]: value };
        applyEffects(next);
        return next;
      });
    },
    [applyEffects],
  );

  // Reset on new selection
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const handler = () => {
      const obj = canvas.getActiveObject();
      if (!obj) return;
      const shadow = obj.shadow as FabricShadowRuntime | null;
      setEffects({
        ...DEFAULT_EFFECTS,
        shadowEnabled: !!shadow,
        shadowColor: shadow?.color ?? DEFAULT_EFFECTS.shadowColor,
        shadowBlur: shadow?.blur ?? DEFAULT_EFFECTS.shadowBlur,
        shadowOffsetX: shadow?.offsetX ?? DEFAULT_EFFECTS.shadowOffsetX,
        shadowOffsetY: shadow?.offsetY ?? DEFAULT_EFFECTS.shadowOffsetY,
      });
    };
    canvas.on("selection:created", handler);
    canvas.on("selection:updated", handler);
    return () => {
      canvas.off("selection:created", handler);
      canvas.off("selection:updated", handler);
    };
  }, [fabricCanvasRef]);

  return (
    <div className="space-y-1 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-purple-500" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Effects
        </span>
      </div>

      <Section title="Drop Shadow">
        <div className="flex items-center justify-between">
          <Label className="text-[10px]">Enable</Label>
          <Switch
            checked={effects.shadowEnabled}
            onCheckedChange={(v) => setProp("shadowEnabled", v)}
          />
        </div>
        {effects.shadowEnabled && (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-[10px] w-10">Color</Label>
              <input
                type="color"
                value={effects.shadowColor.slice(0, 7)}
                onChange={(e) => setProp("shadowColor", e.target.value + "66")}
                className="h-6 w-6 rounded border cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-[10px]">Blur</Label>
                <span className="text-[10px] tabular-nums">
                  {effects.shadowBlur}
                </span>
              </div>
              <Slider
                value={[effects.shadowBlur]}
                min={0}
                max={60}
                step={1}
                onValueChange={([v]) => setProp("shadowBlur", v)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px]">Offset X</Label>
                  <span className="text-[10px] tabular-nums">
                    {effects.shadowOffsetX}
                  </span>
                </div>
                <Slider
                  value={[effects.shadowOffsetX]}
                  min={-30}
                  max={30}
                  step={1}
                  onValueChange={([v]) => setProp("shadowOffsetX", v)}
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-[10px]">Offset Y</Label>
                  <span className="text-[10px] tabular-nums">
                    {effects.shadowOffsetY}
                  </span>
                </div>
                <Slider
                  value={[effects.shadowOffsetY]}
                  min={-30}
                  max={30}
                  step={1}
                  onValueChange={([v]) => setProp("shadowOffsetY", v)}
                />
              </div>
            </div>
          </>
        )}
      </Section>

      <Separator />

      <Section title="Blur">
        <div className="flex items-center justify-between">
          <Label className="text-[10px]">Enable</Label>
          <Switch
            checked={effects.blurEnabled}
            onCheckedChange={(v) => setProp("blurEnabled", v)}
          />
        </div>
        {effects.blurEnabled && (
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-[10px]">Amount</Label>
              <span className="text-[10px] tabular-nums">
                {effects.blurAmount}px
              </span>
            </div>
            <Slider
              value={[effects.blurAmount]}
              min={1}
              max={40}
              step={1}
              onValueChange={([v]) => setProp("blurAmount", v)}
            />
          </div>
        )}
      </Section>

      <Separator />

      <Section title="Glow">
        <div className="flex items-center justify-between">
          <Label className="text-[10px]">Enable</Label>
          <Switch
            checked={effects.glowEnabled}
            onCheckedChange={(v) => setProp("glowEnabled", v)}
          />
        </div>
        {effects.glowEnabled && (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-[10px] w-10">Color</Label>
              <input
                type="color"
                value={effects.glowColor}
                onChange={(e) => setProp("glowColor", e.target.value)}
                className="h-6 w-6 rounded border cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-[10px]">Size</Label>
                <span className="text-[10px] tabular-nums">
                  {effects.glowSize}px
                </span>
              </div>
              <Slider
                value={[effects.glowSize]}
                min={2}
                max={50}
                step={1}
                onValueChange={([v]) => setProp("glowSize", v)}
              />
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
