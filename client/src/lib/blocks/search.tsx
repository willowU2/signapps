/**
 * Universal Blocks System - Search
 *
 * Recherche universelle parmi tous les types de blocs.
 */

"use client";

import * as React from "react";
import { Search, Loader2, Filter, X, ChevronDown } from "lucide-react";
import Fuse from "fuse.js";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { UniversalBlock, BlockType, BlockSearchResult } from "./types";
import { BlockRow, BlockInline } from "./renderers";
import { getBlockTypeInfo, getAllBlockRegistries, getSearchWeight } from "./registry";

// ============================================================================
// Fuse.js Configuration
// ============================================================================

const fuseOptions: Fuse.IFuseOptions<UniversalBlock> = {
  keys: [
    { name: "title", weight: 1.0 },
    { name: "subtitle", weight: 0.7 },
    { name: "description", weight: 0.5 },
    { name: "metadata.tags", weight: 0.6 },
  ],
  threshold: 0.4,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
};

// ============================================================================
// Search Hook
// ============================================================================

export interface UseBlockSearchOptions {
  /** All blocks to search through */
  blocks: UniversalBlock[];
  /** Filter by block types */
  types?: BlockType[];
  /** Minimum score threshold (0-1, lower is better match) */
  threshold?: number;
  /** Maximum results */
  limit?: number;
}

export function useBlockSearch({
  blocks,
  types,
  threshold = 0.6,
  limit = 50,
}: UseBlockSearchOptions) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<BlockSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  // Filter blocks by type
  const filteredBlocks = React.useMemo(() => {
    if (!types || types.length === 0) return blocks;
    return blocks.filter((b) => types.includes(b.type));
  }, [blocks, types]);

  // Create Fuse instance
  const fuse = React.useMemo(
    () => new Fuse(filteredBlocks, fuseOptions),
    [filteredBlocks]
  );

  // Perform search
  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    // Use requestIdleCallback for non-blocking search
    const search = () => {
      const fuseResults = fuse.search(query, { limit });

      const searchResults: BlockSearchResult[] = fuseResults
        .filter((r) => (r.score ?? 1) <= threshold)
        .map((r) => ({
          block: r.item,
          score: 1 - (r.score ?? 0), // Convert to 0-1 where 1 is best
          highlights: r.matches?.map((m) => ({
            field: m.key || "",
            matches: m.value ? [m.value] : [],
          })),
        }))
        // Apply type weight
        .map((r) => ({
          ...r,
          score: r.score * getSearchWeight(r.block.type),
        }))
        // Sort by weighted score
        .sort((a, b) => b.score - a.score);

      setResults(searchResults);
      setIsSearching(false);
    };

    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(search, { timeout: 100 });
    } else {
      setTimeout(search, 0);
    }
  }, [query, fuse, threshold, limit]);

  return {
    query,
    setQuery,
    results,
    isSearching,
    hasResults: results.length > 0,
    clearSearch: () => {
      setQuery("");
      setResults([]);
    },
  };
}

// ============================================================================
// Block Search Input
// ============================================================================

export interface BlockSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isSearching?: boolean;
  className?: string;
}

export function BlockSearchInput({
  value,
  onChange,
  placeholder = "Rechercher...",
  isSearching,
  className,
}: BlockSearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
      />
      {isSearching && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {!isSearching && value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Block Type Filter
// ============================================================================

export interface BlockTypeFilterProps {
  selectedTypes: BlockType[];
  onChange: (types: BlockType[]) => void;
  availableTypes?: BlockType[];
  className?: string;
}

export function BlockTypeFilter({
  selectedTypes,
  onChange,
  availableTypes,
  className,
}: BlockTypeFilterProps) {
  const [open, setOpen] = React.useState(false);

  const types = availableTypes || getAllBlockRegistries().map((r) => r.type);

  const toggleType = (type: BlockType) => {
    if (selectedTypes.includes(type)) {
      onChange(selectedTypes.filter((t) => t !== type));
    } else {
      onChange([...selectedTypes, type]);
    }
  };

  const clearAll = () => onChange([]);
  const selectAll = () => onChange([...types]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2",
            selectedTypes.length > 0 && "border-primary",
            className
          )}
        >
          <Filter className="h-4 w-4" />
          Types
          {selectedTypes.length > 0 && (
            <Badge variant="secondary" className="text-xs h-5 min-w-5 px-1">
              {selectedTypes.length}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="flex justify-between mb-2 px-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={selectAll}
          >
            Tout
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={clearAll}
          >
            Aucun
          </Button>
        </div>
        <div className="space-y-1">
          {types.map((type) => {
            const info = getBlockTypeInfo(type);
            const isSelected = selectedTypes.includes(type);
            return (
              <label
                key={type}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleType(type)}
                />
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: info.color }}
                />
                <span className="text-sm">{info.displayName}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Search Results
// ============================================================================

export interface BlockSearchResultsProps {
  results: BlockSearchResult[];
  isSearching: boolean;
  query: string;
  onSelect: (block: UniversalBlock) => void;
  groupByType?: boolean;
  showScore?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function BlockSearchResults({
  results,
  isSearching,
  query,
  onSelect,
  groupByType = true,
  showScore = false,
  emptyMessage = "Aucun résultat",
  className,
}: BlockSearchResultsProps) {
  if (isSearching) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!query) {
    return null;
  }

  if (results.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        {emptyMessage}
      </div>
    );
  }

  if (!groupByType) {
    return (
      <div className={cn("space-y-1", className)}>
        {results.map((result) => (
          <BlockRow
            key={result.block.id}
            block={result.block}
            onClick={() => onSelect(result.block)}
            showActions={false}
          />
        ))}
      </div>
    );
  }

  // Group results by type
  const grouped = results.reduce(
    (acc, result) => {
      const type = result.block.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(result);
      return acc;
    },
    {} as Record<BlockType, BlockSearchResult[]>
  );

  return (
    <div className={cn("space-y-4", className)}>
      {Object.entries(grouped).map(([type, typeResults]) => {
        const info = getBlockTypeInfo(type as BlockType);
        return (
          <div key={type}>
            <div className="flex items-center gap-2 px-2 mb-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: info.color }}
              />
              <span className="text-sm font-medium text-muted-foreground">
                {info.pluralName}
              </span>
              <Badge variant="secondary" className="text-xs">
                {typeResults.length}
              </Badge>
            </div>
            <div className="space-y-1">
              {typeResults.map((result) => (
                <div key={result.block.id} className="flex items-center gap-2">
                  <BlockRow
                    block={result.block}
                    onClick={() => onSelect(result.block)}
                    showActions={false}
                    className="flex-1"
                  />
                  {showScore && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {Math.round(result.score * 100)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Universal Search Component (Combined)
// ============================================================================

export interface UniversalBlockSearchProps {
  /** All blocks to search through */
  blocks: UniversalBlock[];
  /** Select handler */
  onSelect: (block: UniversalBlock) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Show type filter */
  showTypeFilter?: boolean;
  /** Group results by type */
  groupByType?: boolean;
  /** Maximum height for results */
  maxHeight?: number;
  /** Custom class name */
  className?: string;
}

export function UniversalBlockSearch({
  blocks,
  onSelect,
  placeholder = "Rechercher parmi tous les éléments...",
  showTypeFilter = true,
  groupByType = true,
  maxHeight = 400,
  className,
}: UniversalBlockSearchProps) {
  const [selectedTypes, setSelectedTypes] = React.useState<BlockType[]>([]);

  const { query, setQuery, results, isSearching, clearSearch } = useBlockSearch({
    blocks,
    types: selectedTypes.length > 0 ? selectedTypes : undefined,
  });

  const handleSelect = (block: UniversalBlock) => {
    onSelect(block);
    clearSearch();
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-2">
        <BlockSearchInput
          value={query}
          onChange={setQuery}
          placeholder={placeholder}
          isSearching={isSearching}
          className="flex-1"
        />
        {showTypeFilter && (
          <BlockTypeFilter
            selectedTypes={selectedTypes}
            onChange={setSelectedTypes}
          />
        )}
      </div>

      {(query || results.length > 0) && (
        <ScrollArea style={{ maxHeight }} className="rounded-md border p-2">
          <BlockSearchResults
            results={results}
            isSearching={isSearching}
            query={query}
            onSelect={handleSelect}
            groupByType={groupByType}
          />
        </ScrollArea>
      )}
    </div>
  );
}

// ============================================================================
// Command Palette Search (for Cmd+K)
// ============================================================================

export interface CommandPaletteSearchProps {
  blocks: UniversalBlock[];
  onSelect: (block: UniversalBlock) => void;
  recentBlocks?: UniversalBlock[];
  onClose?: () => void;
}

export function CommandPaletteSearch({
  blocks,
  onSelect,
  recentBlocks = [],
  onClose,
}: CommandPaletteSearchProps) {
  const [query, setQuery] = React.useState("");

  const { results, isSearching } = useBlockSearch({
    blocks,
    limit: 10,
  });

  // Update query when input changes
  const handleInputChange = (value: string) => {
    setQuery(value);
  };

  const handleSelect = (block: UniversalBlock) => {
    onSelect(block);
    onClose?.();
  };

  // Group results by type
  const grouped = results.reduce(
    (acc, result) => {
      const type = result.block.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(result);
      return acc;
    },
    {} as Record<BlockType, BlockSearchResult[]>
  );

  return (
    <Command className="rounded-lg border shadow-md">
      <CommandInput
        placeholder="Rechercher..."
        value={query}
        onValueChange={handleInputChange}
      />
      <CommandList>
        {isSearching && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {!query && !isSearching && recentBlocks.length > 0 && (
          <CommandGroup heading="Récents">
            {recentBlocks.slice(0, 5).map((block) => (
              <CommandItem
                key={block.id}
                value={block.id}
                onSelect={() => handleSelect(block)}
              >
                <BlockInline block={block} showPreview={false} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {query && !isSearching && results.length === 0 && (
          <CommandEmpty>Aucun résultat pour "{query}"</CommandEmpty>
        )}

        {query &&
          !isSearching &&
          Object.entries(grouped).map(([type, typeResults], idx) => {
            const info = getBlockTypeInfo(type as BlockType);
            return (
              <React.Fragment key={type}>
                {idx > 0 && <CommandSeparator />}
                <CommandGroup heading={info.pluralName}>
                  {typeResults.slice(0, 5).map((result) => (
                    <CommandItem
                      key={result.block.id}
                      value={result.block.id}
                      onSelect={() => handleSelect(result.block)}
                      className="gap-3"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: result.block.color }}
                      />
                      <span className="truncate">{result.block.title}</span>
                      {result.block.subtitle && (
                        <span className="text-muted-foreground text-sm truncate">
                          {result.block.subtitle}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </React.Fragment>
            );
          })}
      </CommandList>
    </Command>
  );
}
