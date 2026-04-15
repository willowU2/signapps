"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ImageIcon,
  Loader2,
  Download,
  Sparkles,
  ChevronDown,
  Upload,
  Eraser,
  ArrowUpFromLine,
  Maximize2,
  Dice5,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useAiImageGen } from "@/hooks/use-ai-image-gen";

// ─── Presets ─────────────────────────────────────────────────────────────────

const SIZE_PRESETS = [
  { label: "512x512", w: 512, h: 512 },
  { label: "768x768", w: 768, h: 768 },
  { label: "1024x1024", w: 1024, h: 1024 },
  { label: "1024x1792", w: 1024, h: 1792 },
  { label: "1792x1024", w: 1792, h: 1024 },
] as const;

const STYLES = [
  { id: "photorealistic", label: "Photoréaliste" },
  { id: "anime", label: "Anime" },
  { id: "sketch", label: "Croquis" },
  { id: "digital-art", label: "Art numérique" },
  { id: "oil-painting", label: "Peinture à l'huile" },
] as const;

const UPSCALE_OPTIONS = [2, 4] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function FileDropZone({
  accept,
  label,
  file,
  onFile,
}: {
  accept: string;
  label: string;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
        ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center justify-center gap-2 text-sm">
          <ImageIcon className="h-4 w-4 text-primary" />
          <span className="truncate max-w-[200px]">{file.name}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onFile(null);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ImageGenPanel() {
  const {
    generating,
    result,
    error,
    models,
    generate,
    inpaint,
    img2img,
    upscale,
    fetchModels,
    reset,
  } = useAiImageGen();

  // --- Generate tab state ---
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [negativeOpen, setNegativeOpen] = useState(false);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [steps, setSteps] = useState(20);
  const [guidance, setGuidance] = useState(7.5);
  const [seed, setSeed] = useState("");
  const [style, setStyle] = useState("photorealistic");
  const [model, setModel] = useState("");

  // --- Inpaint tab state ---
  const [inpaintImage, setInpaintImage] = useState<File | null>(null);
  const [inpaintMask, setInpaintMask] = useState<File | null>(null);
  const [inpaintPrompt, setInpaintPrompt] = useState("");

  // --- Img2Img tab state ---
  const [i2iImage, setI2iImage] = useState<File | null>(null);
  const [i2iPrompt, setI2iPrompt] = useState("");
  const [i2iStrength, setI2iStrength] = useState(0.75);

  // --- Upscale tab state ---
  const [upscaleImage, setUpscaleImage] = useState<File | null>(null);
  const [upscaleScale, setUpscaleScale] = useState<number>(2);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // --- Handlers ---

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) {
      toast.error("Veuillez saisir un prompt");
      return;
    }
    generate({
      prompt: prompt.trim(),
      negative_prompt: negativePrompt.trim() || undefined,
      width,
      height,
      num_steps: steps,
      guidance_scale: guidance,
      seed: seed ? Number(seed) : undefined,
      model: model || undefined,
      style,
    });
  }, [
    prompt,
    negativePrompt,
    width,
    height,
    steps,
    guidance,
    seed,
    model,
    style,
    generate,
  ]);

  const handleInpaint = useCallback(() => {
    if (!inpaintImage || !inpaintMask) {
      toast.error("Veuillez fournir une image et un masque");
      return;
    }
    if (!inpaintPrompt.trim()) {
      toast.error("Veuillez saisir un prompt");
      return;
    }
    inpaint(inpaintImage, inpaintMask, inpaintPrompt.trim());
  }, [inpaintImage, inpaintMask, inpaintPrompt, inpaint]);

  const handleImg2Img = useCallback(() => {
    if (!i2iImage) {
      toast.error("Veuillez fournir une image source");
      return;
    }
    if (!i2iPrompt.trim()) {
      toast.error("Veuillez saisir un prompt");
      return;
    }
    img2img(i2iImage, i2iPrompt.trim(), i2iStrength);
  }, [i2iImage, i2iPrompt, i2iStrength, img2img]);

  const handleUpscale = useCallback(() => {
    if (!upscaleImage) {
      toast.error("Veuillez fournir une image");
      return;
    }
    upscale(upscaleImage, upscaleScale);
  }, [upscaleImage, upscaleScale, upscale]);

  const handleDownload = useCallback(() => {
    if (!result?.image_url) return;
    const a = document.createElement("a");
    a.href = result.image_url;
    a.download = `generated-${Date.now()}.png`;
    a.click();
  }, [result]);

  const handleSizePreset = (w: number, h: number) => {
    setWidth(w);
    setHeight(h);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ImageIcon className="h-5 w-5 text-purple-500" />
          Génération d&apos;images
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Générez, modifiez et améliorez des images avec l&apos;IA.
        </p>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="generate" className="flex-1">
              <Sparkles className="h-4 w-4 mr-1" />
              Générer
            </TabsTrigger>
            <TabsTrigger value="inpaint" className="flex-1">
              <Eraser className="h-4 w-4 mr-1" />
              Inpaint
            </TabsTrigger>
            <TabsTrigger value="img2img" className="flex-1">
              <ArrowUpFromLine className="h-4 w-4 mr-1" />
              Img2Img
            </TabsTrigger>
            <TabsTrigger value="upscale" className="flex-1">
              <Maximize2 className="h-4 w-4 mr-1" />
              Upscale
            </TabsTrigger>
          </TabsList>

          {/* ════════════════ GENERATE TAB ════════════════ */}
          <TabsContent value="generate" className="space-y-4 mt-4">
            {/* Prompt */}
            <div className="space-y-2">
              <Label htmlFor="gen-prompt">Prompt</Label>
              <Textarea
                id="gen-prompt"
                placeholder="Décrivez l'image que vous souhaitez générer..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                disabled={generating}
              />
            </div>

            {/* Negative prompt (collapsible) */}
            <Collapsible open={negativeOpen} onOpenChange={setNegativeOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${negativeOpen ? "rotate-180" : ""}`}
                  />
                  Prompt négatif
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <Textarea
                  placeholder="Éléments à exclure de l'image..."
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  rows={2}
                  disabled={generating}
                />
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Size presets */}
            <div className="space-y-2">
              <Label>Dimensions</Label>
              <div className="flex flex-wrap gap-2">
                {SIZE_PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    variant={
                      width === p.w && height === p.h ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => handleSizePreset(p.w, p.h)}
                    disabled={generating}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Étapes</Label>
                <span className="text-xs text-muted-foreground">{steps}</span>
              </div>
              <Slider
                min={1}
                max={50}
                step={1}
                value={[steps]}
                onValueChange={([v]) => setSteps(v)}
                disabled={generating}
              />
            </div>

            {/* Guidance scale */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Guidance scale</Label>
                <span className="text-xs text-muted-foreground">
                  {guidance.toFixed(1)}
                </span>
              </div>
              <Slider
                min={1}
                max={20}
                step={0.5}
                value={[guidance]}
                onValueChange={([v]) => setGuidance(v)}
                disabled={generating}
              />
            </div>

            {/* Seed */}
            <div className="space-y-2">
              <Label htmlFor="gen-seed">Seed (optionnel)</Label>
              <div className="flex gap-2">
                <Input
                  id="gen-seed"
                  type="number"
                  placeholder="Aléatoire"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  disabled={generating}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSeed(String(Math.floor(Math.random() * 2147483647)))
                  }
                  disabled={generating}
                  title="Seed aléatoire"
                >
                  <Dice5 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Style */}
            <div className="space-y-2">
              <Label>Style</Label>
              <Select
                value={style}
                onValueChange={setStyle}
                disabled={generating}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir un style" />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model selector */}
            {models.length > 0 && (
              <div className="space-y-2">
                <Label>Modèle</Label>
                <Select
                  value={model}
                  onValueChange={setModel}
                  disabled={generating}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Modèle par défaut" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Générer l&apos;image
                </>
              )}
            </Button>
          </TabsContent>

          {/* ════════════════ INPAINT TAB ════════════════ */}
          <TabsContent value="inpaint" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Image source</Label>
              <FileDropZone
                accept="image/*"
                label="Glissez ou cliquez pour importer une image"
                file={inpaintImage}
                onFile={setInpaintImage}
              />
            </div>

            <div className="space-y-2">
              <Label>Masque</Label>
              <FileDropZone
                accept="image/*"
                label="Glissez ou cliquez pour importer le masque"
                file={inpaintMask}
                onFile={setInpaintMask}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inpaint-prompt">Prompt</Label>
              <Textarea
                id="inpaint-prompt"
                placeholder="Décrivez ce qui doit remplacer la zone masquée..."
                value={inpaintPrompt}
                onChange={(e) => setInpaintPrompt(e.target.value)}
                rows={3}
                disabled={generating}
              />
            </div>

            <Button
              onClick={handleInpaint}
              disabled={
                generating ||
                !inpaintImage ||
                !inpaintMask ||
                !inpaintPrompt.trim()
              }
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Inpainting en cours...
                </>
              ) : (
                <>
                  <Eraser className="h-4 w-4 mr-2" />
                  Lancer l&apos;inpainting
                </>
              )}
            </Button>
          </TabsContent>

          {/* ════════════════ IMG2IMG TAB ════════════════ */}
          <TabsContent value="img2img" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Image source</Label>
              <FileDropZone
                accept="image/*"
                label="Glissez ou cliquez pour importer une image"
                file={i2iImage}
                onFile={setI2iImage}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="i2i-prompt">Prompt</Label>
              <Textarea
                id="i2i-prompt"
                placeholder="Décrivez les modifications souhaitées..."
                value={i2iPrompt}
                onChange={(e) => setI2iPrompt(e.target.value)}
                rows={3}
                disabled={generating}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Force de transformation</Label>
                <span className="text-xs text-muted-foreground">
                  {i2iStrength.toFixed(2)}
                </span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[i2iStrength]}
                onValueChange={([v]) => setI2iStrength(v)}
                disabled={generating}
              />
              <p className="text-xs text-muted-foreground">
                0 = identique, 1 = complètement transformé
              </p>
            </div>

            <Button
              onClick={handleImg2Img}
              disabled={generating || !i2iImage || !i2iPrompt.trim()}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transformation en cours...
                </>
              ) : (
                <>
                  <ArrowUpFromLine className="h-4 w-4 mr-2" />
                  Transformer l&apos;image
                </>
              )}
            </Button>
          </TabsContent>

          {/* ════════════════ UPSCALE TAB ════════════════ */}
          <TabsContent value="upscale" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Image à agrandir</Label>
              <FileDropZone
                accept="image/*"
                label="Glissez ou cliquez pour importer une image"
                file={upscaleImage}
                onFile={setUpscaleImage}
              />
            </div>

            <div className="space-y-2">
              <Label>Facteur d&apos;agrandissement</Label>
              <div className="flex gap-2">
                {UPSCALE_OPTIONS.map((s) => (
                  <Button
                    key={s}
                    variant={upscaleScale === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUpscaleScale(s)}
                    disabled={generating}
                  >
                    {s}x
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleUpscale}
              disabled={generating || !upscaleImage}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Agrandissement en cours...
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4 mr-2" />
                  Agrandir l&apos;image
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        {/* ════════════════ RESULT ════════════════ */}
        {result && (
          <>
            <Separator className="my-4" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Résultat
                </h3>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {result.width}x{result.height}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {result.model_used}
                  </Badge>
                </div>
              </div>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.image_url}
                alt="Image générée"
                className="w-full rounded-lg border shadow-sm"
              />

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Seed : {result.seed_used}</span>
                <span>Modèle : {result.model_used}</span>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => reset()}>
                  <Sparkles className="h-4 w-4 mr-1" />
                  Nouveau
                </Button>
                <Button size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-1" />
                  Télécharger
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
