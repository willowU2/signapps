"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Type,
  ImagePlus,
  Palette,
  Download,
  Trash2,
  Move,
  Bold,
  AlignCenter,
  PenLine,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  align: CanvasTextAlign;
}

type Template = {
  label: string;
  width: number;
  height: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEMPLATES: Record<string, Template> = {
  instagram_square: {
    label: "Instagram Square (1080×1080)",
    width: 1080,
    height: 1080,
  },
  instagram_story: {
    label: "Instagram Story (1080×1920)",
    width: 1080,
    height: 1920,
  },
  twitter_banner: {
    label: "Twitter Banner (1500×500)",
    width: 1500,
    height: 500,
  },
};

const FONT_FAMILIES = [
  "Arial",
  "Georgia",
  "Impact",
  "Verdana",
  "Trebuchet MS",
  "Times New Roman",
];

const PRESET_GRADIENTS = [
  { label: "Sunset", value: "linear-gradient(135deg, #f97316, #ec4899)" },
  { label: "Ocean", value: "linear-gradient(135deg, #0ea5e9, #6366f1)" },
  { label: "Forest", value: "linear-gradient(135deg, #22c55e, #06b6d4)" },
  { label: "Night", value: "linear-gradient(135deg, #1e1b4b, #4c1d95)" },
];

// Display canvas size (scaled down from template size for editing)
const DISPLAY_MAX_WIDTH = 480;
const DISPLAY_MAX_HEIGHT = 420;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcDisplaySize(tpl: Template): {
  w: number;
  h: number;
  scale: number;
} {
  const scaleW = DISPLAY_MAX_WIDTH / tpl.width;
  const scaleH = DISPLAY_MAX_HEIGHT / tpl.height;
  const scale = Math.min(scaleW, scaleH, 1);
  return {
    w: Math.round(tpl.width * scale),
    h: Math.round(tpl.height * scale),
    scale,
  };
}

function uniqueId(): string {
  return `layer_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ImageEditor({
  onExport,
}: {
  onExport?: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [templateKey, setTemplateKey] = useState("instagram_square");
  const template = TEMPLATES[templateKey];
  const { w: displayW, h: displayH, scale } = calcDisplaySize(template);

  // Background
  const [bgColor, setBgColor] = useState("#1e293b");
  const [bgGradient, setBgGradient] = useState("");
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  // Text layers
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? null;

  // New text input
  const [newText, setNewText] = useState("Your text here");
  const [newFontSize, setNewFontSize] = useState(72);
  const [newFontFamily, setNewFontFamily] = useState("Arial");
  const [newColor, setNewColor] = useState("#ffffff");
  const [newBold, setNewBold] = useState(false);

  // Drag state
  const dragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // ---------------------------------------------------------------------------
  // Draw
  // ---------------------------------------------------------------------------

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = displayW;
    canvas.height = displayH;

    // Background
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, displayW, displayH);
    } else if (bgGradient) {
      // Parse simple linear-gradient for canvas
      const stops = bgGradient.includes("135deg")
        ? (() => {
            const colors = bgGradient.match(/#[0-9a-fA-F]{6}/g) ?? [
              "#000",
              "#fff",
            ];
            const grad = ctx.createLinearGradient(0, 0, displayW, displayH);
            grad.addColorStop(0, colors[0]);
            grad.addColorStop(1, colors[1] ?? colors[0]);
            return grad;
          })()
        : null;
      if (stops) {
        ctx.fillStyle = stops;
      } else {
        ctx.fillStyle = bgColor;
      }
      ctx.fillRect(0, 0, displayW, displayH);
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, displayW, displayH);
    }

    // Text layers (scaled for display)
    for (const layer of layers) {
      const fs = Math.round(layer.fontSize * scale);
      ctx.font = `${layer.bold ? "bold " : ""}${fs}px ${layer.fontFamily}`;
      ctx.fillStyle = layer.color;
      ctx.textAlign = layer.align;
      ctx.textBaseline = "top";
      ctx.fillText(layer.text, layer.x * scale, layer.y * scale);

      // Selection indicator
      if (layer.id === selectedLayerId) {
        const metrics = ctx.measureText(layer.text);
        ctx.strokeStyle = "#60a5fa";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          layer.x * scale - 2,
          layer.y * scale - 2,
          metrics.width + 4,
          fs + 4,
        );
      }
    }
  }, [
    bgColor,
    bgGradient,
    bgImage,
    layers,
    selectedLayerId,
    displayW,
    displayH,
    scale,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  // ---------------------------------------------------------------------------
  // Interactions
  // ---------------------------------------------------------------------------

  function addTextLayer() {
    const layer: TextLayer = {
      id: uniqueId(),
      text: newText || "Text",
      x: Math.round(template.width / 2 / scale / scale), // center approx
      y: Math.round(template.height / 4 / scale / scale),
      fontSize: newFontSize,
      fontFamily: newFontFamily,
      color: newColor,
      bold: newBold,
      align: "center",
    };
    setLayers((prev) => [...prev, layer]);
    setSelectedLayerId(layer.id);
  }

  function updateSelectedLayer(updates: Partial<TextLayer>) {
    if (!selectedLayerId) return;
    setLayers((prev) =>
      prev.map((l) => (l.id === selectedLayerId ? { ...l, ...updates } : l)),
    );
  }

  function deleteSelectedLayer() {
    if (!selectedLayerId) return;
    setLayers((prev) => prev.filter((l) => l.id !== selectedLayerId));
    setSelectedLayerId(null);
  }

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Hit-test layers in reverse (top-most first)
      for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        const ctx = canvas.getContext("2d")!;
        const fs = Math.round(layer.fontSize * scale);
        ctx.font = `${layer.bold ? "bold " : ""}${fs}px ${layer.fontFamily}`;
        const w = ctx.measureText(layer.text).width;
        const lx = layer.x * scale;
        const ly = layer.y * scale;

        if (
          mx >= lx - 2 &&
          mx <= lx + w + 4 &&
          my >= ly - 2 &&
          my <= ly + fs + 4
        ) {
          setSelectedLayerId(layer.id);
          dragRef.current = {
            id: layer.id,
            offsetX: mx - lx,
            offsetY: my - ly,
          };
          return;
        }
      }
      setSelectedLayerId(null);
    },
    [layers, scale],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!dragRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const newX = Math.round((mx - dragRef.current.offsetX) / scale);
      const newY = Math.round((my - dragRef.current.offsetY) / scale);
      const id = dragRef.current.id;
      setLayers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, x: newX, y: newY } : l)),
      );
    },
    [scale],
  );

  const handleCanvasMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ---------------------------------------------------------------------------
  // Background image upload
  // ---------------------------------------------------------------------------

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setBgImage(img);
      setBgGradient("");
    };
    img.src = url;
  };

  // ---------------------------------------------------------------------------
  // Export — renders at full template resolution
  // ---------------------------------------------------------------------------

  const handleExportPng = () => {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = template.width;
    exportCanvas.height = template.height;
    const ctx = exportCanvas.getContext("2d")!;

    // Background
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, template.width, template.height);
    } else if (bgGradient) {
      const colors = bgGradient.match(/#[0-9a-fA-F]{6}/g) ?? ["#000", "#fff"];
      const grad = ctx.createLinearGradient(
        0,
        0,
        template.width,
        template.height,
      );
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(1, colors[1] ?? colors[0]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, template.width, template.height);
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, template.width, template.height);
    }

    // Text layers at full resolution
    for (const layer of layers) {
      ctx.font = `${layer.bold ? "bold " : ""}${layer.fontSize}px ${layer.fontFamily}`;
      ctx.fillStyle = layer.color;
      ctx.textAlign = layer.align;
      ctx.textBaseline = "top";
      ctx.fillText(layer.text, layer.x, layer.y);
    }

    const dataUrl = exportCanvas.toDataURL("image/png");
    onExport?.(dataUrl);

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `signapps-design-${templateKey}.png`;
    a.click();
    toast.success("Image exported as PNG");
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <PenLine className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Image Editor</h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">
        {/* Canvas */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Template</Label>
            <Select value={templateKey} onValueChange={setTemplateKey}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TEMPLATES).map(([key, tpl]) => (
                  <SelectItem key={key} value={key}>
                    {tpl.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div
            className="border rounded-lg overflow-hidden bg-muted/20 flex items-center justify-center"
            style={{ minHeight: displayH + 4 }}
          >
            <canvas
              ref={canvasRef}
              width={displayW}
              height={displayH}
              className="cursor-crosshair"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            />
          </div>

          <Button className="w-full" onClick={handleExportPng}>
            <Download className="h-4 w-4 mr-2" />
            Export as PNG
          </Button>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Background */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-1">
                <Palette className="h-3.5 w-3.5" />
                Background
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Solid color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => {
                      setBgColor(e.target.value);
                      setBgGradient("");
                      setBgImage(null);
                    }}
                    className="h-8 w-10 rounded cursor-pointer border"
                  />
                  <Input
                    value={bgColor}
                    onChange={(e) => {
                      setBgColor(e.target.value);
                      setBgGradient("");
                      setBgImage(null);
                    }}
                    className="text-xs flex-1"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Gradient presets</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_GRADIENTS.map((g) => (
                    <button
                      key={g.label}
                      title={g.label}
                      className={`h-8 w-16 rounded text-xs font-medium text-white ${bgGradient === g.value ? "ring-2 ring-primary" : ""}`}
                      style={{ background: g.value }}
                      onClick={() => {
                        setBgGradient(g.value);
                        setBgImage(null);
                      }}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Upload image</Label>
                <label className="flex items-center gap-2 cursor-pointer border rounded px-3 py-2 text-xs hover:bg-muted/50">
                  <ImagePlus className="h-3.5 w-3.5" />
                  Choose file
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBgUpload}
                  />
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Add text */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-1">
                <Type className="h-3.5 w-3.5" />
                Add Text
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Text content"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                className="text-sm"
              />

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Font</Label>
                  <Select
                    value={newFontFamily}
                    onValueChange={setNewFontFamily}
                  >
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_FAMILIES.map((f) => (
                        <SelectItem key={f} value={f} style={{ fontFamily: f }}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Color</Label>
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="h-8 w-full rounded cursor-pointer border"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Size: {newFontSize}px</Label>
                <Slider
                  min={12}
                  max={200}
                  step={4}
                  value={[newFontSize]}
                  onValueChange={([v]) => setNewFontSize(v)}
                />
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={newBold}
                  onChange={(e) => setNewBold(e.target.checked)}
                  className="rounded"
                />
                <Bold className="h-3.5 w-3.5" />
                Bold
              </label>

              <Button size="sm" className="w-full" onClick={addTextLayer}>
                <Type className="h-3.5 w-3.5 mr-1" />
                Add Text Layer
              </Button>
            </CardContent>
          </Card>

          {/* Selected layer controls */}
          {selectedLayer && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Move className="h-3.5 w-3.5" />
                    Edit Layer
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-destructive"
                    onClick={deleteSelectedLayer}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={selectedLayer.text}
                  onChange={(e) =>
                    updateSelectedLayer({ text: e.target.value })
                  }
                  className="text-sm"
                />

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Color</Label>
                    <input
                      type="color"
                      value={selectedLayer.color}
                      onChange={(e) =>
                        updateSelectedLayer({ color: e.target.value })
                      }
                      className="h-8 w-full rounded cursor-pointer border"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Font</Label>
                    <Select
                      value={selectedLayer.fontFamily}
                      onValueChange={(v) =>
                        updateSelectedLayer({ fontFamily: v })
                      }
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_FAMILIES.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">
                    Size: {selectedLayer.fontSize}px
                  </Label>
                  <Slider
                    min={12}
                    max={200}
                    step={4}
                    value={[selectedLayer.fontSize]}
                    onValueChange={([v]) =>
                      updateSelectedLayer({ fontSize: v })
                    }
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={selectedLayer.bold ? "default" : "outline"}
                    onClick={() =>
                      updateSelectedLayer({ bold: !selectedLayer.bold })
                    }
                    className="flex-1"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  {(["left", "center", "right"] as CanvasTextAlign[]).map(
                    (a) => (
                      <Button
                        key={a}
                        size="sm"
                        variant={
                          selectedLayer.align === a ? "default" : "outline"
                        }
                        onClick={() => updateSelectedLayer({ align: a })}
                        className="flex-1 capitalize"
                      >
                        <AlignCenter className="h-3.5 w-3.5" />
                      </Button>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Layers list */}
          {layers.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Layers ({layers.length})</Label>
              {layers.map((layer, i) => (
                <button
                  key={layer.id}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded border truncate ${
                    layer.id === selectedLayerId
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedLayerId(layer.id)}
                >
                  {i + 1}. {layer.text}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
