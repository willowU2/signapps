"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Clock, TrendingUp, AlertCircle, Search } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchSuggestion {
  type: "recent" | "autocomplete" | "correction";
  text: string;
  original?: string; // for corrections
}

const RECENT_SEARCHES_KEY = "signapps_recent_searches";
const MAX_RECENT = 5;

// ─── Edit distance (Levenshtein) ──────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Sample dictionary for "did you mean" suggestions
const DICTIONARY = [
  "contrat",
  "contact",
  "document",
  "facture",
  "devis",
  "projet",
  "tache",
  "email",
  "calendrier",
  "reunion",
  "rapport",
  "workflow",
  "archive",
  "client",
  "fournisseur",
  "commande",
  "livraison",
  "paiement",
  "budget",
];

function didYouMean(query: string): string | null {
  if (query.length < 3) return null;
  const lower = query.toLowerCase();
  let best: string | null = null;
  let bestDist = Infinity;
  for (const word of DICTIONARY) {
    const dist = levenshtein(lower, word);
    const threshold = Math.ceil(word.length / 4);
    if (dist > 0 && dist <= threshold && dist < bestDist) {
      bestDist = dist;
      best = word;
    }
  }
  return best;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

export function addRecentSearch(query: string) {
  if (!query.trim()) return;
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const current: string[] = raw ? JSON.parse(raw) : [];
    const filtered = current.filter((q) => q !== query);
    const updated = [query, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
}

function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SearchSuggestionsProps {
  query: string;
  isOpen: boolean;
  onSelect: (text: string) => void;
  onClose: () => void;
  apiSuggestions?: string[];
  className?: string;
}

export function SearchSuggestions({
  query,
  isOpen,
  onSelect,
  onClose,
  apiSuggestions = [],
  className = "",
}: SearchSuggestionsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [recentSearches] = useState<string[]>(loadRecentSearches);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const suggestions = useCallback((): SearchSuggestion[] => {
    const result: SearchSuggestion[] = [];

    if (!query.trim()) {
      // Show recent searches when no query
      recentSearches.forEach((q) => result.push({ type: "recent", text: q }));
      return result;
    }

    // Autocomplete from API suggestions
    apiSuggestions
      .filter((s) => s.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 4)
      .forEach((s) => result.push({ type: "autocomplete", text: s }));

    // Recent searches matching query
    recentSearches
      .filter(
        (q) => q.toLowerCase().includes(query.toLowerCase()) && q !== query,
      )
      .slice(0, 2)
      .forEach((q) => result.push({ type: "recent", text: q }));

    // Did you mean?
    const correction = didYouMean(query);
    if (correction) {
      result.push({ type: "correction", text: correction, original: query });
    }

    return result;
  }, [query, recentSearches, apiSuggestions])();

  if (!isOpen || suggestions.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={`absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg z-50 overflow-hidden ${className}`}
    >
      <ul>
        {suggestions.map((s, i) => (
          <li key={`${s.type}-${i}`}>
            <button
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/60 transition-colors text-left"
              onClick={() => {
                onSelect(s.text);
                addRecentSearch(s.text);
              }}
            >
              {s.type === "recent" && (
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              {s.type === "autocomplete" && (
                <Search className="h-4 w-4 text-primary shrink-0" />
              )}
              {s.type === "correction" && (
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              )}

              <span className="flex-1 min-w-0">
                {s.type === "correction" ? (
                  <span>
                    Vouliez-vous dire &ldquo;
                    <strong className="text-primary">{s.text}</strong>&rdquo; ?
                  </span>
                ) : (
                  <span>{s.text}</span>
                )}
              </span>

              {s.type === "recent" && (
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Smart search input with suggestions ─────────────────────────────────────

interface SmartSearchInputProps {
  value: string;
  onChange: (v: string) => void;
  onSearch: (query: string) => void;
  placeholder?: string;
  apiSuggestions?: string[];
  className?: string;
}

export function SmartSearchInput({
  value,
  onChange,
  onSearch,
  placeholder = "Rechercher...",
  apiSuggestions = [],
  className = "",
}: SmartSearchInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (text: string) => {
      onChange(text);
      setShowSuggestions(false);
      onSearch(text);
    },
    [onChange, onSearch],
  );

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setShowSuggestions(false);
              onSearch(value);
              addRecentSearch(value);
            }
            if (e.key === "Escape") setShowSuggestions(false);
          }}
          placeholder={placeholder}
          className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <SearchSuggestions
        query={value}
        isOpen={showSuggestions}
        onSelect={handleSelect}
        onClose={() => setShowSuggestions(false)}
        apiSuggestions={apiSuggestions}
      />
    </div>
  );
}
