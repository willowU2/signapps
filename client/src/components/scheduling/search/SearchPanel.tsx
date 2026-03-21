'use client';

import { SpinnerInfinity } from 'spinners-react';

/**
 * Search Panel Component
 *
 * Full-featured search interface for scheduling blocks with filters and results.
 */

import * as React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search, X, Calendar, CheckSquare, Building, Clock, MapPin, Tag, Filter, SortAsc, SortDesc, AlertCircle, ChevronRight, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  useScheduleSearch,
  type UseScheduleSearchOptions,
} from '@/lib/scheduling/hooks/use-schedule-search';
import type { SearchResultItem, SearchQuery } from '@/lib/scheduling/utils/search-service';
import type { BlockType, BlockStatus, Priority, ScheduleBlock } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

interface SearchPanelProps {
  /** Whether the panel is open (for sheet mode) */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Callback when a result is selected */
  onSelect: (block: ScheduleBlock) => void;
  /** Panel display mode */
  mode?: 'inline' | 'sheet';
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const TYPE_ICONS: Record<BlockType, React.ElementType> = {
  event: Calendar,
  task: CheckSquare,
  booking: Building,
};

const TYPE_LABELS: Record<BlockType, string> = {
  event: 'Événement',
  task: 'Tâche',
  booking: 'Réservation',
};

const STATUS_LABELS: Record<BlockStatus, string> = {
  confirmed: 'Confirmé',
  tentative: 'Provisoire',
  cancelled: 'Annulé',
  completed: 'Terminé',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

// ============================================================================
// Component
// ============================================================================

export function SearchPanel({
  open = true,
  onOpenChange,
  onSelect,
  mode = 'inline',
  className,
}: SearchPanelProps) {
  // State for filters
  const [filters, setFilters] = React.useState<Omit<SearchQuery, 'text'>>({});
  const [sortBy, setSortBy] = React.useState<SearchQuery['sortBy']>('relevance');
  const [sortDirection, setSortDirection] = React.useState<SearchQuery['sortDirection']>('desc');

  // Search hook
  const {
    results,
    total,
    facets,
    isLoading,
    error,
    query,
    setQuery,
    clear,
    suggestions,
  } = useScheduleSearch({
    filters: { ...filters, sortBy, sortDirection },
    debounceMs: 300,
    limit: 50,
  });

  // Toggle type filter
  const toggleTypeFilter = (type: BlockType) => {
    setFilters((prev) => {
      const types = prev.types || [];
      if (types.includes(type)) {
        return { ...prev, types: types.filter((t) => t !== type) };
      }
      return { ...prev, types: [...types, type] };
    });
  };

  // Toggle status filter
  const toggleStatusFilter = (status: BlockStatus) => {
    setFilters((prev) => {
      const statuses = prev.statuses || [];
      if (statuses.includes(status)) {
        return { ...prev, statuses: statuses.filter((s) => s !== status) };
      }
      return { ...prev, statuses: [...statuses, status] };
    });
  };

  // Toggle priority filter
  const togglePriorityFilter = (priority: Priority) => {
    setFilters((prev) => {
      const priorities = prev.priorities || [];
      if (priorities.includes(priority)) {
        return { ...prev, priorities: priorities.filter((p) => p !== priority) };
      }
      return { ...prev, priorities: [...priorities, priority] };
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({});
    setSortBy('relevance');
    setSortDirection('desc');
  };

  // Count active filters
  const activeFilterCount =
    (filters.types?.length || 0) +
    (filters.statuses?.length || 0) +
    (filters.priorities?.length || 0) +
    (filters.tags?.length || 0);

  const content = (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Search input */}
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher événements, tâches..."
            className="pl-9 pr-9"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={clear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && query.length >= 2 && (
          <div className="flex flex-wrap gap-1">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setQuery(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center gap-2">
          {/* Type filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Calendar className="h-3 w-3 mr-1" />
                Type
                {filters.types?.length ? (
                  <Badge variant="secondary" className="ml-1 h-5 px-1">
                    {filters.types.length}
                  </Badge>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {facets.types.map(({ type, count }) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={filters.types?.includes(type)}
                  onCheckedChange={() => toggleTypeFilter(type)}
                >
                  <span className="flex-1">{TYPE_LABELS[type]}</span>
                  <Badge variant="outline" className="ml-2">
                    {count}
                  </Badge>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                Status
                {filters.statuses?.length ? (
                  <Badge variant="secondary" className="ml-1 h-5 px-1">
                    {filters.statuses.length}
                  </Badge>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {facets.statuses.map(({ status, count }) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={filters.statuses?.includes(status)}
                  onCheckedChange={() => toggleStatusFilter(status)}
                >
                  <span className="flex-1">{STATUS_LABELS[status]}</span>
                  <Badge variant="outline" className="ml-2">
                    {count}
                  </Badge>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Priority filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                Priorité
                {filters.priorities?.length ? (
                  <Badge variant="secondary" className="ml-1 h-5 px-1">
                    {filters.priorities.length}
                  </Badge>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {facets.priorities.map(({ priority, count }) => (
                <DropdownMenuCheckboxItem
                  key={priority}
                  checked={filters.priorities?.includes(priority)}
                  onCheckedChange={() => togglePriorityFilter(priority)}
                >
                  <span className="flex-1">{PRIORITY_LABELS[priority]}</span>
                  <Badge variant="outline" className="ml-2">
                    {count}
                  </Badge>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                {sortDirection === 'asc' ? (
                  <SortAsc className="h-3 w-3 mr-1" />
                ) : (
                  <SortDesc className="h-3 w-3 mr-1" />
                )}
                Trier
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Trier par</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortBy('relevance')}>
                Pertinence {sortBy === 'relevance' && '✓'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('start')}>
                Date {sortBy === 'start' && '✓'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('title')}>
                Titre {sortBy === 'title' && '✓'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('priority')}>
                Priorité {sortBy === 'priority' && '✓'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
                }
              >
                {sortDirection === 'asc' ? 'Croissant ↑' : 'Décroissant ↓'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="h-8" onClick={clearFilters}>
              <X className="h-3 w-3 mr-1" />
              Effacer ({activeFilterCount})
            </Button>
          )}
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {/* Results count */}
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
            <span>
              {total} résultat{total !== 1 ? 's' : ''}
            </span>
            {isLoading && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4 " />}
          </div>

          {/* Error state */}
          {error && (
            <div className="flex items-center gap-2 p-4 text-destructive bg-destructive/10 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span>Erreur lors de la recherche</span>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && results.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Aucun résultat trouvé</p>
              {query && (
                <p className="text-sm">
                  Essayez d'élargir votre recherche ou de modifier les filtres
                </p>
              )}
            </div>
          )}

          {/* Results list */}
          {results.map((result) => (
            <SearchResultCard
              key={result.block.id}
              result={result}
              onClick={() => onSelect(result.block)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  if (mode === 'sheet') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0">
          <SheetHeader className="p-4 pb-0">
            <SheetTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Recherche
            </SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return content;
}

// ============================================================================
// SearchResultCard Component
// ============================================================================

interface SearchResultCardProps {
  result: SearchResultItem;
  onClick: () => void;
}

function SearchResultCard({ result, onClick }: SearchResultCardProps) {
  const { block, score, highlights } = result;
  const TypeIcon = TYPE_ICONS[block.type];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
            block.type === 'event' && 'bg-blue-100 text-blue-600',
            block.type === 'task' && 'bg-green-100 text-green-600',
            block.type === 'booking' && 'bg-purple-100 text-purple-600'
          )}
        >
          <TypeIcon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title with highlights */}
          <div className="font-medium truncate">
            <HighlightedText
              text={block.title}
              highlights={highlights.filter((h) => h.field === 'title')}
            />
          </div>

          {/* Date and time */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <Clock className="h-3 w-3" />
            <span>
              {format(new Date(block.start), "d MMM yyyy 'à' HH:mm", {
                locale: fr,
              })}
            </span>
          </div>

          {/* Location */}
          {block.location && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{block.location.name}</span>
            </div>
          )}

          {/* Attendees count */}
          {block.attendees && block.attendees.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <Users className="h-3 w-3" />
              <span>{block.attendees.length} participant{block.attendees.length > 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Tags and badges */}
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {block.priority && block.priority !== 'medium' && (
              <Badge className={cn('text-xs', PRIORITY_COLORS[block.priority])}>
                {PRIORITY_LABELS[block.priority]}
              </Badge>
            )}
            {block.tags?.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                <Tag className="h-2 w-2 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </button>
  );
}

// ============================================================================
// HighlightedText Component
// ============================================================================

interface HighlightedTextProps {
  text: string;
  highlights: Array<{ matches: Array<{ start: number; end: number }> }>;
}

function HighlightedText({ text, highlights }: HighlightedTextProps) {
  if (highlights.length === 0) {
    return <span>{text}</span>;
  }

  // Merge all matches
  const allMatches = highlights.flatMap((h) => h.matches);
  if (allMatches.length === 0) {
    return <span>{text}</span>;
  }

  // Sort matches by start position
  const sortedMatches = [...allMatches].sort((a, b) => a.start - b.start);

  // Build highlighted text
  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  for (const match of sortedMatches) {
    // Add non-highlighted text before match
    if (match.start > lastEnd) {
      parts.push(
        <span key={`text-${lastEnd}`}>{text.slice(lastEnd, match.start)}</span>
      );
    }
    // Add highlighted match
    parts.push(
      <mark key={`match-${match.start}`} className="bg-yellow-200 rounded px-0.5">
        {text.slice(match.start, match.end)}
      </mark>
    );
    lastEnd = match.end;
  }

  // Add remaining text
  if (lastEnd < text.length) {
    parts.push(<span key={`text-${lastEnd}`}>{text.slice(lastEnd)}</span>);
  }

  return <span>{parts}</span>;
}

export default SearchPanel;
