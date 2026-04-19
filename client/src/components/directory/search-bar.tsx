/**
 * SearchBar — SO5 directory.
 *
 * Tiny debounced input (~150 ms) with a dedicated clear button. Calls the
 * provided `onChange` with the raw string so the parent can dispatch it into
 * the Zustand store.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onClear?: () => void;
  placeholder?: string;
  /** Debounce delay in ms (default 150). */
  debounceMs?: number;
}

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = "Rechercher…",
  debounceMs = 150,
}: SearchBarProps) {
  // Keep a local mirror so typing feels instant even when the parent applies
  // heavy work on each change.
  const [local, setLocal] = useState(value);
  const timerRef = useRef<number | null>(null);

  // Sync when the parent resets the field (e.g. clearFilters).
  useEffect(() => {
    if (value !== local) setLocal(value);
    // We deliberately omit `local` from deps — external resets should flow
    // down, local typing should never trigger this branch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (local !== value) onChange(local);
    }, debounceMs);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, debounceMs]);

  return (
    <div className="relative w-full">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className={cn("h-10 pl-9", local ? "pr-9" : "")}
        aria-label="Recherche annuaire"
        data-testid="directory-search"
      />
      {local ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            setLocal("");
            onChange("");
            onClear?.();
          }}
          aria-label="Effacer la recherche"
          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
