"use client";

// IDEA-274: Digital stamp/seal on documents — add company stamp image

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  Stamp,
  Plus,
  Trash2,
  Image,
  RotateCw,
  Move,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StampConfig {
  id: string;
  name: string;
  image_url: string;
  width: number; // % of page width
  opacity: number; // 0–100
  position_x: number; // % from left
  position_y: number; // % from top
  rotation: number; // degrees
  pages: "all" | "first" | "last" | "custom";
  custom_pages?: string; // e.g. "1,3,5"
}

interface SavedStamp {
  id: string;
  name: string;
  image_url: string;
}

export function DigitalStampConfig() {
  const [savedStamps, setSavedStamps] = useState<SavedStamp[]>([]);
  const [config, setConfig] = useState<Omit<StampConfig, "id">>({
    name: "Company Seal",
    image_url: "",
    width: 20,
    opacity: 80,
    position_x: 50,
    position_y: 85,
    rotation: -15,
    pages: "all",
  });
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "stamp");
      const res = await fetch("/api/docs/stamps/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      setConfig((p) => ({ ...p, image_url: url }));
      toast.success("Image du tampon téléversée");
    } catch {
      toast.error("Échec du téléversement");
    } finally {
      setUploading(false);
    }
  }, []);

  async function saveStamp() {
    if (!config.image_url) {
      toast.error("Téléversez d'abord une image de tampon");
      return;
    }
    try {
      const res = await fetch("/api/docs/stamps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const saved = await res.json();
      setSavedStamps((prev) => [...prev, saved]);
      toast.success("Tampon enregistré");
    } catch {
      toast.error("Impossible d'enregistrer stamp");
    }
  }

  async function applyToDocument(documentId: string) {
    if (!config.image_url) {
      toast.error("Configurez le tampon d'abord");
      return;
    }
    setApplying(true);
    try {
      await fetch(`/api/docs/${documentId}/stamp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      toast.success("Tampon appliqué to document");
    } catch {
      toast.error("Impossible d'appliquer le tampon");
    } finally {
      setApplying(false);
    }
  }

  function update<K extends keyof typeof config>(
    key: K,
    value: (typeof config)[K],
  ) {
    setConfig((p) => ({ ...p, [key]: value }));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Stamp className="h-4 w-4" /> Digital Stamp / Seal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stamp image upload */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30",
            config.image_url && "border-primary/40",
          )}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageUpload(f);
            }}
          />
          {config.image_url ? (
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={config.image_url}
                alt="stamp"
                className="h-16 object-contain"
              />
              <p className="text-xs text-muted-foreground">Click to change</p>
            </div>
          ) : (
            <>
              <Image className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Upload PNG/SVG stamp image
              </p>
            </>
          )}
        </div>

        {uploading && (
          <p className="text-xs text-muted-foreground">Uploading…</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Size */}
          <div className="space-y-1.5">
            <Label className="text-xs">Size ({config.width}% width)</Label>
            <Slider
              min={5}
              max={50}
              step={1}
              value={[config.width]}
              onValueChange={([v]) => update("width", v)}
            />
          </div>
          {/* Opacity */}
          <div className="space-y-1.5">
            <Label className="text-xs">Opacity ({config.opacity}%)</Label>
            <Slider
              min={10}
              max={100}
              step={5}
              value={[config.opacity]}
              onValueChange={([v]) => update("opacity", v)}
            />
          </div>
          {/* Position X */}
          <div className="space-y-1.5">
            <Label className="text-xs">Position X ({config.position_x}%)</Label>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[config.position_x]}
              onValueChange={([v]) => update("position_x", v)}
            />
          </div>
          {/* Position Y */}
          <div className="space-y-1.5">
            <Label className="text-xs">Position Y ({config.position_y}%)</Label>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[config.position_y]}
              onValueChange={([v]) => update("position_y", v)}
            />
          </div>
          {/* Rotation */}
          <div className="space-y-1.5">
            <Label className="text-xs">Rotation ({config.rotation}°)</Label>
            <Slider
              min={-45}
              max={45}
              step={5}
              value={[config.rotation]}
              onValueChange={([v]) => update("rotation", v)}
            />
          </div>
          {/* Pages */}
          <div className="space-y-1.5">
            <Label className="text-xs">Apply to pages</Label>
            <Select
              value={config.pages}
              onValueChange={(v) => update("pages", v as StampConfig["pages"])}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pages</SelectItem>
                <SelectItem value="first">First page only</SelectItem>
                <SelectItem value="last">Last page only</SelectItem>
                <SelectItem value="custom">Custom pages</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {config.pages === "custom" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Page numbers (e.g. 1,3,5)</Label>
            <Input
              value={config.custom_pages ?? ""}
              onChange={(e) => update("custom_pages", e.target.value)}
              placeholder="1,3,5"
              className="h-7 text-xs"
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={saveStamp} className="flex-1">
            Save Stamp
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
