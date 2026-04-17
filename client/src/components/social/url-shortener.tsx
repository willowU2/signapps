"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Link, Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { socialApi, ShortUrl } from "@/lib/api/social";
import { getServiceBaseUrl, ServiceName } from "@/lib/api/factory";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type ShortenPreference = "always" | "never" | "ask";

interface ShortenedEntry {
  original: string;
  short: string;
  clicks: number;
}

const SETTINGS_KEY = "signsocial-url-shortener-settings";

// URL regex -- matches http(s) links in text
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadPreference(): ShortenPreference {
  if (typeof window === "undefined") return "ask";
  try {
    const v = localStorage.getItem(SETTINGS_KEY);
    if (v === "always" || v === "never" || v === "ask") return v;
  } catch {
    // ignore
  }
  return "ask";
}

function savePreference(pref: ShortenPreference) {
  try {
    localStorage.setItem(SETTINGS_KEY, pref);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Hook: useUrlShortener
// ---------------------------------------------------------------------------

export function useUrlShortener(content: string) {
  const [preference, setPreference] = useState<ShortenPreference>("ask");
  const [shortenedMap, setShortenedMap] = useState<
    Record<string, ShortenedEntry>
  >({});
  const [shortening, setShortening] = useState(false);

  // Ref to always have latest shortenedMap available (avoids stale closures)
  const shortenedMapRef = useRef(shortenedMap);
  shortenedMapRef.current = shortenedMap;

  // Load preference on mount
  useEffect(() => {
    setPreference(loadPreference());
  }, []);

  // Load existing short URLs from API on mount and seed the map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await socialApi.shortUrls.list();
        if (cancelled) return;
        const map: Record<string, ShortenedEntry> = {};
        for (const su of res.data) {
          map[su.originalUrl] = {
            original: su.originalUrl,
            short:
              su.shortUrl ||
              `${getServiceBaseUrl(ServiceName.SOCIAL)}/s/${su.shortCode}`,
            clicks: su.clickCount,
          };
        }
        setShortenedMap(map);
      } catch {
        // silent -- API may not be up
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Detect URLs in content
  const detectedUrls = useMemo(() => {
    const matches = content.match(URL_REGEX);
    return matches ? [...new Set(matches)] : [];
  }, [content]);

  // Update preference
  const updatePreference = useCallback((pref: ShortenPreference) => {
    setPreference(pref);
    savePreference(pref);
  }, []);

  // Shorten a single URL via the API
  const shortenUrl = useCallback(
    async (url: string): Promise<ShortenedEntry> => {
      const existing = shortenedMapRef.current[url];
      if (existing) return existing;

      setShortening(true);
      try {
        const res = await socialApi.shortUrls.create({ originalUrl: url });
        const entry: ShortenedEntry = {
          original: url,
          short:
            res.data.shortUrl ||
            `${getServiceBaseUrl(ServiceName.SOCIAL)}/s/${res.data.shortCode}`,
          clicks: res.data.clickCount,
        };
        setShortenedMap((prev) => ({ ...prev, [url]: entry }));
        return entry;
      } catch {
        toast.error("Failed to shorten URL");
        throw new Error("Failed to shorten URL");
      } finally {
        setShortening(false);
      }
    },
    [],
  );

  // Shorten all detected URLs via the API
  const shortenAll = useCallback(async (): Promise<
    Record<string, ShortenedEntry>
  > => {
    setShortening(true);
    const currentMap = { ...shortenedMapRef.current };
    try {
      for (const url of detectedUrls) {
        if (!currentMap[url]) {
          const res = await socialApi.shortUrls.create({ originalUrl: url });
          currentMap[url] = {
            original: url,
            short:
              res.data.shortUrl ||
              `${getServiceBaseUrl(ServiceName.SOCIAL)}/s/${res.data.shortCode}`,
            clicks: res.data.clickCount,
          };
        }
      }
      setShortenedMap(currentMap);
      return currentMap;
    } catch {
      toast.error("Failed to shorten some URLs");
      // Still update with whatever we got
      setShortenedMap(currentMap);
      return currentMap;
    } finally {
      setShortening(false);
    }
  }, [detectedUrls]);

  // Apply shortening to content -- replace original URLs with short ones
  const applyShortening = useCallback(
    (text: string, map?: Record<string, ShortenedEntry>): string => {
      const useMap = map || shortenedMapRef.current;
      let result = text;
      for (const url of detectedUrls) {
        const entry = useMap[url];
        if (entry) {
          result = result.replaceAll(url, entry.short);
        }
      }
      return result;
    },
    [detectedUrls],
  );

  // Whether shortening is active based on preference
  const isActive = preference === "always";

  return {
    preference,
    updatePreference,
    detectedUrls,
    shortenedMap,
    shortenUrl,
    shortenAll,
    applyShortening,
    isActive,
    shortening,
  };
}

// ---------------------------------------------------------------------------
// UrlShortenerPopover -- toolbar button + popover
// ---------------------------------------------------------------------------

interface UrlShortenerPopoverProps {
  content: string;
  onContentChange: (newContent: string) => void;
}

export function UrlShortenerPopover({
  content,
  onContentChange,
}: UrlShortenerPopoverProps) {
  const {
    preference,
    updatePreference,
    detectedUrls,
    shortenedMap,
    shortenUrl,
    shortenAll,
    applyShortening,
    shortening,
  } = useUrlShortener(content);

  const [open, setOpen] = useState(false);

  const handleShortenAll = async () => {
    const updatedMap = await shortenAll();
    const result = applyShortening(content, updatedMap);
    if (result !== content) {
      onContentChange(result);
      toast.success("All URLs shortened");
    }
  };

  const handleShortenSingle = async (url: string) => {
    try {
      const entry = await shortenUrl(url);
      const result = content.replaceAll(url, entry.short);
      if (result !== content) {
        onContentChange(result);
        toast.success("URL shortened");
      }
    } catch {
      // error already toasted inside shortenUrl
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copié dans le presse-papiers"),
      () => toast.error("Impossible de copier"),
    );
  };

  const shortenedCount = detectedUrls.filter((u) => !!shortenedMap[u]).length;
  const hasUrls = detectedUrls.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          title="Link shortener"
        >
          <Link className="h-4 w-4" />
          {hasUrls && (
            <Badge variant="secondary" className="h-5 min-w-5 px-1 text-xs">
              {detectedUrls.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-4" align="start">
        <div>
          <h4 className="font-semibold text-sm">Link Shortener</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Shorten URLs in your post to track clicks
          </p>
        </div>

        <Separator />

        {/* Preference setting */}
        <div className="space-y-3">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Default Behavior
          </Label>
          <div className="space-y-2">
            {(["always", "ask", "never"] as ShortenPreference[]).map((pref) => {
              const labels: Record<ShortenPreference, string> = {
                always: "Always shorten",
                ask: "Ask every time",
                never: "Never shorten",
              };
              return (
                <label
                  key={pref}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                    preference === pref
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="shorten-preference"
                    value={pref}
                    checked={preference === pref}
                    onChange={() => updatePreference(pref)}
                    className="accent-primary"
                  />
                  <span className="text-sm">{labels[pref]}</span>
                </label>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Detected URLs */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Detected Links ({detectedUrls.length})
            </Label>
            {detectedUrls.length > 1 &&
              shortenedCount < detectedUrls.length && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={handleShortenAll}
                  disabled={shortening}
                >
                  {shortening ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : null}
                  Shorten All
                </Button>
              )}
          </div>

          {detectedUrls.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No URLs detected in your post content.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {detectedUrls.map((url) => {
                const entry = shortenedMap[url];
                const isShortened = !!entry;
                return (
                  <div
                    key={url}
                    className="rounded-md border p-2 space-y-1.5 text-xs"
                  >
                    <div className="flex items-start gap-1.5">
                      <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                      <span
                        className="break-all text-muted-foreground line-through"
                        title={url}
                      >
                        {url.length > 60 ? url.slice(0, 60) + "..." : url}
                      </span>
                    </div>
                    {isShortened ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Link className="h-3 w-3 text-primary" />
                          <span className="font-medium text-primary">
                            {entry.short}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-xs h-5">
                            {entry.clicks} clicks
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => handleCopy(entry.short)}
                            title="Copy short URL"
                            aria-label="Copy short URL"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs w-full"
                        onClick={() => handleShortenSingle(url)}
                        disabled={shortening}
                      >
                        {shortening ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : null}
                        Shorten this link
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
