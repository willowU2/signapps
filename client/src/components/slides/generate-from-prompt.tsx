"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

interface GeneratedSlide {
  title: string;
  content: string;
  speaker_notes?: string;
}

interface GenerateResult {
  presentation_title: string;
  slides: GeneratedSlide[];
}

interface GenerateFromPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: (result: GenerateResult) => void;
}

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "educational", label: "Educational" },
  { value: "inspirational", label: "Inspirational" },
] as const;

export function GenerateFromPromptDialog({
  open,
  onOpenChange,
  onGenerated,
}: GenerateFromPromptProps) {
  const [prompt, setPrompt] = useState("");
  const [slideCount, setSlideCount] = useState(6);
  const [tone, setTone] = useState<string>("professional");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (prompt.trim().length < 10) {
      toast.error("Décrivez votre présentation en au moins 10 caractères.");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch("/api/ai/generate-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, slide_count: slideCount, tone }),
        credentials: "include",
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data: GenerateResult = await resp.json();
      toast.success(`Generated ${data.slides.length} slides!`);
      onGenerated?.(data);
      onOpenChange(false);
      setPrompt("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Génération échouée: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Generate Presentation from Prompt
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="prompt">Describe your presentation</Label>
            <Textarea
              id="prompt"
              rows={4}
              placeholder="e.g. 'A quarterly business review for Q3 2025 covering sales performance, key wins, and next quarter goals'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {prompt.length} characters
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Slides: {slideCount}</Label>
              <Slider
                min={3}
                max={20}
                step={1}
                value={[slideCount]}
                onValueChange={([v]) => setSlideCount(v)}
                disabled={loading}
                className="mt-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>3</span>
                <span>20</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={loading || prompt.trim().length < 10}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate {slideCount} Slides
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
