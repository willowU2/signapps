"use client";

// IDEA-120: Full-text document search — search within document content

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getClient, ServiceName } from "@/lib/api/factory";
import {
  FileText,
  Sheet,
  Presentation,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FullTextResult {
  id: string;
  title: string;
  type: "doc" | "sheet" | "slide";
  excerpt: string;
  updatedAt: string;
  url: string;
}

// API client — calls the docs service full-text search endpoint
async function searchDocumentContent(query: string): Promise<FullTextResult[]> {
  if (!query.trim()) return [];
  const client = getClient(ServiceName.DOCS);
  const res = await client.get<{ results: FullTextResult[] }>("/search", {
    params: { q: query, limit: 20 },
  });
  return res.data?.results ?? [];
}

const TYPE_ICONS = {
  doc: <FileText className="h-4 w-4 text-blue-500" />,
  sheet: <Sheet className="h-4 w-4 text-green-500" />,
  slide: <Presentation className="h-4 w-4 text-orange-500" />,
};

const TYPE_ROUTES = {
  doc: "/docs",
  sheet: "/sheets",
  slide: "/slides",
};

interface FullTextSearchResultsProps {
  query: string;
  className?: string;
}

export function FullTextSearchResults({
  query,
  className,
}: FullTextSearchResultsProps) {
  const {
    data: results = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["fulltext-search", query],
    queryFn: () => searchDocumentContent(query),
    enabled: query.trim().length >= 2,
    staleTime: 30 * 1000,
  });

  if (!query.trim() || query.trim().length < 2) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Contenu des documents
        </span>
        {isLoading && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive px-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Service de recherche indisponible
        </div>
      )}

      {!isLoading && !error && results.length === 0 && (
        <p className="text-xs text-muted-foreground px-2">
          Aucun résultat dans les documents pour &ldquo;{query}&rdquo;
        </p>
      )}

      {results.map((r) => (
        <a
          key={r.id}
          href={`${TYPE_ROUTES[r.type]}/${r.id}`}
          className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors group"
        >
          <div className="flex-shrink-0 mt-0.5">{TYPE_ICONS[r.type]}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
              {r.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
              {r.excerpt}
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              {new Date(r.updatedAt).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </a>
      ))}
    </div>
  );
}

// Hook for programmatic use
export function useFullTextSearch(query: string) {
  return useQuery({
    queryKey: ["fulltext-search", query],
    queryFn: () => searchDocumentContent(query),
    enabled: query.trim().length >= 2,
    staleTime: 30 * 1000,
  });
}
