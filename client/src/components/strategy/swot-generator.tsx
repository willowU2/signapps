"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb,
  Zap,
  AlertTriangle,
  TrendingUp,
  Plus,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { aiApi } from "@/lib/api/ai";
import { toast } from "sonner";

interface SWOTItem {
  id: string;
  text: string;
}

interface SWOTData {
  strengths: SWOTItem[];
  weaknesses: SWOTItem[];
  opportunities: SWOTItem[];
  threats: SWOTItem[];
}

const QUADRANTS = [
  {
    key: "strengths" as const,
    label: "Forces",
    icon: Zap,
    color: "bg-green-500/10 border-green-500/30",
    textColor: "text-green-700",
    description: "Avantages concurrentiels",
  },
  {
    key: "weaknesses" as const,
    label: "Faiblesses",
    icon: AlertTriangle,
    color: "bg-red-500/10 border-red-500/30",
    textColor: "text-red-700",
    description: "Domaines à améliorer",
  },
  {
    key: "opportunities" as const,
    label: "Opportunités",
    icon: TrendingUp,
    color: "bg-blue-500/10 border-blue-500/30",
    textColor: "text-blue-700",
    description: "Croissance potentielle",
  },
  {
    key: "threats" as const,
    label: "Menaces",
    icon: AlertTriangle,
    color: "bg-orange-500/10 border-orange-500/30",
    textColor: "text-orange-700",
    description: "Risques externes",
  },
];

export function SWOTGenerator() {
  const [swotData, setSWOTData] = useState<SWOTData>({
    strengths: [{ id: "1", text: "Équipe expérimentée" }],
    weaknesses: [{ id: "1", text: "Budget limité" }],
    opportunities: [{ id: "1", text: "Marché en croissance" }],
    threats: [{ id: "1", text: "Concurrence accrue" }],
  });

  const [newItems, setNewItems] = useState<Record<string, string>>({
    strengths: "",
    weaknesses: "",
    opportunities: "",
    threats: "",
  });

  const [aiContext, setAiContext] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  const handleAddItem = (quadrantKey: keyof SWOTData) => {
    const text = newItems[quadrantKey]?.trim();
    if (!text) return;

    setSWOTData({
      ...swotData,
      [quadrantKey]: [
        ...swotData[quadrantKey],
        { id: Date.now().toString(), text },
      ],
    });
    setNewItems({ ...newItems, [quadrantKey]: "" });
  };

  const handleRemoveItem = (quadrantKey: keyof SWOTData, itemId: string) => {
    setSWOTData({
      ...swotData,
      [quadrantKey]: swotData[quadrantKey].filter((item) => item.id !== itemId),
    });
  };

  const handleAISuggestions = async () => {
    const description = aiContext.trim() || "our company / product";
    setIsLoadingAI(true);
    try {
      const prompt = `Generate a SWOT analysis for: ${description}.
Respond ONLY with a valid JSON object (no markdown, no explanation) in this exact format:
{
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "opportunities": ["...", "..."],
  "threats": ["...", "..."]
}
Each array should have 3-5 concise items.`;

      const response = await aiApi.chat(prompt, { enableTools: false, includesSources: false });
      const raw = response.data?.answer ?? "";

      // Extract JSON from response (strip any surrounding markdown if present)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in AI response");
      const parsed = JSON.parse(jsonMatch[0]) as {
        strengths?: string[];
        weaknesses?: string[];
        opportunities?: string[];
        threats?: string[];
      };

      const toItems = (arr: string[] | undefined, prefix: string): SWOTItem[] =>
        (arr ?? []).map((text, i) => ({ id: `${prefix}${Date.now()}${i}`, text }));

      setSWOTData({
        strengths: toItems(parsed.strengths, "s"),
        weaknesses: toItems(parsed.weaknesses, "w"),
        opportunities: toItems(parsed.opportunities, "o"),
        threats: toItems(parsed.threats, "t"),
      });
      toast.success("AI suggestions loaded");
    } catch (err) {
      console.error("SWOT AI error:", err);
      toast.error("AI suggestions unavailable");
    } finally {
      setIsLoadingAI(false);
    }
  };

  return (
    <div className="w-full space-y-4 p-4 border border-border/50 rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Analyse SWOT</h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAISuggestions}
          disabled={isLoadingAI}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          {isLoadingAI ? "..." : "IA"}
        </Button>
      </div>

      {/* AI Context Input */}
      <div className="flex gap-2 items-center">
        <Input
          type="text"
          value={aiContext}
          onChange={(e) => setAiContext(e.target.value)}
          placeholder="Describe your company / product for AI suggestions..."
          className="text-sm h-8"
          onKeyDown={(e) => { if (e.key === "Enter") handleAISuggestions(); }}
        />
      </div>

      {/* SWOT Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUADRANTS.map((quadrant) => {
          const Icon = quadrant.icon;
          const items = swotData[quadrant.key];

          return (
            <div
              key={quadrant.key}
              className={cn("border rounded-lg p-3 space-y-3", quadrant.color)}
            >
              {/* Quadrant Header */}
              <div className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4", quadrant.textColor)} />
                <div>
                  <h3 className={cn("font-semibold text-sm", quadrant.textColor)}>
                    {quadrant.label}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {quadrant.description}
                  </p>
                </div>
              </div>

              {/* Items List */}
              {items.length > 0 && (
                <div className="space-y-1">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 bg-background/50 rounded p-2 text-sm"
                    >
                      <span className="flex-1">{item.text}</span>
                      <button
                        onClick={() =>
                          handleRemoveItem(quadrant.key, item.id)
                        }
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Item Input */}
              <div className="flex gap-1 pt-2 border-t border-border/30">
                <Input
                  type="text"
                  value={newItems[quadrant.key] || ""}
                  onChange={(e) =>
                    setNewItems({
                      ...newItems,
                      [quadrant.key]: e.target.value,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddItem(quadrant.key);
                  }}
                  placeholder="Ajouter..."
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAddItem(quadrant.key)}
                  className="px-2 h-8"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground">
        <p>
          Total: {Object.values(swotData).reduce((sum, arr) => sum + arr.length, 0)} éléments
        </p>
      </div>
    </div>
  );
}
