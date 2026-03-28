"use client";

import { useState, useCallback } from "react";
import {
  Sparkles,
  Loader2,
  Image,
  Palette,
  Wand2,
  Check,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Style definitions
// ---------------------------------------------------------------------------

interface ImageStyle {
  id: string;
  name: string;
  gradient: string;
  iconColor: string;
}

const IMAGE_STYLES: ImageStyle[] = [
  {
    id: "realistic",
    name: "Realistic",
    gradient: "from-slate-600 to-slate-800",
    iconColor: "text-slate-300",
  },
  {
    id: "cartoon",
    name: "Cartoon",
    gradient: "from-yellow-400 to-orange-500",
    iconColor: "text-yellow-100",
  },
  {
    id: "anime",
    name: "Anime",
    gradient: "from-pink-400 to-purple-500",
    iconColor: "text-pink-100",
  },
  {
    id: "fantasy",
    name: "Fantasy",
    gradient: "from-emerald-400 to-teal-600",
    iconColor: "text-emerald-100",
  },
  {
    id: "abstract",
    name: "Abstract",
    gradient: "from-violet-500 to-fuchsia-500",
    iconColor: "text-violet-100",
  },
  {
    id: "pixel-art",
    name: "Pixel Art",
    gradient: "from-green-500 to-lime-400",
    iconColor: "text-green-100",
  },
  {
    id: "sketch",
    name: "Sketch",
    gradient: "from-gray-400 to-gray-600",
    iconColor: "text-gray-100",
  },
  {
    id: "watercolor",
    name: "Watercolor",
    gradient: "from-sky-300 to-blue-500",
    iconColor: "text-sky-100",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    gradient: "from-cyan-400 to-purple-600",
    iconColor: "text-cyan-100",
  },
  {
    id: "monochromatic",
    name: "Monochromatic",
    gradient: "from-neutral-500 to-neutral-800",
    iconColor: "text-neutral-200",
  },
  {
    id: "surreal",
    name: "Surreal",
    gradient: "from-indigo-400 to-rose-500",
    iconColor: "text-indigo-100",
  },
  {
    id: "pop-art",
    name: "Pop Art",
    gradient: "from-red-500 to-yellow-400",
    iconColor: "text-red-100",
  },
  {
    id: "fantasy-realism",
    name: "Fantasy Realism",
    gradient: "from-amber-500 to-emerald-600",
    iconColor: "text-amber-100",
  },
  {
    id: "minimalist",
    name: "Minimalist",
    gradient: "from-zinc-200 to-zinc-400",
    iconColor: "text-zinc-600",
  },
];

// ---------------------------------------------------------------------------
// Generated image result type
// ---------------------------------------------------------------------------

interface GeneratedImage {
  id: string;
  style: ImageStyle;
  description: string;
  gradient: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AiImageGeneratorProps {
  onUseInPost?: (image: GeneratedImage) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiImageGenerator({ onUseInPost }: AiImageGeneratorProps) {
  const [description, setDescription] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedImage | null>(null);

  const selectedStyleObj = IMAGE_STYLES.find((s) => s.id === selectedStyle) ?? null;

  const handleGenerate = useCallback(async () => {
    if (description.trim().length < 30) {
      toast.error("Description must be at least 30 characters");
      return;
    }
    if (!selectedStyle || !selectedStyleObj) {
      toast.error("Veuillez sélectionner un style");
      return;
    }

    setGenerating(true);
    setResult(null);

    // Simulate AI image generation delay
    await new Promise((r) => setTimeout(r, 2500 + Math.random() * 1500));

    const image: GeneratedImage = {
      id: `img-${Date.now()}`,
      style: selectedStyleObj,
      description: description.trim(),
      gradient: selectedStyleObj.gradient,
      timestamp: Date.now(),
    };

    setResult(image);
    setGenerating(false);
    toast.success("Image générée avec succès");
  }, [description, selectedStyle, selectedStyleObj]);

  const handleUseInPost = () => {
    if (result) {
      onUseInPost?.(result);
      toast.success("Image ajoutée à la publication");
    }
  };

  const handleReset = () => {
    setResult(null);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Palette className="w-5 h-5 text-fuchsia-500" />
          AI Image Generator
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Generate images for your social media posts using AI styles.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ---------- Description ---------- */}
        <div className="space-y-2">
          <Label htmlFor="img-description">Image Description</Label>
          <Textarea
            id="img-description"
            placeholder="Describe the image you want to generate (min 30 characters)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={generating}
          />
          <p className="text-xs text-muted-foreground">
            {description.length} characters
            {description.length > 0 && description.length < 30 && (
              <span className="text-orange-500 ml-1">(need at least 30)</span>
            )}
          </p>
        </div>

        <Separator />

        {/* ---------- Style Picker ---------- */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Style
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {IMAGE_STYLES.map((style) => {
              const isSelected = selectedStyle === style.id;
              return (
                <button
                  key={style.id}
                  type="button"
                  disabled={generating}
                  onClick={() => setSelectedStyle(isSelected ? null : style.id)}
                  className={`
                    group relative flex flex-col items-center justify-center
                    rounded-lg p-4 h-24 transition-all cursor-pointer
                    bg-gradient-to-br ${style.gradient}
                    hover:scale-[1.03] hover:shadow-lg
                    ${
                      isSelected
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg scale-[1.03]"
                        : "hover:ring-1 hover:ring-border"
                    }
                    disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100
                  `}
                >
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  <Wand2
                    className={`w-6 h-6 mb-1.5 ${style.iconColor} opacity-80 group-hover:opacity-100 transition-opacity`}
                  />
                  <span
                    className={`text-xs font-medium ${style.iconColor} opacity-90 group-hover:opacity-100 transition-opacity`}
                  >
                    {style.name}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedStyleObj && (
            <p className="text-xs text-muted-foreground">
              Selected: <span className="font-medium">{selectedStyleObj.name}</span>
            </p>
          )}
        </div>

        <Separator />

        {/* ---------- Generate Button ---------- */}
        <Button
          onClick={handleGenerate}
          disabled={generating || description.trim().length < 30 || !selectedStyle}
          className="w-full"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Image
            </>
          )}
        </Button>

        {/* ---------- Result ---------- */}
        {result && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Generated Image
                </h3>
                <Badge variant="secondary" className="text-xs">
                  <Check className="w-3 h-3 mr-1" />
                  {result.style.name}
                </Badge>
              </div>

              {/* Mock image preview */}
              <div
                className={`
                  relative rounded-lg overflow-hidden
                  bg-gradient-to-br ${result.gradient}
                  aspect-[4/3] w-full flex flex-col items-center justify-center
                  shadow-inner
                `}
              >
                {/* Decorative elements to make the mock look more interesting */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-white/30 blur-2xl" />
                  <div className="absolute bottom-1/4 right-1/3 w-24 h-24 rounded-full bg-white/20 blur-xl" />
                  <div className="absolute top-1/2 right-1/4 w-16 h-16 rounded-full bg-white/25 blur-lg" />
                </div>

                {/* Style name overlay */}
                <div className="relative z-10 text-center">
                  <Wand2 className="w-12 h-12 mx-auto mb-3 text-white/70" />
                  <p className="text-white/90 text-lg font-bold tracking-wide">
                    {result.style.name}
                  </p>
                  <p className="text-white/60 text-xs mt-1 max-w-[250px] mx-auto px-4 line-clamp-2">
                    {result.description}
                  </p>
                </div>

                {/* Generation badge */}
                <div className="absolute bottom-3 right-3">
                  <Badge
                    variant="secondary"
                    className="bg-black/30 text-white/80 border-none text-[10px]"
                  >
                    AI Generated
                  </Badge>
                </div>
              </div>

              {/* Details */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium">Style:</span> {result.style.name}
                </p>
                <p>
                  <span className="font-medium">Description:</span> {result.description}
                </p>
                <p>
                  <span className="font-medium">Generated:</span>{" "}
                  {new Date(result.timestamp).toLocaleTimeString()}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <Sparkles className="w-4 h-4 mr-1" />
                  Regenerate
                </Button>
                <Button size="sm" onClick={handleUseInPost}>
                  <Image className="w-4 h-4 mr-1" />
                  Use in Post
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
