"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useDesignStore } from "@/stores/design-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ImagePlus, Loader2, ExternalLink } from "lucide-react";
import type { DesignObject } from "./types";
import type * as fabric from "fabric";

interface FabricImageWithId extends fabric.FabricImage {
  id?: string;
}

interface DesignStockPhotosProps {
  fabricCanvasRef: React.MutableRefObject<fabric.Canvas | null>;
}

// ─── Unified image shape ─────────────────────────────────────────────────
interface StockImage {
  id: string;
  title: string;
  url: string; // full size (for insertion)
  thumbnail: string; // for grid preview
  creator: string;
  license: string;
  source: string;
  attribution_url: string;
}

// ─── Source definitions — catalog from foss_photo_libraries ──────────────
type SourceId =
  | "openverse"
  | "wikimedia"
  | "picsum"
  | "unsplash"
  | "pexels"
  | "pixabay";

interface Source {
  id: SourceId;
  label: string;
  description: string;
  requiresKey: boolean;
  keyEnvVar?: string;
  attribution: string;
}

const ALL_SOURCES: Source[] = [
  {
    id: "openverse",
    label: "Openverse",
    description: "800M+ images CC (Flickr, Wikimedia, Smithsonian, MoMA…)",
    requiresKey: false,
    attribution: "https://openverse.org/about",
  },
  {
    id: "wikimedia",
    label: "Wikimedia Commons",
    description: "Fonds libre Wikimedia",
    requiresKey: false,
    attribution: "https://commons.wikimedia.org/wiki/Main_Page",
  },
  {
    id: "picsum",
    label: "Lorem Picsum",
    description: "Placeholders aléatoires (CC0)",
    requiresKey: false,
    attribution: "https://picsum.photos",
  },
  {
    id: "unsplash",
    label: "Unsplash",
    description: "Photographes professionnels — nécessite une clé API",
    requiresKey: true,
    keyEnvVar: "NEXT_PUBLIC_UNSPLASH_KEY",
    attribution: "https://unsplash.com/developers",
  },
  {
    id: "pexels",
    label: "Pexels",
    description: "Photos et vidéos gratuites — nécessite une clé API",
    requiresKey: true,
    keyEnvVar: "NEXT_PUBLIC_PEXELS_KEY",
    attribution: "https://www.pexels.com/api",
  },
  {
    id: "pixabay",
    label: "Pixabay",
    description: "3M+ images — nécessite une clé API",
    requiresKey: true,
    keyEnvVar: "NEXT_PUBLIC_PIXABAY_KEY",
    attribution: "https://pixabay.com/api/docs",
  },
];

const DEFAULT_QUERIES = [
  "office",
  "nature",
  "team",
  "abstract",
  "city",
  "food",
];

// ─── Per-source fetchers ─────────────────────────────────────────────────
// Anonymous Openverse calls no longer accept `license_type=…` filter — it
// returns 401. We keep the query simple and let the user filter client-side.
async function fetchOpenverse(
  query: string,
  page: number = 1,
): Promise<StockImage[]> {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
    query,
  )}&page_size=24&page=${page}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Openverse HTTP ${r.status}`);
  const d = await r.json();
  return (d.results || []).map(
    (x: {
      id: string;
      title?: string;
      url: string;
      thumbnail?: string;
      creator?: string;
      license?: string;
      source?: string;
      foreign_landing_url?: string;
    }) => ({
      id: String(x.id),
      title: x.title ?? "Sans titre",
      url: x.url,
      thumbnail: x.thumbnail ?? x.url,
      creator: x.creator ?? "Inconnu",
      license: (x.license ?? "cc").toUpperCase(),
      source: x.source ?? "openverse",
      attribution_url: x.foreign_landing_url ?? x.url,
    }),
  );
}

async function fetchWikimedia(
  query: string,
  page: number = 1,
): Promise<StockImage[]> {
  // MediaWiki API — search for images via srnamespace=6 (File).
  // Anonymous srlimit max = 50; paginate via sroffset.
  const offset = (page - 1) * 50;
  const search = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&list=search&srnamespace=6&srlimit=50&sroffset=${offset}&srsearch=${encodeURIComponent(
    query,
  )}`;
  const r = await fetch(search);
  if (!r.ok) throw new Error(`Wikimedia HTTP ${r.status}`);
  const d = await r.json();
  const titles = (d.query?.search ?? []).map((x: { title: string }) => x.title);
  if (titles.length === 0) return [];

  // Second call to get thumbnails + URLs
  const info = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400&titles=${encodeURIComponent(
    titles.join("|"),
  )}`;
  const ir = await fetch(info);
  if (!ir.ok) throw new Error(`Wikimedia info HTTP ${ir.status}`);
  const id = await ir.json();
  const pages = Object.values(id.query?.pages ?? {}) as Array<{
    title: string;
    imageinfo?: Array<{
      url: string;
      thumburl?: string;
      descriptionurl?: string;
      extmetadata?: {
        LicenseShortName?: { value?: string };
        Artist?: { value?: string };
      };
    }>;
  }>;

  return pages
    .filter((p) => p.imageinfo && p.imageinfo[0])
    .map((p) => {
      const info = p.imageinfo![0];
      const artist = info.extmetadata?.Artist?.value ?? "";
      const cleanArtist =
        artist.replace(/<[^>]+>/g, "").slice(0, 40) || "Wikimedia";
      return {
        id: p.title,
        title: p.title.replace(/^File:/, ""),
        url: info.url,
        thumbnail: info.thumburl ?? info.url,
        creator: cleanArtist,
        license: info.extmetadata?.LicenseShortName?.value ?? "CC",
        source: "wikimedia",
        attribution_url: info.descriptionurl ?? info.url,
      };
    });
}

function fetchPicsum(query: string, page: number = 1): StockImage[] {
  const seed = query.toLowerCase().replace(/\s/g, "") || "random";
  const offset = (page - 1) * 24;
  return Array.from({ length: 24 }, (_, i) => {
    const idx = offset + i;
    return {
      id: `picsum-${seed}-${idx}`,
      title: `Photo ${idx + 1}`,
      url: `https://picsum.photos/seed/${seed}${idx}/1200/900`,
      thumbnail: `https://picsum.photos/seed/${seed}${idx}/400/300`,
      creator: "Picsum Photos",
      license: "CC0",
      source: "picsum",
      attribution_url: "https://picsum.photos",
    };
  });
}

async function fetchUnsplash(
  query: string,
  key: string,
  page: number = 1,
): Promise<StockImage[]> {
  const r = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      query,
    )}&per_page=24&page=${page}`,
    { headers: { Authorization: `Client-ID ${key}` } },
  );
  if (!r.ok) throw new Error(`Unsplash HTTP ${r.status}`);
  const d = await r.json();
  return (d.results ?? []).map(
    (x: {
      id: string;
      description?: string;
      alt_description?: string;
      urls: { regular: string; small: string };
      user: { name: string; links: { html: string } };
      links: { html: string };
    }) => ({
      id: x.id,
      title: x.description ?? x.alt_description ?? "Unsplash",
      url: x.urls.regular,
      thumbnail: x.urls.small,
      creator: x.user.name,
      license: "Unsplash",
      source: "unsplash",
      attribution_url: x.links.html,
    }),
  );
}

async function fetchPexels(
  query: string,
  key: string,
  page: number = 1,
): Promise<StockImage[]> {
  const r = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(
      query,
    )}&per_page=24&page=${page}`,
    { headers: { Authorization: key } },
  );
  if (!r.ok) throw new Error(`Pexels HTTP ${r.status}`);
  const d = await r.json();
  return (d.photos ?? []).map(
    (x: {
      id: number;
      alt?: string;
      src: { large: string; medium: string };
      photographer: string;
      url: string;
    }) => ({
      id: String(x.id),
      title: x.alt ?? "Pexels photo",
      url: x.src.large,
      thumbnail: x.src.medium,
      creator: x.photographer,
      license: "Pexels",
      source: "pexels",
      attribution_url: x.url,
    }),
  );
}

async function fetchPixabay(
  query: string,
  key: string,
  page: number = 1,
): Promise<StockImage[]> {
  const r = await fetch(
    `https://pixabay.com/api/?key=${encodeURIComponent(
      key,
    )}&q=${encodeURIComponent(query)}&per_page=24&page=${page}&image_type=photo&safesearch=true`,
  );
  if (!r.ok) throw new Error(`Pixabay HTTP ${r.status}`);
  const d = await r.json();
  return (d.hits ?? []).map(
    (x: {
      id: number;
      tags: string;
      webformatURL: string;
      largeImageURL: string;
      user: string;
      pageURL: string;
    }) => ({
      id: String(x.id),
      title: x.tags,
      url: x.largeImageURL,
      thumbnail: x.webformatURL,
      creator: x.user,
      license: "Pixabay",
      source: "pixabay",
      attribution_url: x.pageURL,
    }),
  );
}

// ─── Component ────────────────────────────────────────────────────────────
export default function DesignStockPhotos({
  fabricCanvasRef,
}: DesignStockPhotosProps) {
  const { addObject, pushUndo, currentDesign } = useDesignStore();
  const [source, setSource] = useState<SourceId>("wikimedia");
  const [search, setSearch] = useState("");
  const [insertLoading, setInsertLoading] = useState<string | null>(null);
  const [images, setImages] = useState<StockImage[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Snapshot env vars (statically inlined by Next.js)
  const keys = useMemo(
    () => ({
      unsplash: process.env.NEXT_PUBLIC_UNSPLASH_KEY || "",
      pexels: process.env.NEXT_PUBLIC_PEXELS_KEY || "",
      pixabay: process.env.NEXT_PUBLIC_PIXABAY_KEY || "",
    }),
    [],
  );

  const availableSources = useMemo(
    () =>
      ALL_SOURCES.map((s) => ({
        ...s,
        disabled:
          s.requiresKey &&
          (s.id === "unsplash"
            ? !keys.unsplash
            : s.id === "pexels"
              ? !keys.pexels
              : s.id === "pixabay"
                ? !keys.pixabay
                : false),
      })),
    [keys],
  );

  const currentQuery = useMemo(
    () =>
      search.trim() ||
      DEFAULT_QUERIES[Math.floor(Math.random() * DEFAULT_QUERIES.length)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search, source],
  );

  const runFetch = useCallback(
    async (query: string, pageNum: number, append: boolean) => {
      setFetching(true);
      setError(null);
      try {
        let results: StockImage[] = [];
        switch (source) {
          case "openverse":
            try {
              results = await fetchOpenverse(query, pageNum);
            } catch (e) {
              const msg = e instanceof Error ? e.message : "";
              if (msg.includes("401") || msg.includes("429")) {
                // Rate-limited — fall back to Wikimedia transparently
                setError(
                  "Openverse a limité les requêtes anonymes. Bascule sur Wikimedia...",
                );
                results = await fetchWikimedia(query, pageNum);
              } else {
                throw e;
              }
            }
            break;
          case "wikimedia":
            results = await fetchWikimedia(query, pageNum);
            break;
          case "picsum":
            results = fetchPicsum(query, pageNum);
            break;
          case "unsplash":
            if (!keys.unsplash) throw new Error("Clé Unsplash manquante");
            results = await fetchUnsplash(query, keys.unsplash, pageNum);
            break;
          case "pexels":
            if (!keys.pexels) throw new Error("Clé Pexels manquante");
            results = await fetchPexels(query, keys.pexels, pageNum);
            break;
          case "pixabay":
            if (!keys.pixabay) throw new Error("Clé Pixabay manquante");
            results = await fetchPixabay(query, keys.pixabay, pageNum);
            break;
        }
        setHasMore(results.length >= 20);
        setImages((prev) => {
          const combined = append ? [...prev, ...results] : results;
          // Dedupe by id — some sources return the same asset across pages
          const seen = new Set<string>();
          return combined.filter((img) => {
            if (seen.has(img.id)) return false;
            seen.add(img.id);
            return true;
          });
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        setError(msg);
        if (!append) setImages([]);
        setHasMore(false);
      } finally {
        setFetching(false);
      }
    },
    [source, keys],
  );

  // Reset + fetch on source/query change (debounced)
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    const timer = setTimeout(
      () => runFetch(currentQuery, 1, false),
      search.trim() ? 350 : 0,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuery, source]);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    runFetch(currentQuery, nextPage, true);
  }, [page, currentQuery, runFetch]);

  const handleInsertImage = useCallback(
    async (imageUrl: string) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      setInsertLoading(imageUrl);
      pushUndo();

      try {
        const fabricModule = await import("fabric");
        const img = await fabricModule.FabricImage.fromURL(imageUrl, {
          crossOrigin: "anonymous",
        });

        const maxW = (currentDesign?.format.width || 1080) * 0.6;
        const maxH = (currentDesign?.format.height || 1080) * 0.6;
        const scale = Math.min(
          maxW / (img.width || 1),
          maxH / (img.height || 1),
          1,
        );

        img.set({ scaleX: scale, scaleY: scale, left: 50, top: 50 });
        (img as FabricImageWithId).id = crypto.randomUUID();
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.requestRenderAll();

        const newObj: DesignObject = {
          id: (img as FabricImageWithId).id!,
          type: "image",
          name: "Stock Photo",
          fabricData: img.toObject(["id"]),
          locked: false,
          visible: true,
        };
        addObject(newObj);
      } catch (err) {
        console.error("Failed to insert stock photo:", err);
      } finally {
        setInsertLoading(null);
      }
    },
    [fabricCanvasRef, addObject, pushUndo, currentDesign],
  );

  const activeSource = ALL_SOURCES.find((s) => s.id === source)!;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Bibliothèque libre
      </p>

      {/* Source selector */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground">
          Source
        </label>
        <Select value={source} onValueChange={(v) => setSource(v as SourceId)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableSources.map((s) => (
              <SelectItem
                key={s.id}
                value={s.id}
                disabled={s.disabled}
                className="text-xs"
              >
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-medium">
                    {s.label}
                    {s.disabled && (
                      <span className="ml-1 text-[9px] text-muted-foreground">
                        (clé requise)
                      </span>
                    )}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground leading-tight">
          {activeSource.description}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher nature, bureau, ville..."
          className="h-8 text-xs pl-8"
        />
        {fetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Upload own */}
      <Button
        variant="outline"
        size="sm"
        className="w-full h-8 text-xs gap-1.5"
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              handleInsertImage(ev.target?.result as string);
            };
            reader.readAsDataURL(file);
          };
          input.click();
        }}
      >
        <ImagePlus className="h-3.5 w-3.5" />
        Importer une image
      </Button>

      {error && (
        <p className="text-[10px] text-destructive/80 bg-destructive/5 border border-destructive/20 rounded-md px-2 py-1.5">
          {error}
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {images.map((img) => (
          <button
            key={img.id}
            onClick={() => handleInsertImage(img.url)}
            disabled={insertLoading === img.url}
            title={`${img.title} — ${img.creator} (${img.license})`}
            className="relative rounded-md overflow-hidden border border-border hover:border-primary/50 transition-all group aspect-[4/3] bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.thumbnail}
              alt={img.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
              }}
            />
            {insertLoading === img.url && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <ImagePlus className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
            </div>
            <span className="absolute bottom-1 right-1 text-[9px] px-1.5 py-0.5 rounded bg-black/60 text-white font-medium backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
              {img.license}
            </span>
          </button>
        ))}
      </div>

      {!fetching && images.length === 0 && !error && (
        <p className="text-xs text-center text-muted-foreground py-8">
          Aucun résultat
        </p>
      )}

      {/* Load more button */}
      {images.length > 0 && hasMore && (
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs gap-1.5"
          onClick={loadMore}
          disabled={fetching}
        >
          {fetching ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Chargement...
            </>
          ) : (
            <>Charger plus ({images.length} affichées)</>
          )}
        </Button>
      )}

      <a
        href={activeSource.attribution}
        target="_blank"
        rel="noreferrer"
        className="text-[10px] text-center text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 pt-1"
      >
        Source : {activeSource.label}
        <ExternalLink className="h-2.5 w-2.5" />
      </a>
    </div>
  );
}
