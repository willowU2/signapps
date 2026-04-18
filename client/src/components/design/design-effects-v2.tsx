"use client";

// Expanded effects panel — inspired by Canva/Figma/Photopea.
// Applies to any fabric.Object; image-specific filters degrade gracefully
// on shapes and text.

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Eye,
  Palette,
  Type as TypeIcon,
  RotateCw,
  Sliders,
  Wand2,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type * as fabric from "fabric";

interface LayerEffectsProps {
  fabricCanvasRef: React.MutableRefObject<fabric.Canvas | null>;
}

/** Runtime shape of fabric.filters we use — typed loosely since fabric v6 exposes many. */
type FabricFilter = fabric.filters.BaseFilter<string> & {
  type?: string;
};

interface FabricFiltersModule {
  filters: {
    Blur: new (options: { blur: number }) => FabricFilter;
    Brightness: new (options: { brightness: number }) => FabricFilter;
    Contrast: new (options: { contrast: number }) => FabricFilter;
    Saturation: new (options: { saturation: number }) => FabricFilter;
    HueRotation: new (options: { rotation: number }) => FabricFilter;
    Gamma: new (options: { gamma: [number, number, number] }) => FabricFilter;
    Pixelate: new (options: { blocksize: number }) => FabricFilter;
    Noise: new (options: { noise: number }) => FabricFilter;
    Grayscale: new () => FabricFilter;
    Invert: new () => FabricFilter;
    Sepia: new () => FabricFilter;
    BlackWhite: new () => FabricFilter;
    Vintage: new () => FabricFilter;
    Kodachrome: new () => FabricFilter;
    Polaroid: new () => FabricFilter;
    Technicolor: new () => FabricFilter;
    BlendColor: new (options: {
      color: string;
      mode: string;
      alpha: number;
    }) => FabricFilter;
    Convolute: new (options: {
      matrix: number[];
      opaque?: boolean;
    }) => FabricFilter;
  };
}

interface FabricShadowRuntime {
  color?: string;
  blur?: number;
  offsetX?: number;
  offsetY?: number;
}

type FabricObjectWithAll = fabric.Object & {
  filters?: FabricFilter[];
  applyFilters?: () => void;
  rx?: number; // rect corner radius
  ry?: number;
  strokeDashArray?: number[] | null;
  charSpacing?: number;
  underline?: boolean;
  linethrough?: boolean;
  overline?: boolean;
  globalCompositeOperation?: string;
};

interface EffectState {
  // Shadow (universal)
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  // Glow (uses shadow internally)
  glowEnabled: boolean;
  glowColor: string;
  glowSize: number;
  // Stroke
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  strokeDashed: boolean;
  // Opacity
  opacity: number;
  // Corner radius (rect only but harmless on others)
  cornerRadius: number;
  // Transform
  skewX: number;
  skewY: number;
  // Image filters
  blurEnabled: boolean;
  blurAmount: number;
  brightness: number; // -1 to 1
  contrast: number; // -1 to 1
  saturation: number; // -1 to 1
  hue: number; // -Math.PI to Math.PI
  pixelateEnabled: boolean;
  pixelateSize: number;
  noiseEnabled: boolean;
  noiseAmount: number;
  tintEnabled: boolean;
  tintColor: string;
  tintStrength: number;
  // Color preset
  preset: PresetId;
  // Text decoration
  textUnderline: boolean;
  textLinethrough: boolean;
  textOverline: boolean;
  charSpacing: number;
  // Blend mode
  blendMode: string;
}

type PresetId =
  | "none"
  | "grayscale"
  | "sepia"
  | "blackwhite"
  | "invert"
  | "vintage"
  | "kodachrome"
  | "polaroid"
  | "technicolor";

const DEFAULTS: EffectState = {
  shadowEnabled: false,
  shadowColor: "#00000066",
  shadowBlur: 10,
  shadowOffsetX: 4,
  shadowOffsetY: 4,
  glowEnabled: false,
  glowColor: "#6366f1",
  glowSize: 15,
  strokeEnabled: false,
  strokeColor: "#000000",
  strokeWidth: 2,
  strokeDashed: false,
  opacity: 100,
  cornerRadius: 0,
  skewX: 0,
  skewY: 0,
  blurEnabled: false,
  blurAmount: 5,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  pixelateEnabled: false,
  pixelateSize: 8,
  noiseEnabled: false,
  noiseAmount: 50,
  tintEnabled: false,
  tintColor: "#6366f1",
  tintStrength: 0.5,
  preset: "none",
  textUnderline: false,
  textLinethrough: false,
  textOverline: false,
  charSpacing: 0,
  blendMode: "source-over",
};

const BLEND_MODES = [
  "source-over",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
];

// ─── Preset filter definitions ───
const PRESETS: {
  id: PresetId;
  label: string;
  accent: string;
  filter: keyof FabricFiltersModule["filters"] | null;
}[] = [
  { id: "none", label: "Aucun", accent: "bg-muted", filter: null },
  { id: "grayscale", label: "N&B", accent: "bg-zinc-500", filter: "Grayscale" },
  { id: "sepia", label: "Sépia", accent: "bg-amber-600", filter: "Sepia" },
  {
    id: "blackwhite",
    label: "Contrasté",
    accent: "bg-black",
    filter: "BlackWhite",
  },
  { id: "invert", label: "Négatif", accent: "bg-purple-500", filter: "Invert" },
  { id: "vintage", label: "Vintage", accent: "bg-rose-400", filter: "Vintage" },
  {
    id: "kodachrome",
    label: "Kodachrome",
    accent: "bg-red-600",
    filter: "Kodachrome",
  },
  {
    id: "polaroid",
    label: "Polaroid",
    accent: "bg-blue-500",
    filter: "Polaroid",
  },
  {
    id: "technicolor",
    label: "Technicolor",
    accent: "bg-pink-500",
    filter: "Technicolor",
  },
];

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        className="w-full flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1.5 hover:text-foreground transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        {Icon && <Icon className="w-3 h-3" />}
        {title}
      </button>
      {open && <div className="space-y-2 pb-2 pl-1">{children}</div>}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <Label className="text-[10px]">{label}</Label>
        <span className="text-[10px] tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

export default function DesignLayerEffects({
  fabricCanvasRef,
}: LayerEffectsProps) {
  const [effects, setEffects] = useState<EffectState>(DEFAULTS);

  const applyEffects = useCallback(
    async (next: EffectState) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const rawObj = canvas.getActiveObject();
      if (!rawObj) return;
      const obj = rawObj as FabricObjectWithAll;
      const fab = (await import("fabric")) as unknown as FabricFiltersModule;

      // ── Shadow / Glow (glow wins if both enabled — can't stack fabric shadows) ──
      if (next.glowEnabled) {
        obj.set("shadow", {
          color: next.glowColor + "bb",
          blur: next.glowSize * 2,
          offsetX: 0,
          offsetY: 0,
          affectStroke: false,
        });
      } else if (next.shadowEnabled) {
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

      // ── Stroke ──
      if (next.strokeEnabled) {
        obj.set("stroke", next.strokeColor);
        obj.set("strokeWidth", next.strokeWidth);
        obj.set(
          "strokeDashArray",
          next.strokeDashed
            ? [next.strokeWidth * 3, next.strokeWidth * 2]
            : null,
        );
      } else {
        obj.set("stroke", null);
        obj.set("strokeWidth", 0);
        obj.set("strokeDashArray", null);
      }

      // ── Opacity ──
      obj.set("opacity", next.opacity / 100);

      // ── Corner radius (Rect only) ──
      if (obj.type === "Rect" || obj.type === "rect") {
        obj.set("rx", next.cornerRadius);
        obj.set("ry", next.cornerRadius);
      }

      // ── Transform ──
      obj.set("skewX", next.skewX);
      obj.set("skewY", next.skewY);

      // ── Text properties ──
      if (
        obj.type === "Textbox" ||
        obj.type === "IText" ||
        obj.type === "Text" ||
        obj.type === "textbox" ||
        obj.type === "i-text" ||
        obj.type === "text"
      ) {
        obj.set("underline", next.textUnderline);
        obj.set("linethrough", next.textLinethrough);
        obj.set("overline", next.textOverline);
        obj.set("charSpacing", next.charSpacing);
      }

      // ── Blend mode ──
      obj.set("globalCompositeOperation", next.blendMode);

      // ── Image filters (only if filters array exists) ──
      if (typeof obj.filters !== "undefined") {
        const filters: FabricFilter[] = [];

        // Preset filter first (mutually exclusive)
        if (next.preset !== "none") {
          const presetDef = PRESETS.find((p) => p.id === next.preset);
          if (presetDef?.filter) {
            const Ctor = fab.filters[presetDef.filter];
            try {
              // @ts-expect-error — dynamic ctor signature
              filters.push(new Ctor());
            } catch {
              // ignore
            }
          }
        }

        // Color adjustments
        if (next.brightness !== 0) {
          filters.push(
            new fab.filters.Brightness({ brightness: next.brightness }),
          );
        }
        if (next.contrast !== 0) {
          filters.push(new fab.filters.Contrast({ contrast: next.contrast }));
        }
        if (next.saturation !== 0) {
          filters.push(
            new fab.filters.Saturation({ saturation: next.saturation }),
          );
        }
        if (next.hue !== 0) {
          filters.push(new fab.filters.HueRotation({ rotation: next.hue }));
        }

        // Blur
        if (next.blurEnabled && next.blurAmount > 0) {
          filters.push(new fab.filters.Blur({ blur: next.blurAmount / 100 }));
        }

        // Pixelate
        if (next.pixelateEnabled && next.pixelateSize > 0) {
          filters.push(
            new fab.filters.Pixelate({ blocksize: next.pixelateSize }),
          );
        }

        // Noise
        if (next.noiseEnabled && next.noiseAmount > 0) {
          filters.push(new fab.filters.Noise({ noise: next.noiseAmount }));
        }

        // Tint (BlendColor)
        if (next.tintEnabled) {
          filters.push(
            new fab.filters.BlendColor({
              color: next.tintColor,
              mode: "tint",
              alpha: next.tintStrength,
            }),
          );
        }

        obj.filters = filters;
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

  // Reset all effects
  const resetAll = useCallback(() => {
    setEffects(DEFAULTS);
    applyEffects(DEFAULTS);
  }, [applyEffects]);

  // Hydrate on selection change
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const handler = () => {
      const rawObj = canvas.getActiveObject();
      if (!rawObj) return;
      const obj = rawObj as FabricObjectWithAll;
      const shadow = obj.shadow as FabricShadowRuntime | null;
      setEffects({
        ...DEFAULTS,
        shadowEnabled:
          !!shadow && (shadow.offsetX !== 0 || shadow.offsetY !== 0),
        shadowColor: shadow?.color ?? DEFAULTS.shadowColor,
        shadowBlur: shadow?.blur ?? DEFAULTS.shadowBlur,
        shadowOffsetX: shadow?.offsetX ?? DEFAULTS.shadowOffsetX,
        shadowOffsetY: shadow?.offsetY ?? DEFAULTS.shadowOffsetY,
        strokeEnabled: !!obj.stroke && (obj.strokeWidth ?? 0) > 0,
        strokeColor:
          typeof obj.stroke === "string" ? obj.stroke : DEFAULTS.strokeColor,
        strokeWidth: obj.strokeWidth ?? DEFAULTS.strokeWidth,
        strokeDashed: !!obj.strokeDashArray?.length,
        opacity: Math.round((obj.opacity ?? 1) * 100),
        cornerRadius: obj.rx ?? 0,
        skewX: obj.skewX ?? 0,
        skewY: obj.skewY ?? 0,
        charSpacing: obj.charSpacing ?? 0,
        textUnderline: !!obj.underline,
        textLinethrough: !!obj.linethrough,
        textOverline: !!obj.overline,
        blendMode: obj.globalCompositeOperation ?? "source-over",
      });
    };
    canvas.on("selection:created", handler);
    canvas.on("selection:updated", handler);
    return () => {
      canvas.off("selection:created", handler);
      canvas.off("selection:updated", handler);
    };
  }, [fabricCanvasRef]);

  // Detect object type for conditional sections
  const objectKind = useMemo(() => {
    const canvas = fabricCanvasRef.current;
    const obj = canvas?.getActiveObject();
    const t = (obj?.type ?? "").toLowerCase();
    if (t.includes("image")) return "image";
    if (t.includes("text")) return "text";
    return "shape";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effects]);

  return (
    <div className="space-y-1 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Effets
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] px-2"
          onClick={resetAll}
          title="Réinitialiser tous les effets"
        >
          Reset
        </Button>
      </div>

      {/* Quick presets (image only, but we show them anyway for visual) */}
      <Section title="Filtres rapides" icon={Wand2} defaultOpen>
        <div className="grid grid-cols-3 gap-1.5">
          {PRESETS.map((p) => {
            const active = effects.preset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setProp("preset", p.id)}
                className={cn(
                  "relative rounded-md border overflow-hidden h-12 text-[10px] font-medium transition-all group",
                  active
                    ? "border-primary ring-1 ring-primary/40 shadow-sm"
                    : "border-border hover:border-primary/50",
                )}
                title={p.label}
              >
                <div
                  className={cn(
                    "absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity",
                    p.accent,
                  )}
                />
                <span className="relative text-white drop-shadow-sm">
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Separator />

      <Section title="Ombre portée" icon={Palette}>
        <div className="flex items-center justify-between">
          <Label className="text-[10px]">Activer</Label>
          <Switch
            checked={effects.shadowEnabled}
            onCheckedChange={(v) => setProp("shadowEnabled", v)}
          />
        </div>
        {effects.shadowEnabled && (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-[10px] w-12">Couleur</Label>
              <input
                type="color"
                value={effects.shadowColor.slice(0, 7)}
                onChange={(e) => setProp("shadowColor", e.target.value + "66")}
                className="h-6 w-6 rounded border cursor-pointer"
              />
            </div>
            <SliderRow
              label="Flou"
              value={effects.shadowBlur}
              min={0}
              max={60}
              onChange={(v) => setProp("shadowBlur", v)}
            />
            <div className="grid grid-cols-2 gap-2">
              <SliderRow
                label="X"
                value={effects.shadowOffsetX}
                min={-30}
                max={30}
                onChange={(v) => setProp("shadowOffsetX", v)}
              />
              <SliderRow
                label="Y"
                value={effects.shadowOffsetY}
                min={-30}
                max={30}
                onChange={(v) => setProp("shadowOffsetY", v)}
              />
            </div>
          </>
        )}
      </Section>

      <Section title="Lueur" icon={Sparkles}>
        <div className="flex items-center justify-between">
          <Label className="text-[10px]">Activer</Label>
          <Switch
            checked={effects.glowEnabled}
            onCheckedChange={(v) => setProp("glowEnabled", v)}
          />
        </div>
        {effects.glowEnabled && (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-[10px] w-12">Couleur</Label>
              <input
                type="color"
                value={effects.glowColor}
                onChange={(e) => setProp("glowColor", e.target.value)}
                className="h-6 w-6 rounded border cursor-pointer"
              />
            </div>
            <SliderRow
              label="Intensité"
              value={effects.glowSize}
              min={2}
              max={50}
              suffix="px"
              onChange={(v) => setProp("glowSize", v)}
            />
          </>
        )}
      </Section>

      <Section title="Contour" icon={Palette}>
        <div className="flex items-center justify-between">
          <Label className="text-[10px]">Activer</Label>
          <Switch
            checked={effects.strokeEnabled}
            onCheckedChange={(v) => setProp("strokeEnabled", v)}
          />
        </div>
        {effects.strokeEnabled && (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-[10px] w-12">Couleur</Label>
              <input
                type="color"
                value={effects.strokeColor}
                onChange={(e) => setProp("strokeColor", e.target.value)}
                className="h-6 w-6 rounded border cursor-pointer"
              />
            </div>
            <SliderRow
              label="Épaisseur"
              value={effects.strokeWidth}
              min={1}
              max={30}
              onChange={(v) => setProp("strokeWidth", v)}
            />
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">Pointillés</Label>
              <Switch
                checked={effects.strokeDashed}
                onCheckedChange={(v) => setProp("strokeDashed", v)}
              />
            </div>
          </>
        )}
      </Section>

      <Section title="Opacité & Arrondi" icon={Eye} defaultOpen>
        <SliderRow
          label="Opacité"
          value={effects.opacity}
          min={0}
          max={100}
          suffix="%"
          onChange={(v) => setProp("opacity", v)}
        />
        <SliderRow
          label="Arrondi (coins)"
          value={effects.cornerRadius}
          min={0}
          max={200}
          suffix="px"
          onChange={(v) => setProp("cornerRadius", v)}
        />
      </Section>

      <Section title="Transformation" icon={RotateCw}>
        <SliderRow
          label="Inclinaison X"
          value={effects.skewX}
          min={-45}
          max={45}
          suffix="°"
          onChange={(v) => setProp("skewX", v)}
        />
        <SliderRow
          label="Inclinaison Y"
          value={effects.skewY}
          min={-45}
          max={45}
          suffix="°"
          onChange={(v) => setProp("skewY", v)}
        />
      </Section>

      <Section title="Mode de fusion" icon={Sliders}>
        <select
          value={effects.blendMode}
          onChange={(e) => setProp("blendMode", e.target.value)}
          className="w-full h-7 text-[10px] rounded border border-input bg-background px-2"
        >
          {BLEND_MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Section>

      {objectKind === "image" && (
        <>
          <Separator />
          <Section title="Couleur & Lumière" icon={Sliders} defaultOpen>
            <SliderRow
              label="Luminosité"
              value={Math.round(effects.brightness * 100)}
              min={-100}
              max={100}
              onChange={(v) => setProp("brightness", v / 100)}
            />
            <SliderRow
              label="Contraste"
              value={Math.round(effects.contrast * 100)}
              min={-100}
              max={100}
              onChange={(v) => setProp("contrast", v / 100)}
            />
            <SliderRow
              label="Saturation"
              value={Math.round(effects.saturation * 100)}
              min={-100}
              max={100}
              onChange={(v) => setProp("saturation", v / 100)}
            />
            <SliderRow
              label="Teinte"
              value={Math.round((effects.hue * 180) / Math.PI)}
              min={-180}
              max={180}
              suffix="°"
              onChange={(v) => setProp("hue", (v * Math.PI) / 180)}
            />
          </Section>

          <Section title="Flou (image)">
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">Activer</Label>
              <Switch
                checked={effects.blurEnabled}
                onCheckedChange={(v) => setProp("blurEnabled", v)}
              />
            </div>
            {effects.blurEnabled && (
              <SliderRow
                label="Quantité"
                value={effects.blurAmount}
                min={1}
                max={40}
                suffix="px"
                onChange={(v) => setProp("blurAmount", v)}
              />
            )}
          </Section>

          <Section title="Pixélisation">
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">Activer</Label>
              <Switch
                checked={effects.pixelateEnabled}
                onCheckedChange={(v) => setProp("pixelateEnabled", v)}
              />
            </div>
            {effects.pixelateEnabled && (
              <SliderRow
                label="Taille"
                value={effects.pixelateSize}
                min={2}
                max={50}
                suffix="px"
                onChange={(v) => setProp("pixelateSize", v)}
              />
            )}
          </Section>

          <Section title="Grain / Bruit">
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">Activer</Label>
              <Switch
                checked={effects.noiseEnabled}
                onCheckedChange={(v) => setProp("noiseEnabled", v)}
              />
            </div>
            {effects.noiseEnabled && (
              <SliderRow
                label="Intensité"
                value={effects.noiseAmount}
                min={1}
                max={200}
                onChange={(v) => setProp("noiseAmount", v)}
              />
            )}
          </Section>

          <Section title="Teinte de couleur">
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">Activer</Label>
              <Switch
                checked={effects.tintEnabled}
                onCheckedChange={(v) => setProp("tintEnabled", v)}
              />
            </div>
            {effects.tintEnabled && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] w-12">Couleur</Label>
                  <input
                    type="color"
                    value={effects.tintColor}
                    onChange={(e) => setProp("tintColor", e.target.value)}
                    className="h-6 w-6 rounded border cursor-pointer"
                  />
                </div>
                <SliderRow
                  label="Force"
                  value={Math.round(effects.tintStrength * 100)}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) => setProp("tintStrength", v / 100)}
                />
              </>
            )}
          </Section>
        </>
      )}

      {objectKind === "text" && (
        <>
          <Separator />
          <Section title="Texte" icon={TypeIcon} defaultOpen>
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">Souligné</Label>
              <Switch
                checked={effects.textUnderline}
                onCheckedChange={(v) => setProp("textUnderline", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">Barré</Label>
              <Switch
                checked={effects.textLinethrough}
                onCheckedChange={(v) => setProp("textLinethrough", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-[10px]">Surligné</Label>
              <Switch
                checked={effects.textOverline}
                onCheckedChange={(v) => setProp("textOverline", v)}
              />
            </div>
            <SliderRow
              label="Espacement caractères"
              value={effects.charSpacing}
              min={-200}
              max={1000}
              step={10}
              onChange={(v) => setProp("charSpacing", v)}
            />
          </Section>
        </>
      )}
    </div>
  );
}
