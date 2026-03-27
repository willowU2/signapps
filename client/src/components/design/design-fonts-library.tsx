"use client";

// IDEA-063: Google Fonts library — self-hosted font picker with preview, load on canvas

import { useState, useCallback, useEffect } from "react";
import { Type, Search, Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FontItem {
  family: string;
  category: string;
  variants: string[];
  loaded: boolean;
}

interface DesignFontsLibraryProps {
  fabricCanvasRef: React.MutableRefObject<any | null>;
}

// Curated list of popular Google Fonts (self-hosted via Google Fonts CDN)
const FONT_CATALOG: FontItem[] = [
  { family: "Inter", category: "sans-serif", variants: ["regular", "700"], loaded: false },
  { family: "Roboto", category: "sans-serif", variants: ["regular", "700"], loaded: false },
  { family: "Open Sans", category: "sans-serif", variants: ["regular", "700"], loaded: false },
  { family: "Lato", category: "sans-serif", variants: ["regular", "700"], loaded: false },
  { family: "Poppins", category: "sans-serif", variants: ["regular", "600", "700"], loaded: false },
  { family: "Montserrat", category: "sans-serif", variants: ["regular", "700"], loaded: false },
  { family: "Raleway", category: "sans-serif", variants: ["regular", "700"], loaded: false },
  { family: "Nunito", category: "sans-serif", variants: ["regular", "700"], loaded: false },
  { family: "Playfair Display", category: "serif", variants: ["regular", "700"], loaded: false },
  { family: "Merriweather", category: "serif", variants: ["regular", "700"], loaded: false },
  { family: "Lora", category: "serif", variants: ["regular", "700"], loaded: false },
  { family: "Source Serif 4", category: "serif", variants: ["regular", "700"], loaded: false },
  { family: "Crimson Text", category: "serif", variants: ["regular", "700"], loaded: false },
  { family: "Fira Code", category: "monospace", variants: ["regular", "700"], loaded: false },
  { family: "JetBrains Mono", category: "monospace", variants: ["regular", "700"], loaded: false },
  { family: "Space Mono", category: "monospace", variants: ["regular", "700"], loaded: false },
  { family: "Dancing Script", category: "handwriting", variants: ["regular", "700"], loaded: false },
  { family: "Pacifico", category: "display", variants: ["regular"], loaded: false },
  { family: "Righteous", category: "display", variants: ["regular"], loaded: false },
  { family: "Oswald", category: "sans-serif", variants: ["regular", "700"], loaded: false },
  { family: "PT Sans", category: "sans-serif", variants: ["regular", "700"], loaded: false },
  { family: "Ubuntu", category: "sans-serif", variants: ["regular", "700"], loaded: false },
  { family: "Work Sans", category: "sans-serif", variants: ["regular", "700"], loaded: false },
  { family: "Josefin Sans", category: "sans-serif", variants: ["regular", "700"], loaded: false },
  { family: "Quicksand", category: "sans-serif", variants: ["regular", "700"], loaded: false },
];

const CATEGORIES = ["all", "sans-serif", "serif", "monospace", "display", "handwriting"];

async function loadGoogleFont(family: string): Promise<boolean> {
  const encoded = family.replace(/ /g, "+");
  const url = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;700&display=swap`;
  const existing = document.querySelector(`link[data-font="${family}"]`);
  if (existing) return true;
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.dataset.font = family;
    link.onload = () => resolve(true);
    link.onerror = () => resolve(false);
    document.head.appendChild(link);
  });
}

export default function DesignFontsLibrary({ fabricCanvasRef }: DesignFontsLibraryProps) {
  const [fonts, setFonts] = useState<FontItem[]>(FONT_CATALOG);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState<string | null>(null);
  const [appliedFont, setAppliedFont] = useState<string | null>(null);

  const filtered = fonts.filter((f) => {
    const matchesSearch = f.family.toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === "all" || f.category === category;
    return matchesSearch && matchesCat;
  });

  const handleApply = useCallback(async (font: FontItem) => {
    setLoading(font.family);
    try {
      const ok = await loadGoogleFont(font.family);
      if (!ok) {
        toast.error(`Could not load font ${font.family}`);
        return;
      }

      // Mark as loaded
      setFonts((prev) => prev.map((f) => f.family === font.family ? { ...f, loaded: true } : f));

      // Apply to selected canvas object
      const canvas = fabricCanvasRef.current;
      if (canvas) {
        const obj = canvas.getActiveObject();
        if (obj && (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text")) {
          obj.set("fontFamily", font.family);
          obj.setCoords();
          canvas.requestRenderAll();
          toast.success(`Font "${font.family}" applied`);
        } else {
          toast.info(`Font "${font.family}" loaded — select a text object to apply`);
        }
      }

      setAppliedFont(font.family);
    } finally {
      setLoading(null);
    }
  }, [fabricCanvasRef]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b space-y-2">
        <div className="flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fonts Library</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fonts…"
            className="h-7 text-xs pl-7"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap capitalize transition-all shrink-0",
                category === cat
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-muted-foreground/40"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">No fonts found</div>
        ) : (
          filtered.map((font) => (
            <div
              key={font.family}
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm truncate"
                  style={{ fontFamily: font.loaded ? font.family : "inherit" }}
                >
                  {font.family}
                </p>
                <p className="text-[10px] text-muted-foreground capitalize">{font.category}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {font.loaded && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-green-600 border-green-300">
                    Loaded
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant={appliedFont === font.family ? "default" : "outline"}
                  className="h-6 text-[10px] px-2"
                  onClick={() => handleApply(font)}
                  disabled={loading === font.family}
                >
                  {loading === font.family ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : appliedFont === font.family ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    "Use"
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
