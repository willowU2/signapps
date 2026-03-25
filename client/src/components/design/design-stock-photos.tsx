"use client";

import { useState, useCallback } from "react";
import { useDesignStore } from "@/stores/design-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ImagePlus, Loader2 } from "lucide-react";
import type { DesignObject } from "./types";

interface DesignStockPhotosProps {
  fabricCanvasRef: React.MutableRefObject<any | null>;
}

// Curated placeholder images using picsum.photos (free, no API key needed)
const PLACEHOLDER_IMAGES = [
  { id: "1", url: "https://picsum.photos/seed/design1/400/300", author: "Picsum" },
  { id: "2", url: "https://picsum.photos/seed/design2/400/300", author: "Picsum" },
  { id: "3", url: "https://picsum.photos/seed/design3/400/300", author: "Picsum" },
  { id: "4", url: "https://picsum.photos/seed/nature1/400/300", author: "Picsum" },
  { id: "5", url: "https://picsum.photos/seed/nature2/400/300", author: "Picsum" },
  { id: "6", url: "https://picsum.photos/seed/city1/400/300", author: "Picsum" },
  { id: "7", url: "https://picsum.photos/seed/city2/400/300", author: "Picsum" },
  { id: "8", url: "https://picsum.photos/seed/tech1/400/300", author: "Picsum" },
  { id: "9", url: "https://picsum.photos/seed/food1/400/300", author: "Picsum" },
  { id: "10", url: "https://picsum.photos/seed/abstract1/400/300", author: "Picsum" },
  { id: "11", url: "https://picsum.photos/seed/abstract2/400/300", author: "Picsum" },
  { id: "12", url: "https://picsum.photos/seed/people1/400/300", author: "Picsum" },
];

export default function DesignStockPhotos({ fabricCanvasRef }: DesignStockPhotosProps) {
  const { addObject, pushUndo, currentDesign } = useDesignStore();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const images = search
    ? PLACEHOLDER_IMAGES.map((img, i) => ({
        ...img,
        url: `https://picsum.photos/seed/${search.toLowerCase().replace(/\s/g, "")}${i}/400/300`,
      }))
    : PLACEHOLDER_IMAGES;

  const handleInsertImage = useCallback(async (imageUrl: string) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    setLoading(imageUrl);
    pushUndo();

    try {
      const fabricModule = await import("fabric");

      // Create a proxy image to avoid CORS issues
      const img = await fabricModule.FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" });

      // Scale to fit canvas
      const maxW = (currentDesign?.format.width || 1080) * 0.6;
      const maxH = (currentDesign?.format.height || 1080) * 0.6;
      const scale = Math.min(maxW / (img.width || 1), maxH / (img.height || 1), 1);

      img.set({
        scaleX: scale,
        scaleY: scale,
        left: 50,
        top: 50,
      });
      (img as any).id = crypto.randomUUID();
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();

      const newObj: DesignObject = {
        id: (img as any).id,
        type: "image",
        name: "Stock Photo",
        fabricData: img.toObject(["id"]),
        locked: false,
        visible: true,
      };
      addObject(newObj);
    } catch (err) {
      console.error("Failed to insert stock photo:", err);
    } finally {
      setLoading(null);
    }
  }, [fabricCanvasRef, addObject, pushUndo, currentDesign]);

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Photos</p>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search photos..."
          className="h-8 text-xs pl-8"
        />
      </div>

      {/* Upload own */}
      <Button
        variant="outline"
        size="sm"
        className="w-full h-8 text-xs gap-1.5"
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              handleInsertImage(ev.target?.result as string);
            };
            reader.readAsDataURL(file);
          };
          input.click();
        }}
      >
        <ImagePlus className="h-3.5 w-3.5" />
        Upload Your Own
      </Button>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {images.map((img) => (
          <button
            key={img.id}
            onClick={() => handleInsertImage(img.url)}
            disabled={loading === img.url}
            className="relative rounded-md overflow-hidden border border-border hover:border-primary/50 transition-all group aspect-[4/3]"
          >
            <img
              src={img.url}
              alt={`Stock photo ${img.id}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            {loading === img.url && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ImagePlus className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
          </button>
        ))}
      </div>

      <p className="text-[10px] text-center text-muted-foreground">
        Images from Picsum Photos (free, no attribution required)
      </p>
    </div>
  );
}
