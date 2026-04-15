"use client";

// IDEA-118: Search autocomplete — suggest completions as user types
// IDEA-119: Recent searches history — persist and show last 10 searches

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { Search, Clock, TrendingUp, X } from "lucide-react";
import { useOmniStore } from "@/stores/omni-store";
import { cn } from "@/lib/utils";

const RECENT_KEY = "omni_recent_searches";
const MAX_RECENT = 10;

// Popular queries — hardcoded suggestions as fallback
const POPULAR_QUERIES = [
  "emails non lus",
  "tâches en cours",
  "calendrier aujourd'hui",
  "documents récents",
  "membres de l'équipe",
];

export function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(query: string) {
  if (!query.trim()) return;
  try {
    const prev = loadRecentSearches();
    const next = [query, ...prev.filter((q) => q !== query)].slice(
      0,
      MAX_RECENT,
    );
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Silently fail
  }
}

export function clearRecentSearches() {
  localStorage.removeItem(RECENT_KEY);
}

interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchAutocomplete({
  value,
  onChange,
  onSubmit,
  placeholder = "Rechercher…",
  className,
}: SearchAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecents(loadRecentSearches());
  }, [open]);

  // Autocomplete suggestions — filter recents + popular by current query
  const suggestions = value.trim()
    ? [
        ...recents.filter(
          (r) => r.toLowerCase().includes(value.toLowerCase()) && r !== value,
        ),
        ...POPULAR_QUERIES.filter(
          (p) =>
            p.toLowerCase().includes(value.toLowerCase()) &&
            !recents.includes(p),
        ),
      ].slice(0, 8)
    : recents.slice(0, 5);

  const handleSelect = (suggestion: string) => {
    onChange(suggestion);
    saveRecentSearch(suggestion);
    setRecents(loadRecentSearches());
    onSubmit(suggestion);
    setOpen(false);
    setHighlighted(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, -1));
    } else if (e.key === "Enter") {
      if (highlighted >= 0 && suggestions[highlighted]) {
        e.preventDefault();
        handleSelect(suggestions[highlighted]);
      } else {
        if (value.trim()) {
          saveRecentSearch(value.trim());
          setRecents(loadRecentSearches());
        }
        onSubmit(value);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleRemoveRecent = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    const next = loadRecentSearches().filter((q) => q !== query);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    setRecents(next);
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setHighlighted(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 h-9 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {open && (suggestions.length > 0 || recents.length === 0) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full mt-1 w-full rounded-lg border bg-popover shadow-lg overflow-hidden"
        >
          {/* Section header */}
          {!value.trim() && recents.length > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Recherches récentes
              </span>
              <button
                onClick={() => {
                  clearRecentSearches();
                  setRecents([]);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Effacer
              </button>
            </div>
          )}

          {suggestions.length === 0 && value.trim() && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Appuyez sur Entrée pour rechercher &ldquo;{value}&rdquo;
            </div>
          )}

          {suggestions.map((s, i) => {
            const isRecent = recents.includes(s);
            return (
              <button
                key={s}
                onMouseDown={() => handleSelect(s)}
                onMouseEnter={() => setHighlighted(i)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left",
                  highlighted === i ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                {isRecent ? (
                  <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                )}
                <span className="flex-1 truncate">{s}</span>
                {isRecent && (
                  <span
                    onMouseDown={(e) => handleRemoveRecent(e, s)}
                    className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
