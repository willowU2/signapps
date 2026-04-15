"use client";

import { useState } from "react";
import { useDesignStore } from "@/stores/design-store";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { PHOTO_FILTER_PRESETS, type PhotoFilter } from "./types";

interface DesignPhotoFiltersProps {
  fabricCanvasRef: React.MutableRefObject<any | null>;
}

export default function DesignPhotoFilters({
  fabricCanvasRef,
}: DesignPhotoFiltersProps) {
  const { selectedObjectIds } = useDesignStore();
  const [activePreset, setActivePreset] = useState<string>("original");
  const [manualFilters, setManualFilters] = useState<PhotoFilter>(
    PHOTO_FILTER_PRESETS[0],
  );

  const applyFilter = async (filter: PhotoFilter) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== "image") return;

    const fabricModule = await import("fabric");

    // Clear existing filters
    obj.filters = [];

    // Apply filters using fabric.js built-in filters
    if (filter.brightness !== 100) {
      obj.filters.push(
        new fabricModule.filters.Brightness({
          brightness: (filter.brightness - 100) / 100,
        }),
      );
    }
    if (filter.contrast !== 100) {
      obj.filters.push(
        new fabricModule.filters.Contrast({
          contrast: (filter.contrast - 100) / 100,
        }),
      );
    }
    if (filter.saturation !== 100) {
      obj.filters.push(
        new fabricModule.filters.Saturation({
          saturation: (filter.saturation - 100) / 100,
        }),
      );
    }
    if (filter.blur > 0) {
      obj.filters.push(
        new fabricModule.filters.Blur({ blur: filter.blur / 100 }),
      );
    }
    if (filter.grayscale > 0) {
      obj.filters.push(new fabricModule.filters.Grayscale());
    }
    if (filter.sepia > 0) {
      obj.filters.push(new fabricModule.filters.Sepia());
    }
    if (filter.hueRotate !== 0) {
      obj.filters.push(
        new fabricModule.filters.HueRotation({
          rotation: filter.hueRotate / 360,
        }),
      );
    }

    obj.applyFilters();
    canvas.requestRenderAll();
  };

  const handlePresetClick = (preset: PhotoFilter) => {
    setActivePreset(preset.id);
    setManualFilters(preset);
    applyFilter(preset);
  };

  const handleSliderChange = (key: keyof PhotoFilter, value: number) => {
    const updated = { ...manualFilters, [key]: value };
    setManualFilters(updated);
    setActivePreset("");
    applyFilter(updated);
  };

  if (selectedObjectIds.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        Select an image to apply filters
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Presets
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {PHOTO_FILTER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(preset)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-2 transition-all",
                activePreset === preset.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30",
              )}
            >
              <div
                className="w-full aspect-square rounded-md bg-gradient-to-br from-sky-400 to-indigo-600"
                style={{
                  filter: `brightness(${preset.brightness}%) contrast(${preset.contrast}%) saturate(${preset.saturation}%) blur(${preset.blur / 10}px) sepia(${preset.sepia}%) grayscale(${preset.grayscale}%) hue-rotate(${preset.hueRotate}deg)`,
                }}
              />
              <span className="text-[10px] font-medium truncate w-full text-center">
                {preset.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Manual controls */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Manual
        </p>

        <SliderControl
          label="Brightness"
          value={manualFilters.brightness}
          min={50}
          max={200}
          onChange={(v) => handleSliderChange("brightness", v)}
        />
        <SliderControl
          label="Contrast"
          value={manualFilters.contrast}
          min={50}
          max={200}
          onChange={(v) => handleSliderChange("contrast", v)}
        />
        <SliderControl
          label="Saturation"
          value={manualFilters.saturation}
          min={0}
          max={200}
          onChange={(v) => handleSliderChange("saturation", v)}
        />
        <SliderControl
          label="Blur"
          value={manualFilters.blur}
          min={0}
          max={100}
          onChange={(v) => handleSliderChange("blur", v)}
        />
        <SliderControl
          label="Hue Rotate"
          value={manualFilters.hueRotate}
          min={-180}
          max={180}
          onChange={(v) => handleSliderChange("hueRotate", v)}
        />
        <SliderControl
          label="Sepia"
          value={manualFilters.sepia}
          min={0}
          max={100}
          onChange={(v) => handleSliderChange("sepia", v)}
        />
        <SliderControl
          label="Grayscale"
          value={manualFilters.grayscale}
          min={0}
          max={100}
          onChange={(v) => handleSliderChange("grayscale", v)}
        />
      </div>
    </div>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground">{label}</Label>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {value}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}
