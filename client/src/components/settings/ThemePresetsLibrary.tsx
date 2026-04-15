"use client";

import { useState, useEffect } from "react";
import { Check, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const STYLE_ID = "signapps-preset-theme";
const STORAGE_KEY = "signapps-active-preset";

interface ThemePreset {
  id: string;
  name: string;
  description: string;
  preview: string[];
  css: string;
}

const PRESETS: ThemePreset[] = [
  {
    id: "pastel",
    name: "Pastel",
    description: "Tons doux et lumineux",
    preview: ["#f5c6e8", "#c6e8f5", "#e8f5c6", "#f5e8c6"],
    css: `:root {
  --background: oklch(0.99 0.015 320);
  --primary: oklch(0.58 0.18 320);
  --secondary: oklch(0.95 0.05 320);
  --accent: oklch(0.95 0.05 200);
  --border: oklch(0.88 0.03 320);
}`,
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Bleus profonds et teals",
    preview: ["#0ea5e9", "#06b6d4", "#0284c7", "#164e63"],
    css: `:root {
  --background: oklch(0.97 0.015 210);
  --primary: oklch(0.52 0.19 210);
  --secondary: oklch(0.94 0.04 210);
  --accent: oklch(0.94 0.04 190);
  --border: oklch(0.88 0.03 210);
}`,
  },
  {
    id: "forest",
    name: "Forest",
    description: "Verts naturels apaisants",
    preview: ["#16a34a", "#15803d", "#4ade80", "#dcfce7"],
    css: `:root {
  --background: oklch(0.97 0.015 140);
  --primary: oklch(0.5 0.17 140);
  --secondary: oklch(0.94 0.04 140);
  --accent: oklch(0.94 0.04 120);
  --border: oklch(0.88 0.03 140);
}`,
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Oranges et roses chaleureux",
    preview: ["#f97316", "#ec4899", "#fb923c", "#fde68a"],
    css: `:root {
  --background: oklch(0.99 0.01 50);
  --primary: oklch(0.62 0.22 40);
  --secondary: oklch(0.96 0.04 40);
  --accent: oklch(0.95 0.05 340);
  --border: oklch(0.88 0.03 40);
}`,
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Ultra sombre avec accents violets",
    preview: ["#1e1b4b", "#312e81", "#7c3aed", "#a78bfa"],
    css: `:root {
  --background: oklch(0.12 0.03 270);
  --foreground: oklch(0.95 0.01 270);
  --card: oklch(0.15 0.03 270);
  --card-foreground: oklch(0.95 0.01 270);
  --primary: oklch(0.65 0.22 270);
  --primary-foreground: oklch(0.1 0.01 270);
  --secondary: oklch(0.18 0.03 270);
  --secondary-foreground: oklch(0.9 0.01 270);
  --muted: oklch(0.2 0.02 270);
  --muted-foreground: oklch(0.6 0.02 270);
  --border: oklch(1 0 0 / 8%);
}`,
  },
  {
    id: "monochrome",
    name: "Monochrome",
    description: "Noir et blanc épuré",
    preview: ["#000000", "#404040", "#808080", "#ffffff"],
    css: `:root {
  --primary: oklch(0.2 0 0);
  --primary-foreground: oklch(0.98 0 0);
  --secondary: oklch(0.95 0 0);
  --accent: oklch(0.95 0 0);
  --ring: oklch(0.2 0 0 / 30%);
  --border: oklch(0.88 0 0);
}`,
  },
];

function applyPreset(preset: ThemePreset | null) {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = preset ? preset.css : "";
}

export function ThemePresetsLibrary() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setActive(stored);
      const preset = PRESETS.find((p) => p.id === stored);
      if (preset) applyPreset(preset);
    }
  }, []);

  const selectPreset = (preset: ThemePreset | null) => {
    if (preset === null) {
      localStorage.removeItem(STORAGE_KEY);
      setActive(null);
      applyPreset(null);
      toast.success("Thème par défaut restauré");
    } else {
      localStorage.setItem(STORAGE_KEY, preset.id);
      setActive(preset.id);
      applyPreset(preset);
      toast.success(`Thème "${preset.name}" appliqué`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Bibliothèque de thèmes
        </CardTitle>
        <CardDescription>
          Choisissez parmi des thèmes prédéfinis ou conservez le thème par
          défaut.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            onClick={() => selectPreset(null)}
            className={`relative p-3 rounded-xl border-2 text-left transition-all hover:shadow-md ${!active ? "border-primary" : "border-transparent hover:border-border"}`}
          >
            <div className="flex gap-1 mb-2">
              {["#6366f1", "#3b82f6", "#10b981", "#f97316"].map((c) => (
                <div
                  key={c}
                  className="flex-1 h-6 rounded"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <p className="text-sm font-medium">Par défaut</p>
            <p className="text-xs text-muted-foreground">Indigo moderne</p>
            {!active && (
              <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />
            )}
          </button>

          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => selectPreset(preset)}
              className={`relative p-3 rounded-xl border-2 text-left transition-all hover:shadow-md ${active === preset.id ? "border-primary" : "border-transparent hover:border-border"}`}
            >
              <div className="flex gap-1 mb-2">
                {preset.preview.map((c) => (
                  <div
                    key={c}
                    className="flex-1 h-6 rounded"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <p className="text-sm font-medium">{preset.name}</p>
              <p className="text-xs text-muted-foreground">
                {preset.description}
              </p>
              {active === preset.id && (
                <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
