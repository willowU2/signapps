"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Star,
  Trash2,
  ExternalLink,
  BookmarkX,
  Search,
  SortAsc,
  SortDesc,
  Clock,
  FolderPlus,
  Folder,
  Plus,
  X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";
import {
  bookmarksApi,
  bookmarkCollectionsApi,
  type Bookmark as ApiBookmark,
  type BookmarkCollection,
} from "@/lib/api/bookmarks";
import Link from "next/link";

const client = () => getClient(ServiceName.IDENTITY);

// ─── Legacy local Bookmark type (used by StarButton & other modules) ────────

export interface Bookmark {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_title: string;
  entity_url?: string;
  created_at: string;
  source?: "api" | "local";
}

// ─── Mapping helpers ────────────────────────────────────────────────────────

const MODULE_HREFS: Record<string, (id: string) => string> = {
  document: (id) => `/docs/${id}`,
  drive_node: (id) => `/drive/${id}`,
  mail_message: (id) => `/mail/${id}`,
  calendar_event: (id) => `/calendar/${id}`,
  contact: (id) => `/contacts/${id}`,
  task: (id) => `/tasks/${id}`,
  spreadsheet: (id) => `/sheets/${id}`,
  presentation: (id) => `/slides/${id}`,
};

const MODULE_ICONS: Record<string, string> = {
  document: "\u{1F4C4}",
  drive_node: "\u{1F4C1}",
  mail_message: "\u{2709}\u{FE0F}",
  calendar_event: "\u{1F4C5}",
  contact: "\u{1F464}",
  task: "\u{2705}",
  form_response: "\u{1F4DD}",
  chat_message: "\u{1F4AC}",
  spreadsheet: "\u{1F4CA}",
  presentation: "\u{1F4FD}\u{FE0F}",
};

const MODULE_LABELS: Record<string, string> = {
  document: "Documents",
  drive_node: "Drive",
  mail_message: "Emails",
  calendar_event: "Evenements",
  contact: "Contacts",
  task: "Taches",
  form_response: "Formulaires",
  chat_message: "Messages",
  spreadsheet: "Feuilles",
  presentation: "Presentations",
};

/** Map API Bookmark to local display Bookmark */
function toDisplayBookmark(b: ApiBookmark): Bookmark {
  return {
    id: b.id,
    entity_type: b.entity_type,
    entity_id: b.entity_id,
    entity_title: b.title,
    entity_url: b.url,
    created_at: b.created_at,
    source: "api",
  };
}

// ─── localStorage bookmark helpers ──────────────────────────────────────────

const LOCAL_STORAGE_KEY = "signapps-bookmarks";

function getLocalBookmarks(): Bookmark[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalBookmarks(bookmarks: Bookmark[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bookmarks));
}

export function addLocalBookmark(
  bookmark: Omit<Bookmark, "id" | "created_at" | "source">,
) {
  const existing = getLocalBookmarks();
  const already = existing.find(
    (b) =>
      b.entity_type === bookmark.entity_type &&
      b.entity_id === bookmark.entity_id,
  );
  if (already) return already;

  const newBookmark: Bookmark = {
    ...bookmark,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
    source: "local",
  };
  existing.push(newBookmark);
  saveLocalBookmarks(existing);
  return newBookmark;
}

export function removeLocalBookmark(id: string) {
  const existing = getLocalBookmarks();
  saveLocalBookmarks(existing.filter((b) => b.id !== id));
}

export function isLocalBookmarked(
  entityType: string,
  entityId: string,
): boolean {
  const existing = getLocalBookmarks();
  return existing.some(
    (b) => b.entity_type === entityType && b.entity_id === entityId,
  );
}

// ─── StarButton ─────────────────────────────────────────────────────────────

interface StarButtonProps {
  entityType: string;
  entityId: string;
  entityTitle: string;
  entityUrl?: string;
}

export function StarButton({
  entityType,
  entityId,
  entityTitle,
  entityUrl,
}: StarButtonProps) {
  const [starred, setStarred] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    client()
      .get<ApiBookmark[]>("/bookmarks", {
        params: { entity_type: entityType, entity_id: entityId },
      })
      .then(({ data }) => {
        if (data.length > 0) {
          setStarred(true);
          setBookmarkId(data[0].id);
        } else if (isLocalBookmarked(entityType, entityId)) {
          const local = getLocalBookmarks().find(
            (b) => b.entity_type === entityType && b.entity_id === entityId,
          );
          if (local) {
            setStarred(true);
            setBookmarkId(local.id);
          }
        }
      })
      .catch(() => {
        if (isLocalBookmarked(entityType, entityId)) {
          const local = getLocalBookmarks().find(
            (b) => b.entity_type === entityType && b.entity_id === entityId,
          );
          if (local) {
            setStarred(true);
            setBookmarkId(local.id);
          }
        }
      });
  }, [entityType, entityId]);

  const toggle = async () => {
    if (starred && bookmarkId) {
      try {
        if (bookmarkId.startsWith("local-")) {
          removeLocalBookmark(bookmarkId);
        } else {
          await bookmarksApi.remove(bookmarkId);
        }
        setStarred(false);
        setBookmarkId(null);
        queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
        toast.success("Favori retire");
      } catch {
        removeLocalBookmark(bookmarkId);
        setStarred(false);
        setBookmarkId(null);
        toast.success("Favori retire");
      }
    } else {
      try {
        const { data } = await bookmarksApi.create({
          entity_type: entityType,
          entity_id: entityId,
          title: entityTitle,
          url: entityUrl,
        });
        setStarred(true);
        setBookmarkId(data.id);
        queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
        toast.success("Ajoute aux favoris");
      } catch {
        const local = addLocalBookmark({
          entity_type: entityType,
          entity_id: entityId,
          entity_title: entityTitle,
          entity_url: entityUrl,
        });
        if (local) {
          setStarred(true);
          setBookmarkId(local.id);
          toast.success("Ajoute aux favoris (local)");
        }
      }
    }
  };

  return (
    <Button size="sm" variant="ghost" onClick={toggle} className="h-7 w-7 p-0">
      <Star
        className={`w-4 h-4 transition-colors ${starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
      />
    </Button>
  );
}

// ─── BookmarksPage ──────────────────────────────────────────────────────────

export function BookmarksPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("all");
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "alpha">(
    "newest",
  );
  const [newCollectionName, setNewCollectionName] = useState("");
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [deleteCollectionId, setDeleteCollectionId] = useState<string | null>(
    null,
  );

  // ── Queries ─────────────────────────────────────────────────────────────

  const { data: apiBookmarks = [], isLoading: bookmarksLoading } = useQuery<
    Bookmark[]
  >({
    queryKey: [
      "bookmarks",
      collectionFilter,
      typeFilter !== "all" ? typeFilter : undefined,
    ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (collectionFilter) params.collection_id = collectionFilter;
      if (typeFilter !== "all") params.entity_type = typeFilter;
      const { data } = await bookmarksApi.list(params);
      return (data || []).map(toDisplayBookmark);
    },
    staleTime: 30_000,
  });

  const { data: collections = [], isLoading: collectionsLoading } = useQuery<
    BookmarkCollection[]
  >({
    queryKey: ["bookmark-collections"],
    queryFn: async () => {
      const { data } = await bookmarkCollectionsApi.list();
      return data || [];
    },
    staleTime: 60_000,
  });

  // Merge API bookmarks with any remaining localStorage bookmarks
  const bookmarks = useMemo(() => {
    const localBookmarks = getLocalBookmarks();
    const apiKeys = new Set(
      apiBookmarks.map((b) => `${b.entity_type}:${b.entity_id}`),
    );
    const uniqueLocal = localBookmarks.filter(
      (b) => !apiKeys.has(`${b.entity_type}:${b.entity_id}`),
    );
    // Apply type filter to local bookmarks too
    const filteredLocal =
      typeFilter === "all"
        ? uniqueLocal
        : uniqueLocal.filter((b) => b.entity_type === typeFilter);
    return [...apiBookmarks, ...filteredLocal];
  }, [apiBookmarks, typeFilter]);

  // ── Mutations ───────────────────────────────────────────────────────────

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith("local-")) {
        removeLocalBookmark(id);
      } else {
        await bookmarksApi.remove(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast.success("Favori retire");
    },
    onError: () => {
      toast.error("Impossible de supprimer le favori");
    },
  });

  const createCollectionMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await bookmarkCollectionsApi.create({ name });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmark-collections"] });
      setNewCollectionName("");
      setIsCreateCollectionOpen(false);
      toast.success("Collection creee");
    },
    onError: () => {
      toast.error("Impossible de creer la collection");
    },
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: async (id: string) => {
      await bookmarkCollectionsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmark-collections"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      if (collectionFilter === deleteCollectionId) setCollectionFilter(null);
      setDeleteCollectionId(null);
      toast.success("Collection supprimee");
    },
    onError: () => {
      toast.error("Impossible de supprimer la collection");
      setDeleteCollectionId(null);
    },
  });

  // ── Derived data ────────────────────────────────────────────────────────

  const types = useMemo(
    () => [...new Set(bookmarks.map((b) => b.entity_type))],
    [bookmarks],
  );

  const filtered = useMemo(() => {
    let result = bookmarks;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.entity_title.toLowerCase().includes(q) ||
          b.entity_type.toLowerCase().includes(q),
      );
    }

    result = [...result].sort((a, b) => {
      if (sortOrder === "alpha")
        return a.entity_title.localeCompare(b.entity_title, "fr");
      if (sortOrder === "oldest")
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    return result;
  }, [bookmarks, searchQuery, sortOrder]);

  const isLoading = bookmarksLoading && bookmarks.length === 0;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Collections sidebar-style row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant={collectionFilter === null ? "default" : "outline"}
          onClick={() => setCollectionFilter(null)}
          className="h-7 gap-1.5"
        >
          <Star className="h-3 w-3" /> Tous les favoris
        </Button>
        {collectionsLoading ? (
          <>
            <Skeleton className="h-7 w-24 rounded-md" />
            <Skeleton className="h-7 w-20 rounded-md" />
          </>
        ) : (
          collections.map((c) => (
            <div key={c.id} className="flex items-center gap-0.5">
              <Button
                size="sm"
                variant={collectionFilter === c.id ? "default" : "outline"}
                onClick={() => setCollectionFilter(c.id)}
                className="h-7 gap-1.5"
              >
                <Folder className="h-3 w-3" /> {c.name}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteCollectionId(c.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5"
          onClick={() => setIsCreateCollectionOpen(true)}
        >
          <FolderPlus className="h-3 w-3" /> Nouvelle collection
        </Button>
      </div>

      {/* Search and sort controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans les favoris..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5"
          onClick={() =>
            setSortOrder((s) =>
              s === "newest" ? "oldest" : s === "oldest" ? "alpha" : "newest",
            )
          }
        >
          {sortOrder === "newest" && (
            <>
              <SortDesc className="h-3.5 w-3.5" /> Recent
            </>
          )}
          {sortOrder === "oldest" && (
            <>
              <SortAsc className="h-3.5 w-3.5" /> Ancien
            </>
          )}
          {sortOrder === "alpha" && (
            <>
              <SortAsc className="h-3.5 w-3.5" /> A-Z
            </>
          )}
        </Button>
      </div>

      {/* Type filter tabs */}
      <Tabs value={typeFilter} onValueChange={setTypeFilter}>
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs h-7 px-3">
            Tous ({bookmarks.length})
          </TabsTrigger>
          {types.map((t) => {
            const count = bookmarks.filter((b) => b.entity_type === t).length;
            return (
              <TabsTrigger key={t} value={t} className="text-xs h-7 px-3">
                {MODULE_ICONS[t] || "\u{1F516}"} {MODULE_LABELS[t] || t} (
                {count})
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg border"
            >
              <Skeleton className="h-6 w-6 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-7 w-7 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-400px)]">
          <div className="space-y-2 pr-2">
            {filtered.map((b) => {
              const href =
                b.entity_url ||
                MODULE_HREFS[b.entity_type]?.(b.entity_id) ||
                "#";
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                >
                  <span className="text-lg">
                    {MODULE_ICONS[b.entity_type] || "\u{1F516}"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">
                        {b.entity_title}
                      </p>
                      {b.source === "local" && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-4 px-1.5 shrink-0"
                        >
                          local
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <span>
                        {MODULE_LABELS[b.entity_type] || b.entity_type}
                      </span>
                      <span>&middot;</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(b.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      asChild
                    >
                      <Link href={href}>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(b.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BookmarkX className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">
                  {searchQuery ? "Aucun favori correspondant" : "Aucun favori"}
                </p>
                {!searchQuery && (
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Cliquez sur l&apos;etoile dans n&apos;importe quel module
                    pour ajouter un favori
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Create collection dialog */}
      <Dialog
        open={isCreateCollectionOpen}
        onOpenChange={setIsCreateCollectionOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="collection-name">Nom de la collection</Label>
              <Input
                id="collection-name"
                placeholder="Ex: Projets importants..."
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCollectionName.trim()) {
                    createCollectionMutation.mutate(newCollectionName.trim());
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateCollectionOpen(false)}
            >
              Annuler
            </Button>
            <Button
              disabled={
                !newCollectionName.trim() || createCollectionMutation.isPending
              }
              onClick={() =>
                createCollectionMutation.mutate(newCollectionName.trim())
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Creer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete collection confirmation */}
      <AlertDialog
        open={!!deleteCollectionId}
        onOpenChange={() => setDeleteCollectionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette collection ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les favoris de cette collection ne seront pas supprimes, mais ils
              perdront leur association.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteCollectionId)
                  deleteCollectionMutation.mutate(deleteCollectionId);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
