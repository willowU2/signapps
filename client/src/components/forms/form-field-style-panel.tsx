"use client";

/**
 * Per-field style editor — appears inline in the builder below the field edit
 * panel. Lets users customize fontSize, alignment, colors, borders, width,
 * shadow, accent (for checkboxes/radios) per field.
 */

import type { FormField, FormFieldStyle } from "@/lib/api/forms";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Paintbrush,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

interface FormFieldStylePanelProps {
  field: FormField;
  onChange: (patch: Partial<FormField>) => void;
}

function setStyle(
  field: FormField,
  patch: Partial<FormFieldStyle>,
): Partial<FormField> {
  return { style: { ...(field.style || {}), ...patch } };
}

export function FormFieldStylePanel({
  field,
  onChange,
}: FormFieldStylePanelProps) {
  const [open, setOpen] = useState(false);
  const s = field.style || {};

  return (
    <div className="rounded-md border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <Paintbrush className="w-3 h-3" />
        Style
      </button>
      {open && (
        <div className="p-3 pt-0 space-y-3">
          {/* Alignment + Width */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px]">Alignement</Label>
              <div className="flex gap-1">
                {[
                  { v: "left", Icon: AlignLeft },
                  { v: "center", Icon: AlignCenter },
                  { v: "right", Icon: AlignRight },
                ].map(({ v, Icon }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() =>
                      onChange(
                        setStyle(field, {
                          textAlign: v as "left" | "center" | "right",
                        }),
                      )
                    }
                    className={cn(
                      "flex-1 h-7 flex items-center justify-center rounded border transition-colors",
                      s.textAlign === v
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Largeur</Label>
              <Select
                value={s.width || "full"}
                onValueChange={(v) =>
                  onChange(
                    setStyle(field, {
                      width: v as "full" | "half" | "third" | "quarter",
                    }),
                  )
                }
              >
                <SelectTrigger className="h-7 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full" className="text-xs">
                    100%
                  </SelectItem>
                  <SelectItem value="half" className="text-xs">
                    50%
                  </SelectItem>
                  <SelectItem value="third" className="text-xs">
                    33%
                  </SelectItem>
                  <SelectItem value="quarter" className="text-xs">
                    25%
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Font */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <Label className="text-[10px]">Taille de police</Label>
              <span className="text-[10px] tabular-nums">
                {s.fontSize ?? 14}px
              </span>
            </div>
            <Slider
              value={[s.fontSize ?? 14]}
              min={10}
              max={32}
              step={1}
              onValueChange={([v]) =>
                onChange(setStyle(field, { fontSize: v }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Graisse</Label>
            <Select
              value={s.fontWeight || "normal"}
              onValueChange={(v) =>
                onChange(
                  setStyle(field, {
                    fontWeight: v as "normal" | "medium" | "semibold" | "bold",
                  }),
                )
              }
            >
              <SelectTrigger className="h-7 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal" className="text-xs">
                  Normal
                </SelectItem>
                <SelectItem value="medium" className="text-xs">
                  Medium
                </SelectItem>
                <SelectItem value="semibold" className="text-xs">
                  Semibold
                </SelectItem>
                <SelectItem value="bold" className="text-xs">
                  Bold
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Texte</Label>
              <input
                type="color"
                value={s.textColor || "#111827"}
                onChange={(e) =>
                  onChange(setStyle(field, { textColor: e.target.value }))
                }
                className="h-7 w-full rounded border cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Fond</Label>
              <input
                type="color"
                value={s.backgroundColor || "#ffffff"}
                onChange={(e) =>
                  onChange(setStyle(field, { backgroundColor: e.target.value }))
                }
                className="h-7 w-full rounded border cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Accent</Label>
              <input
                type="color"
                value={s.accentColor || "#4f46e5"}
                onChange={(e) =>
                  onChange(setStyle(field, { accentColor: e.target.value }))
                }
                className="h-7 w-full rounded border cursor-pointer"
              />
            </div>
          </div>

          {/* Border */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-[10px]">Bordure</Label>
                <span className="text-[10px] tabular-nums">
                  {s.borderWidth ?? 1}px
                </span>
              </div>
              <Slider
                value={[s.borderWidth ?? 1]}
                min={0}
                max={8}
                step={1}
                onValueChange={([v]) =>
                  onChange(setStyle(field, { borderWidth: v }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Couleur bordure</Label>
              <input
                type="color"
                value={s.borderColor || "#e5e7eb"}
                onChange={(e) =>
                  onChange(setStyle(field, { borderColor: e.target.value }))
                }
                className="h-7 w-full rounded border cursor-pointer"
              />
            </div>
          </div>

          {/* Radius + Padding */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-[10px]">Arrondi</Label>
                <span className="text-[10px] tabular-nums">
                  {s.borderRadius ?? 6}px
                </span>
              </div>
              <Slider
                value={[s.borderRadius ?? 6]}
                min={0}
                max={32}
                step={1}
                onValueChange={([v]) =>
                  onChange(setStyle(field, { borderRadius: v }))
                }
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-[10px]">Padding</Label>
                <span className="text-[10px] tabular-nums">
                  {s.padding ?? 8}px
                </span>
              </div>
              <Slider
                value={[s.padding ?? 8]}
                min={0}
                max={32}
                step={1}
                onValueChange={([v]) =>
                  onChange(setStyle(field, { padding: v }))
                }
              />
            </div>
          </div>

          {/* Shadow */}
          <div className="space-y-1">
            <Label className="text-[10px]">Ombre</Label>
            <div className="flex gap-1">
              {["none", "sm", "md", "lg"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    onChange(
                      setStyle(field, {
                        shadow: v as "none" | "sm" | "md" | "lg",
                      }),
                    )
                  }
                  className={cn(
                    "flex-1 h-7 text-[10px] rounded border transition-colors uppercase",
                    (s.shadow || "none") === v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Reset */}
          <button
            type="button"
            onClick={() => onChange({ style: undefined })}
            className="w-full text-[10px] text-muted-foreground hover:text-foreground py-1"
          >
            Réinitialiser le style
          </button>
        </div>
      )}
    </div>
  );
}
