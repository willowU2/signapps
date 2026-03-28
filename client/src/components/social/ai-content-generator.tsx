"use client";

import { useState } from "react";
import { Wand2, RefreshCw, Check, Copy, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const PLATFORM_COLORS: Record<string, string> = {
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  instagram: "#E4405F",
  linkedin: "#0A66C2",
  mastodon: "#6364FF",
  bluesky: "#0085FF",
};

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  mastodon: 500,
  bluesky: 300,
};

type Tone = "professional" | "casual" | "funny" | "inspirational";

interface GeneratedContent {
  platform: string;
  text: string;
  variation?: number;
}

interface AiContentGeneratorProps {
  onAccept?: (platform: string, text: string) => void;
}

export function AiContentGenerator({ onAccept }: AiContentGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [platforms, setPlatforms] = useState<string[]>(["twitter", "linkedin"]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GeneratedContent[]>([]);
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});
  const [variationMode, setVariationMode] = useState(false);

  const togglePlatform = (p: string) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const generate = async (variations = false) => {
    if (!topic.trim()) {
      toast.error("Veuillez saisir un sujet ou une description");
      return;
    }
    setLoading(true);
    setVariationMode(variations);
    try {
      const res = await fetch("http://localhost:3019/api/v1/social/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, tone, platforms, variations }),
      });
      if (!res.ok) throw new Error("Génération échouée");
      const data = await res.json();
      setResults(data.results ?? []);
      setEditedTexts({});
    } catch {
      // Fallback with local generation
      const fallback: GeneratedContent[] = platforms.flatMap((p, i) => {
        const limit = PLATFORM_LIMITS[p];
        const base = `[${tone.toUpperCase()}] ${topic.slice(0, limit - 20)}`;
        if (variations) {
          return [
            { platform: p, text: base + " — version A", variation: 1 },
            { platform: p, text: base + " — version B", variation: 2 },
          ];
        }
        return [{ platform: p, text: base }];
      });
      setResults(fallback);
      setEditedTexts({});
      toast.warning("Génération hors-ligne (service IA indisponible)");
    } finally {
      setLoading(false);
    }
  };

  const getText = (r: GeneratedContent) => {
    const key = `${r.platform}-${r.variation ?? 0}`;
    return editedTexts[key] ?? r.text;
  };

  const handleEdit = (r: GeneratedContent, val: string) => {
    const key = `${r.platform}-${r.variation ?? 0}`;
    setEditedTexts((prev) => ({ ...prev, [key]: val }));
  };

  const handleAccept = (r: GeneratedContent) => {
    onAccept?.(r.platform, getText(r));
    toast.success(`Content accepted for ${r.platform}`);
  };

  const handleCopy = (r: GeneratedContent) => {
    navigator.clipboard.writeText(getText(r));
    toast.success("Copié dans le presse-papiers");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Wand2 className="w-4 h-4" />
          AI Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-500" />
            AI Content Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="topic">Topic / Description</Label>
            <Textarea
              id="topic"
              placeholder="Describe what you want to post about..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="funny">Funny</SelectItem>
                  <SelectItem value="inspirational">Inspirational</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Platforms</Label>
              <div className="flex flex-wrap gap-1">
                {Object.keys(PLATFORM_COLORS).map((p) => (
                  <Badge
                    key={p}
                    variant={platforms.includes(p) ? "default" : "outline"}
                    className="cursor-pointer capitalize text-xs"
                    style={
                      platforms.includes(p)
                        ? { backgroundColor: PLATFORM_COLORS[p], color: "#fff", border: "none" }
                        : {}
                    }
                    onClick={() => togglePlatform(p)}
                  >
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => generate(false)} disabled={loading} className="flex-1">
              {loading && !variationMode ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4 mr-2" />
              )}
              Generate
            </Button>
            <Button
              variant="outline"
              onClick={() => generate(true)}
              disabled={loading}
              className="flex-1"
            >
              {loading && variationMode ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Generate Variations (A/B)
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-3">
              {results.map((r, i) => {
                const limit = PLATFORM_LIMITS[r.platform] ?? 500;
                const text = getText(r);
                const over = text.length > limit;
                return (
                  <Card key={i} className="border">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: PLATFORM_COLORS[r.platform] }}
                          />
                          <span className="capitalize">{r.platform}</span>
                          {r.variation && (
                            <Badge variant="secondary" className="text-xs">
                              Variation {r.variation}
                            </Badge>
                          )}
                        </span>
                        <span className={`text-xs font-normal ${over ? "text-red-500" : "text-muted-foreground"}`}>
                          {text.length}/{limit}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-2">
                      <Textarea
                        value={text}
                        onChange={(e) => handleEdit(r, e.target.value)}
                        rows={3}
                        className={over ? "border-red-400" : ""}
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => handleCopy(r)}>
                          <Copy className="w-3 h-3 mr-1" /> Copy
                        </Button>
                        <Button size="sm" onClick={() => handleAccept(r)} disabled={over}>
                          <Check className="w-3 h-3 mr-1" /> Accept
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
