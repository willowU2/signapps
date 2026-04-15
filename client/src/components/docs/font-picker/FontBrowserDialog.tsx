"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Fuse from "fuse.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { useFontsCatalog } from "@/lib/fonts/use-fonts-catalog";
import { ensureFontLoaded } from "@/lib/fonts/use-dynamic-font";
import type { FontCategory, FontFamily } from "@/lib/fonts/types";

const CATEGORIES: FontCategory[] = [
  "sans-serif",
  "serif",
  "monospace",
  "display",
  "handwriting",
  "programming",
];

const FAVORITES_KEY = "signapps_fonts_favorites";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: string;
  onSelect: (familyId: string) => void;
}

export function FontBrowserDialog({
  open,
  onOpenChange,
  value,
  onSelect,
}: Props) {
  const { data: catalog } = useFontsCatalog();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<FontCategory>>(
    new Set(),
  );
  const [favoritesVersion, setFavoritesVersion] = useState(0);
  const parentRef = useRef<HTMLDivElement>(null);

  // Debounce search input by 150ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(timer);
  }, [search]);

  const favorites = useMemo<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const list: string[] = JSON.parse(
        localStorage.getItem(FAVORITES_KEY) ?? "[]",
      );
      return new Set(list);
    } catch {
      return new Set();
    }
    // favoritesVersion is a dep so we re-read on toggle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favoritesVersion]);

  const fuse = useMemo(
    () =>
      catalog
        ? new Fuse(catalog.families, {
            keys: ["name", "foundry", "category"],
            threshold: 0.3,
          })
        : null,
    [catalog],
  );

  const filtered = useMemo<FontFamily[]>(() => {
    if (!catalog) return [];
    let list = catalog.families;
    if (debouncedSearch.trim()) {
      list = fuse ? fuse.search(debouncedSearch).map((r) => r.item) : list;
    }
    if (activeCategories.size > 0) {
      list = list.filter((f) => activeCategories.has(f.category));
    }
    return list;
  }, [catalog, fuse, debouncedSearch, activeCategories]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 8,
  });

  const toggleCategory = (cat: FontCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window === "undefined") return;
    let list: string[] = [];
    try {
      list = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
    } catch {
      list = [];
    }
    const next = list.includes(id)
      ? list.filter((x) => x !== id)
      : [...list, id];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    setFavoritesVersion((v) => v + 1);
  };

  const activeName = catalog?.families.find((f) => f.id === value)?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Toutes les polices ({catalog?.total ?? 0})</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2 border-b border-border">
          <Input
            placeholder="Rechercher une police..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((cat) => (
              <Badge
                key={cat}
                variant={activeCategories.has(cat) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>

        {!catalog ? (
          <div className="flex-1 flex items-center justify-center text-center px-6">
            <p className="text-sm text-muted-foreground">
              Catalogue de polices non disponible.
              <br />
              Lancez <code className="bg-muted px-1 py-0.5 rounded">scripts/sync-fonts</code>.
            </p>
          </div>
        ) : (
          <div ref={parentRef} className="flex-1 overflow-y-auto">
            <div
              style={{
                height: virtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((vRow) => {
                const fam = filtered[vRow.index];
                if (!fam) return null;
                const isFavorite = favorites.has(fam.id);
                return (
                  <div
                    key={fam.id}
                    className="absolute left-0 right-0 px-3 py-2 hover:bg-muted/50 cursor-pointer flex items-center justify-between border-b border-border"
                    style={{
                      transform: `translateY(${vRow.start}px)`,
                      height: vRow.size,
                    }}
                    onMouseEnter={() => ensureFontLoaded(fam.id, catalog)}
                    onClick={() => {
                      onSelect(fam.id);
                      onOpenChange(false);
                    }}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs text-muted-foreground">
                        {fam.category} · {fam.source}
                      </span>
                      <span
                        className="text-lg truncate"
                        style={{ fontFamily: fam.name }}
                      >
                        {fam.name} — The quick brown fox
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => toggleFavorite(fam.id, e)}
                      aria-label={
                        isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"
                      }
                    >
                      <Star
                        className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`}
                      />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
          <span>
            {filtered.length} police{filtered.length > 1 ? "s" : ""}
          </span>
          <span>{activeName ? `Active : ${activeName}` : ""}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
