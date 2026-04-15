"use client";

// IDEA-121: Advanced search filters — date range, type, author, module

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ContentType =
  | "all"
  | "doc"
  | "sheet"
  | "slide"
  | "mail"
  | "task"
  | "event"
  | "file";

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "doc", label: "Documents" },
  { value: "sheet", label: "Feuilles" },
  { value: "slide", label: "Présentations" },
  { value: "mail", label: "Emails" },
  { value: "task", label: "Tâches" },
  { value: "event", label: "Événements" },
  { value: "file", label: "Fichiers" },
];

export interface AdvancedFilters {
  dateFrom: string;
  dateTo: string;
  type: ContentType;
  author: string;
  module: string;
}

const EMPTY_FILTERS: AdvancedFilters = {
  dateFrom: "",
  dateTo: "",
  type: "all",
  author: "",
  module: "",
};

function countActiveFilters(f: AdvancedFilters): number {
  let n = 0;
  if (f.dateFrom || f.dateTo) n++;
  if (f.type !== "all") n++;
  if (f.author) n++;
  if (f.module) n++;
  return n;
}

interface AdvancedSearchFiltersProps {
  filters: AdvancedFilters;
  onChange: (filters: AdvancedFilters) => void;
  className?: string;
}

export function AdvancedSearchFilters({
  filters,
  onChange,
  className,
}: AdvancedSearchFiltersProps) {
  const [open, setOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  const update = <K extends keyof AdvancedFilters>(
    key: K,
    value: AdvancedFilters[K],
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const reset = () => {
    onChange(EMPTY_FILTERS);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2 relative", className)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtres
          {activeCount > 0 && (
            <Badge className="h-4 min-w-4 px-1 text-[10px] absolute -top-1.5 -right-1.5">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 space-y-4" align="end">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">Filtres avancés</span>
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="h-7 px-2 text-xs gap-1"
            >
              <X className="h-3 w-3" />
              Réinitialiser
            </Button>
          )}
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <Label className="text-xs">Type de contenu</Label>
          <div className="flex flex-wrap gap-1.5">
            {CONTENT_TYPES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => update("type", value)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors border",
                  filters.type === value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-accent",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="space-y-1.5">
          <Label className="text-xs">Plage de dates</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Depuis</span>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => update("dateFrom", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground">
                Jusqu&apos;à
              </span>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => update("dateTo", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Author */}
        <div className="space-y-1.5">
          <Label className="text-xs">Auteur</Label>
          <Input
            placeholder="Nom ou email…"
            value={filters.author}
            onChange={(e) => update("author", e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        {/* Module */}
        <div className="space-y-1.5">
          <Label className="text-xs">Module</Label>
          <Input
            placeholder="Ex: mail, docs, tasks…"
            value={filters.module}
            onChange={(e) => update("module", e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        <Button size="sm" className="w-full" onClick={() => setOpen(false)}>
          Appliquer
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export { EMPTY_FILTERS };
