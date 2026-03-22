'use client';

import { SpinnerInfinity } from 'spinners-react';

/**
 * Quick Search Component
 *
 * Lightweight search component for instant results in the command palette.
 */

import * as React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search, Calendar, CheckSquare, Building, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuickSearch } from '@/lib/scheduling/hooks/use-schedule-search';
import type { ScheduleBlock, BlockType } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface QuickSearchProps {
  /** Callback when a result is selected */
  onSelect: (block: ScheduleBlock) => void;
  /** Callback to open full search */
  onOpenFullSearch?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Custom class name */
  className?: string;
}

interface QuickSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

// ============================================================================
// Constants
// ============================================================================

const TYPE_ICONS: Record<BlockType, React.ElementType> = {
  event: Calendar,
  task: CheckSquare,
  booking: Building,
};

// ============================================================================
// QuickSearch Component
// ============================================================================

export function QuickSearch({
  onSelect,
  onOpenFullSearch,
  placeholder = 'Rechercher...',
  className,
}: QuickSearchProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = React.useState(false);

  const { query, setQuery, results, isLoading, clear } = useQuickSearch({
    debounceMs: 200,
    limit: 5,
  });

  const showResults = isFocused && (query.length > 0 || results.length > 0);

  // Handle keyboard navigation
  const [selectedIndex, setSelectedIndex] = React.useState(-1);

  React.useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          onSelect(results[selectedIndex].block);
          clear();
          setIsFocused(false);
        } else if (onOpenFullSearch) {
          onOpenFullSearch();
        }
        break;
      case 'Escape':
        clear();
        setIsFocused(false);
        inputRef.current?.blur();
        break;
    }
  };

  return (
    <div className={cn('relative', className)}>
      <QuickSearchInput
        value={query}
        onChange={setQuery}
        placeholder={placeholder}
        inputRef={inputRef}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          // Delay to allow click on results
          setTimeout(() => setIsFocused(false), 200);
        }}
      />

      {/* Results dropdown */}
      {showResults && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden"
          onKeyDown={handleKeyDown}
        >
          {isLoading && (
            <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
              <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4  mr-2" />
              Recherche...
            </div>
          )}

          {!isLoading && results.length === 0 && query.length > 0 && (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Aucun résultat pour "{query}"
            </div>
          )}

          {results.length > 0 && (
            <div className="py-1">
              {results.map((result, index) => {
                const { block } = result;
                const TypeIcon = TYPE_ICONS[block.type];

                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => {
                      onSelect(block);
                      clear();
                    }}
                    className={cn(
                      'w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-muted/50',
                      index === selectedIndex && 'bg-muted'
                    )}
                  >
                    <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{block.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(block.start), "d MMM 'à' HH:mm", {
                          locale: fr,
                        })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Open full search */}
          {onOpenFullSearch && (
            <button
              type="button"
              onClick={onOpenFullSearch}
              className="w-full px-3 py-2 flex items-center gap-2 text-sm text-primary hover:bg-muted/50 border-t"
            >
              <Search className="h-4 w-4" />
              Recherche avancée
              <ArrowRight className="h-3 w-3 ml-auto" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// QuickSearchInput Component (reusable)
// ============================================================================

export function QuickSearchInput({
  value,
  onChange,
  placeholder = 'Rechercher...',
  className,
  onFocus,
  onBlur,
  inputRef,
}: QuickSearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={onFocus}
        onBlur={onBlur}
        className={cn(
          'w-full h-9 pl-9 pr-3 rounded-md border bg-transparent',
          'text-sm placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
          className
        )}
      />
    </div>
  );
}

// ============================================================================
// SearchTrigger Component (button to open search)
// ============================================================================

interface SearchTriggerProps {
  onClick: () => void;
  shortcut?: string;
  className?: string;
}

export function SearchTrigger({
  onClick,
  shortcut = '⌘K',
  className,
}: SearchTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 h-9 rounded-md border bg-muted/30',
        'text-sm text-muted-foreground hover:bg-muted/50 transition-colors',
        className
      )}
    >
      <Search className="h-4 w-4" />
      <span>Rechercher...</span>
      <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">
        {shortcut}
      </kbd>
    </button>
  );
}

export default QuickSearch;
