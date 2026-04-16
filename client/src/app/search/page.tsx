"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  Search,
  FileText,
  Mail,
  Users,
  CalendarDays,
  CheckSquare,
  HardDrive,
  Globe,
  ArrowRight,
  X,
  Clock,
  Loader2,
  Bookmark,
  BookmarkPlus,
  Trash2,
  History,
} from "lucide-react";
import {
  searchApi,
  type SearchResult,
  type SearchResponse,
  type SearchParams,
  type SearchHistoryItem,
  type SavedSearch,
} from "@/lib/api/search";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Scope configuration ────────────────────────────────────────────────────

interface ScopeConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const SCOPE_CONFIG: ScopeConfig[] = [
  {
    key: "all",
    label: "Tous",
    icon: <Globe className="h-4 w-4" />,
    color: "text-foreground",
  },
  {
    key: "files",
    label: "Fichiers",
    icon: <HardDrive className="h-4 w-4" />,
    color: "text-cyan-500",
  },
  {
    key: "docs",
    label: "Documents",
    icon: <FileText className="h-4 w-4" />,
    color: "text-blue-500",
  },
  {
    key: "mail",
    label: "Emails",
    icon: <Mail className="h-4 w-4" />,
    color: "text-red-500",
  },
  {
    key: "contacts",
    label: "Contacts",
    icon: <Users className="h-4 w-4" />,
    color: "text-green-500",
  },
  {
    key: "tasks",
    label: "Taches",
    icon: <CheckSquare className="h-4 w-4" />,
    color: "text-amber-500",
  },
  {
    key: "calendar",
    label: "Calendrier",
    icon: <CalendarDays className="h-4 w-4" />,
    color: "text-purple-500",
  },
];

// Icon for entity_type from results
function entityIcon(entityType: string) {
  switch (entityType) {
    case "file":
      return <HardDrive className="h-4 w-4 text-cyan-500" />;
    case "document":
    case "doc":
      return <FileText className="h-4 w-4 text-blue-500" />;
    case "email":
    case "mail":
      return <Mail className="h-4 w-4 text-red-500" />;
    case "contact":
      return <Users className="h-4 w-4 text-green-500" />;
    case "task":
      return <CheckSquare className="h-4 w-4 text-amber-500" />;
    case "event":
    case "calendar":
      return <CalendarDays className="h-4 w-4 text-purple-500" />;
    default:
      return <Search className="h-4 w-4 text-muted-foreground" />;
  }
}

function entityBadgeColor(entityType: string) {
  switch (entityType) {
    case "file":
      return "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400";
    case "document":
    case "doc":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
    case "email":
    case "mail":
      return "bg-red-500/10 text-red-700 dark:text-red-400";
    case "contact":
      return "bg-green-500/10 text-green-700 dark:text-green-400";
    case "task":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "event":
    case "calendar":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SearchPage() {
  usePageTitle("Recherche avancee");
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [activeScope, setActiveScope] = useState("all");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounce 200ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setSelectedIndex(-1);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Update URL
  useEffect(() => {
    if (debouncedQuery) {
      const url = new URL(window.location.href);
      url.searchParams.set("q", debouncedQuery);
      if (activeScope !== "all") url.searchParams.set("scope", activeScope);
      else url.searchParams.delete("scope");
      window.history.replaceState({}, "", url.toString());
    }
  }, [debouncedQuery, activeScope]);

  // ── Search query ─────────────────────────────────────────────────────────

  const searchQueryParams = useMemo<SearchParams>(() => {
    const p: SearchParams = { q: debouncedQuery, limit: 50 };
    if (activeScope !== "all") p.scope = activeScope;
    return p;
  }, [debouncedQuery, activeScope]);

  const {
    data: searchResponse,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["search", searchQueryParams],
    queryFn: async () => {
      const res = await searchApi.search(searchQueryParams);
      return res.data as SearchResponse;
    },
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  const results = useMemo(
    () => searchResponse?.results ?? [],
    [searchResponse],
  );
  const totalCount = searchResponse?.total ?? 0;
  const tookMs = searchResponse?.took_ms ?? 0;

  // ── History ──────────────────────────────────────────────────────────────

  const { data: historyItems = [] } = useQuery({
    queryKey: ["search-history"],
    queryFn: async () => {
      const res = await searchApi.listHistory();
      return (res.data ?? []) as SearchHistoryItem[];
    },
    staleTime: 60_000,
  });

  const clearHistoryMutation = useMutation({
    mutationFn: () => searchApi.clearHistory(),
    onSuccess: () => {
      toast.success("Historique efface.");
      queryClient.invalidateQueries({ queryKey: ["search-history"] });
    },
    onError: () => {
      toast.error("Impossible d'effacer l'historique.");
    },
  });

  // ── Saved searches ───────────────────────────────────────────────────────

  const { data: savedSearches = [] } = useQuery({
    queryKey: ["saved-searches"],
    queryFn: async () => {
      const res = await searchApi.listSaved();
      return (res.data ?? []) as SavedSearch[];
    },
    staleTime: 60_000,
  });

  const saveSearchMutation = useMutation({
    mutationFn: searchApi.createSaved,
    onSuccess: () => {
      toast.success("Recherche sauvegardee.");
      setShowSaveDialog(false);
      setSaveName("");
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
    },
    onError: () => {
      toast.error("Impossible de sauvegarder la recherche.");
    },
  });

  const deleteSavedMutation = useMutation({
    mutationFn: searchApi.deleteSaved,
    onSuccess: () => {
      toast.success("Recherche supprimee.");
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
    },
    onError: () => {
      toast.error("Impossible de supprimer la recherche sauvegardee.");
    },
  });

  // ── Keyboard navigation ──────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (results.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        const r = results[selectedIndex];
        if (r?.url) router.push(r.url);
      }
    },
    [results, selectedIndex, router],
  );

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const cards = resultsRef.current.querySelectorAll("[data-result-card]");
      cards[selectedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleNavigate = useCallback(
    (result: SearchResult) => {
      if (result.url) router.push(result.url);
    },
    [router],
  );

  const handleRunSaved = useCallback((s: SavedSearch) => {
    setQuery(s.query);
    setDebouncedQuery(s.query);
    if (s.scope) setActiveScope(s.scope);
  }, []);

  const handleRunHistory = useCallback((h: SearchHistoryItem) => {
    setQuery(h.query);
    setDebouncedQuery(h.query);
    if (h.scope) setActiveScope(h.scope);
  }, []);

  const handleSaveSearch = useCallback(() => {
    if (!saveName.trim()) {
      toast.error("Nom requis");
      return;
    }
    saveSearchMutation.mutate({
      name: saveName.trim(),
      query: debouncedQuery,
      scope: activeScope !== "all" ? activeScope : undefined,
    });
  }, [saveName, debouncedQuery, activeScope, saveSearchMutation]);

  const hasQuery = debouncedQuery.trim().length >= 2;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Search className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Recherche avancee
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Recherchez dans tous les modules de la plateforme.
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              className="pl-10 pr-20 h-12 text-lg"
              placeholder="Rechercher des documents, emails, contacts, evenements..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1"
                onClick={() => {
                  setQuery("");
                  setDebouncedQuery("");
                  setSelectedIndex(-1);
                }}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {isFetching && (
              <Loader2 className="absolute right-10 top-3.5 h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </div>
          {hasQuery && (
            <Button
              variant="outline"
              className="h-12 gap-2 shrink-0"
              onClick={() => {
                setSaveName(debouncedQuery);
                setShowSaveDialog(true);
              }}
            >
              <BookmarkPlus className="h-4 w-4" />
              Sauvegarder
            </Button>
          )}
        </div>

        {/* Scope tabs */}
        <Tabs
          value={activeScope}
          onValueChange={(v) => {
            setActiveScope(v);
            setSelectedIndex(-1);
          }}
        >
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex w-auto">
              {SCOPE_CONFIG.map((scope) => (
                <TabsTrigger
                  key={scope.key}
                  value={scope.key}
                  className="text-xs sm:text-sm gap-1.5"
                >
                  <span className={scope.color}>{scope.icon}</span>
                  <span className="hidden sm:inline">{scope.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value={activeScope} className="mt-4">
            {/* Before search: show history + saved searches */}
            {!hasQuery ? (
              <div className="space-y-6">
                {/* Recent searches */}
                {historyItems.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                          Recherches recentes
                        </h2>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={() => clearHistoryMutation.mutate()}
                        disabled={clearHistoryMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                        Effacer
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {historyItems.slice(0, 10).map((h) => (
                        <button
                          key={h.id}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                          onClick={() => handleRunHistory(h)}
                        >
                          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm flex-1 truncate">
                            {h.query}
                          </span>
                          {h.scope && h.scope !== "all" && (
                            <Badge
                              variant="secondary"
                              className="text-xs shrink-0"
                            >
                              {h.scope}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground shrink-0">
                            {h.result_count} resultat
                            {h.result_count !== 1 ? "s" : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Saved searches */}
                {savedSearches.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Bookmark className="h-4 w-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Recherches sauvegardees
                      </h2>
                    </div>
                    <div className="space-y-1">
                      {savedSearches.map((s) => (
                        <div
                          key={s.id}
                          className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <button
                            className="flex-1 flex items-center gap-3 text-left min-w-0"
                            onClick={() => handleRunSaved(s)}
                          >
                            <Bookmark className="h-4 w-4 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {s.name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {s.query}
                                {s.scope && ` (${s.scope})`}
                              </p>
                            </div>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                            onClick={() => deleteSavedMutation.mutate(s.id)}
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state when no history and no saved */}
                {historyItems.length === 0 && savedSearches.length === 0 && (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                      <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
                      <h3 className="text-lg font-medium text-muted-foreground">
                        Tapez au moins 2 caracteres pour lancer la recherche
                      </h3>
                      <p className="text-sm text-muted-foreground/60 mt-1">
                        Utilisez Ctrl+K pour un acces rapide a la recherche
                        depuis n&apos;importe quelle page.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : isLoading ? (
              /* Loading skeleton */
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : results.length === 0 ? (
              /* No results */
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <h3 className="text-lg font-medium text-muted-foreground">
                    Aucun resultat
                  </h3>
                  <p className="text-sm text-muted-foreground/60 mt-1">
                    Aucun resultat pour &quot;{debouncedQuery}&quot;
                    {activeScope !== "all" && (
                      <>
                        {" "}
                        dans{" "}
                        {SCOPE_CONFIG.find((s) => s.key === activeScope)
                          ?.label ?? activeScope}
                      </>
                    )}
                    . Essayez un autre terme.
                  </p>
                </CardContent>
              </Card>
            ) : (
              /* Results */
              <div ref={resultsRef}>
                {/* Result count + timing */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">
                    {totalCount} resultat{totalCount !== 1 ? "s" : ""}
                    {tookMs > 0 && <span className="ml-1">({tookMs} ms)</span>}
                  </p>
                </div>

                {/* Result cards */}
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <ResultCard
                      key={`${result.entity_type}-${result.id}`}
                      result={result}
                      isSelected={index === selectedIndex}
                      onClick={() => handleNavigate(result)}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Save search dialog */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Sauvegarder la recherche</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Nom de la recherche"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveSearch();
                }}
              />
              <p className="text-xs text-muted-foreground">
                Requete : &quot;
                <span className="font-medium">{debouncedQuery}</span>&quot;
                {activeScope !== "all" && (
                  <span className="ml-1">
                    (scope:{" "}
                    {SCOPE_CONFIG.find((s) => s.key === activeScope)?.label})
                  </span>
                )}
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleSaveSearch}
                disabled={saveSearchMutation.isPending}
              >
                Sauvegarder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

// ─── Result Card ────────────────────────────────────────────────────────────

function ResultCard({
  result,
  isSelected,
  onClick,
}: {
  result: SearchResult;
  isSelected: boolean;
  onClick: () => void;
}) {
  const dateStr = formatDate(result.updated_at);

  return (
    <Card
      data-result-card
      className={`cursor-pointer border-border/50 transition-all hover:border-primary/30 hover:shadow-sm hover:bg-muted/30 active:scale-[0.995] ${
        isSelected ? "ring-2 ring-primary border-primary/40 bg-muted/40" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          {entityIcon(result.entity_type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{result.title}</p>
            {dateStr && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Clock className="h-3 w-3" />
                {dateStr}
              </span>
            )}
          </div>
          {result.snippet && (
            <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">
              {result.snippet}
            </p>
          )}
          <div className="flex gap-2 mt-1.5 flex-wrap">
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${entityBadgeColor(result.entity_type)}`}
            >
              {result.entity_type}
            </span>
            {result.score > 0 && (
              <span className="text-[10px] text-muted-foreground">
                pertinence: {Math.round(result.score * 100)}%
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
      </CardContent>
    </Card>
  );
}
