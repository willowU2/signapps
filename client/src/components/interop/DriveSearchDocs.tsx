"use client";

/**
 * Feature 25: Drive search → include doc content
 */

import { useState, useCallback } from "react";
import { Search, FileText, File, Folder, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { driveApi, DriveNode } from "@/lib/api/drive";
import { aiApi } from "@/lib/api/ai";
import { useRouter } from "next/navigation";

interface SearchResult extends DriveNode {
  snippet?: string;
  matchType: "name" | "content" | "ai";
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function DriveSearchDocs() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const search = useCallback(
    debounce(async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const [nodes, aiResults] = await Promise.allSettled([
          driveApi.listNodes(null),
          aiApi.search(q, 10),
        ]);

        const allNodes: DriveNode[] =
          nodes.status === "fulfilled" ? nodes.value : [];
        const aiDocs: any[] =
          aiResults.status === "fulfilled" ? (aiResults.value.data ?? []) : [];

        const lower = q.toLowerCase();
        const nameMatches: SearchResult[] = allNodes
          .filter((n) => n.name.toLowerCase().includes(lower))
          .map((n) => ({ ...n, matchType: "name" as const }));

        const aiMatches: SearchResult[] = aiDocs
          .filter((r) => !nameMatches.some((n) => n.id === r.document_id))
          .map((r) => ({
            id: r.document_id ?? r.id,
            parent_id: null,
            name: r.filename ?? r.title ?? "Document",
            node_type: "document" as const,
            target_id: r.document_id ?? r.id,
            owner_id: "",
            size: null,
            mime_type: null,
            created_at: "",
            updated_at: "",
            deleted_at: null,
            snippet: r.chunk?.slice(0, 120) ?? r.content?.slice(0, 120),
            matchType: "ai" as const,
          }));

        setResults([...nameMatches.slice(0, 8), ...aiMatches.slice(0, 5)]);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400),
    [],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    search(e.target.value);
  };

  const openResult = (r: SearchResult) => {
    if (r.node_type === "document") {
      const id = r.target_id ?? r.id;
      router.push(`/docs/editor?id=${id}&name=${encodeURIComponent(r.name)}`);
    } else if (r.node_type === "folder") {
      router.push(`/global-drive?node=${r.id}`);
    } else {
      router.push(`/global-drive?node=${r.id}`);
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        <Input
          value={query}
          onChange={handleChange}
          placeholder="Rechercher fichiers et contenu des docs..."
          className="pl-9 pr-9"
        />
      </div>

      {results.length > 0 && (
        <div className="absolute top-full mt-1 w-full rounded-lg border bg-popover shadow-lg z-50 overflow-hidden">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => openResult(r)}
              className="w-full flex items-start gap-2.5 p-2.5 hover:bg-accent text-sm text-left transition-colors"
            >
              {r.node_type === "folder" ? (
                <Folder className="h-4 w-4 shrink-0 mt-0.5 text-yellow-500" />
              ) : r.node_type === "document" ? (
                <FileText className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
              ) : (
                <File className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{r.name}</span>
                  <Badge variant="outline" className="text-xs h-4 shrink-0">
                    {r.matchType === "ai" ? "Contenu" : "Nom"}
                  </Badge>
                </div>
                {r.snippet && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {r.snippet}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {query && !loading && results.length === 0 && (
        <div className="absolute top-full mt-1 w-full rounded-lg border bg-popover shadow-lg z-50 p-3 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun résultat pour « {query} »
          </p>
        </div>
      )}
    </div>
  );
}
