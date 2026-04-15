"use client";

import { useState } from "react";
import { Hash, TrendingUp, Tag, Star, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getServiceUrl, ServiceName } from "@/lib/api/factory";

interface HashtagResult {
  tag: string;
  score: number; // 0-100 trending estimate
  category: "suggested" | "trending" | "brand";
}

interface HashtagSuggestorProps {
  postContent?: string;
  selectedHashtags?: string[];
  onHashtagsChange?: (tags: string[]) => void;
}

const CATEGORY_ICONS = {
  suggested: Tag,
  trending: TrendingUp,
  brand: Star,
};

const SCORE_COLOR = (score: number) => {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-muted-foreground";
};

export function HashtagSuggestor({
  postContent = "",
  selectedHashtags = [],
  onHashtagsChange,
}: HashtagSuggestorProps) {
  const [selected, setSelected] = useState<string[]>(selectedHashtags);
  const [results, setResults] = useState<HashtagResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);

  const analyze = async () => {
    if (!postContent.trim()) {
      toast.error("Aucun contenu de publication à analyser");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${getServiceUrl(ServiceName.SOCIAL)}/social/ai/hashtags`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: postContent }),
        },
      );
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setResults(data.hashtags ?? []);
    } catch {
      // Fallback: derive hashtags from content words
      const words = postContent.match(/\b[a-zA-Z]{4,}\b/g) ?? [];
      const unique = [...new Set(words.map((w) => w.toLowerCase()))].slice(
        0,
        8,
      );
      const fallback: HashtagResult[] = [
        ...unique.map((w, i) => ({
          tag: w,
          score: Math.floor(60 + Math.random() * 30),
          category: "suggested" as const,
        })),
        { tag: "SignApps", score: 90, category: "brand" as const },
        { tag: "productivity", score: 78, category: "trending" as const },
        { tag: "innovation", score: 65, category: "trending" as const },
      ];
      setResults(fallback);
      toast.info("Utilisation des suggestions de hashtags locaux");
    } finally {
      setLoading(false);
      setAnalyzed(true);
    }
  };

  const toggle = (tag: string) => {
    const next = selected.includes(tag)
      ? selected.filter((t) => t !== tag)
      : [...selected, tag];
    setSelected(next);
    onHashtagsChange?.(next);
  };

  const categories: Array<"suggested" | "trending" | "brand"> = [
    "suggested",
    "trending",
    "brand",
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Hash className="w-4 h-4 text-blue-500" />
          Hashtag Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1 p-2 bg-muted/50 rounded-md min-h-[36px]">
            {selected.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                #{tag}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-destructive"
                  onClick={() => toggle(tag)}
                />
              </Badge>
            ))}
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={analyze}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
          ) : (
            <Hash className="w-3 h-3 mr-2" />
          )}
          {analyzed ? "Re-analyze" : "Analyze Content"}
        </Button>

        {results.length > 0 && (
          <Tabs defaultValue="suggested">
            <TabsList className="w-full h-8">
              {categories.map((cat) => {
                const count = results.filter((r) => r.category === cat).length;
                const Icon = CATEGORY_ICONS[cat];
                return (
                  <TabsTrigger
                    key={cat}
                    value={cat}
                    className="flex-1 text-xs capitalize gap-1"
                  >
                    <Icon className="w-3 h-3" />
                    {cat} ({count})
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {categories.map((cat) => (
              <TabsContent key={cat} value={cat} className="mt-2">
                <div className="flex flex-wrap gap-1">
                  {results
                    .filter((r) => r.category === cat)
                    .sort((a, b) => b.score - a.score)
                    .map((r) => {
                      const isSelected = selected.includes(r.tag);
                      return (
                        <button
                          key={r.tag}
                          onClick={() => toggle(r.tag)}
                          className={`group flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted border-border"
                          }`}
                        >
                          {isSelected ? (
                            <X className="w-3 h-3" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                          #{r.tag}
                          <span
                            className={`text-xs ${isSelected ? "text-primary-foreground/70" : SCORE_COLOR(r.score)}`}
                          >
                            {r.score}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
