"use client";

import { useState } from "react";
import { useDesignStore } from "@/stores/design-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Palette, Upload } from "lucide-react";
import type { BrandKit, BrandColor } from "./types";
import { FONT_FAMILIES } from "./types";

export default function DesignBrandKit() {
  const { brandKit, setBrandKit } = useDesignStore();
  const [editing, setEditing] = useState(false);

  const kit: BrandKit = brandKit || {
    id: crypto.randomUUID(),
    name: "My Brand",
    colors: [
      { id: "1", name: "Primary", value: "#4f46e5" },
      { id: "2", name: "Secondary", value: "#059669" },
      { id: "3", name: "Accent", value: "#d97706" },
    ],
    logos: [],
    headingFont: "Inter",
    bodyFont: "Inter",
  };

  const updateKit = (updates: Partial<BrandKit>) => {
    const updated = { ...kit, ...updates };
    setBrandKit(updated);
  };

  const addColor = () => {
    updateKit({
      colors: [...kit.colors, { id: crypto.randomUUID(), name: "New Color", value: "#000000" }],
    });
  };

  const updateColor = (id: string, updates: Partial<BrandColor>) => {
    updateKit({
      colors: kit.colors.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    });
  };

  const removeColor = (id: string) => {
    updateKit({ colors: kit.colors.filter((c) => c.id !== id) });
  };

  return (
    <div className="space-y-4">
      {/* Brand Name */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Brand Name</Label>
        <Input
          value={kit.name}
          onChange={(e) => updateKit({ name: e.target.value })}
          className="h-8 text-xs"
          placeholder="My Brand"
        />
      </div>

      <Separator />

      {/* Brand Colors */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Brand Colors</Label>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addColor}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="space-y-1.5">
          {kit.colors.map((color) => (
            <div key={color.id} className="flex items-center gap-2">
              <input
                type="color"
                value={color.value}
                onChange={(e) => updateColor(color.id, { value: e.target.value })}
                className="h-7 w-7 rounded border cursor-pointer shrink-0"
              />
              <Input
                value={color.name}
                onChange={(e) => updateColor(color.id, { name: e.target.value })}
                className="h-7 text-xs flex-1"
                placeholder="Color name"
              />
              <span className="text-[10px] text-muted-foreground w-16 shrink-0 font-mono">
                {color.value}
              </span>
              <button
                onClick={() => removeColor(color.id)}
                className="p-1 rounded hover:bg-destructive/10 shrink-0"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
          ))}
        </div>

        {/* Quick color palette display */}
        <div className="flex gap-1 pt-1">
          {kit.colors.map((c) => (
            <div
              key={c.id}
              className="w-6 h-6 rounded-md border shadow-sm cursor-pointer hover:scale-110 transition-transform"
              style={{ backgroundColor: c.value }}
              title={`${c.name}: ${c.value}`}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Fonts */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Brand Fonts</Label>
        <div className="space-y-1.5">
          <div>
            <Label className="text-[10px] text-muted-foreground">Heading Font</Label>
            <select
              value={kit.headingFont}
              onChange={(e) => updateKit({ headingFont: e.target.value })}
              className="w-full h-7 text-xs rounded border bg-background px-2"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Body Font</Label>
            <select
              value={kit.bodyFont}
              onChange={(e) => updateKit({ bodyFont: e.target.value })}
              className="w-full h-7 text-xs rounded border bg-background px-2"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Font preview */}
        <div className="bg-muted/30 rounded-lg p-3 space-y-1">
          <p className="text-sm font-bold" style={{ fontFamily: kit.headingFont }}>
            Heading Preview
          </p>
          <p className="text-xs" style={{ fontFamily: kit.bodyFont }}>
            Body text preview with your brand font.
          </p>
        </div>
      </div>

      <Separator />

      {/* Logos */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Logos</Label>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          Upload Logo
        </Button>
        {kit.logos.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-2">No logos uploaded yet</p>
        )}
      </div>
    </div>
  );
}
