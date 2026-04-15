"use client";

// Feature 19: AI-powered natural language search

import { useState, useCallback } from "react";
import { Sparkles, Search, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getClient, ServiceName } from "@/lib/api/factory";

interface NlpResult {
  id: string;
  title: string;
  url: string;
  entityType: string;
  excerpt: string;
  relevanceScore: number;
  explanation: string;
}

interface NlpSearchResponse {
  results: NlpResult[];
  interpretation: string;
  suggestedQuery: string;
}

export function AiNaturalLanguageSearch() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<NlpSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const client = getClient(ServiceName.AI);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const { data } = await client.post<NlpSearchResponse>("/search/nlp", {
        query,
      });
      setResponse(data);
    } catch {
      setResponse({
        results: [],
        interpretation: "Erreur de recherche IA",
        suggestedQuery: "",
      });
    } finally {
      setLoading(false);
    }
  }, [query, client]);

  const examples = [
    "Emails de clients en attente de réponse cette semaine",
    "Tâches en retard assignées à mon équipe",
    "Documents modifiés hier sur le projet Alpha",
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-purple-500" />
        <h3 className="text-sm font-semibold">
          Recherche IA en langage naturel
        </h3>
      </div>

      <div className="space-y-2">
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Décrivez ce que vous cherchez en langage naturel…"
          className="text-sm resize-none"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              search();
            }
          }}
        />
        <div className="flex justify-between items-center">
          <div className="flex gap-1 flex-wrap">
            {examples.map((ex, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setQuery(ex)}
              >
                {ex.slice(0, 30)}…
              </Button>
            ))}
          </div>
          <Button
            onClick={search}
            disabled={loading || !query.trim()}
            size="sm"
            className="gap-1.5 shrink-0"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            Rechercher
          </Button>
        </div>
      </div>

      {response && (
        <div className="space-y-3">
          {response.interpretation && (
            <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-3">
              <p className="text-xs text-purple-700 dark:text-purple-300">
                <Sparkles className="w-3 h-3 inline mr-1" />
                {response.interpretation}
              </p>
            </div>
          )}

          {response.results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun résultat correspondant
            </p>
          ) : (
            <ScrollArea className="max-h-72">
              <div className="space-y-2">
                {response.results.map((r) => (
                  <a
                    key={r.id}
                    href={r.url}
                    className="block border rounded-lg p-3 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium truncate">
                            {r.title}
                          </p>
                          <Badge
                            variant="secondary"
                            className="text-xs shrink-0 capitalize"
                          >
                            {r.entityType.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {r.excerpt}
                        </p>
                        {r.explanation && (
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                            {r.explanation}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                    </div>
                  </a>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
