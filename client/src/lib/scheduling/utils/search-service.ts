/**
 * Scheduling Search Service
 *
 * Full-text search for events, tasks, and bookings with filtering and sorting.
 */

import {
  isWithinInterval,
  startOfDay,
  endOfDay,
  parseISO,
  format,
} from 'date-fns';
import type {
  ScheduleBlock,
  BlockType,
  BlockStatus,
  Priority,
  Task,
  Booking,
} from '../types/scheduling';

// ============================================================================
// Types
// ============================================================================

export interface SearchQuery {
  /** Text to search for in title, description, location, attendees */
  text?: string;
  /** Filter by block types */
  types?: BlockType[];
  /** Filter by statuses */
  statuses?: BlockStatus[];
  /** Filter by priorities */
  priorities?: Priority[];
  /** Filter by calendar IDs */
  calendarIds?: string[];
  /** Filter by tags */
  tags?: string[];
  /** Filter by date range */
  dateRange?: {
    start: Date;
    end: Date;
  };
  /** Filter by organizer/assignee */
  userId?: string;
  /** Filter by attendee email */
  attendeeEmail?: string;
  /** Filter by location name */
  location?: string;
  /** Sort field */
  sortBy?: 'start' | 'title' | 'updatedAt' | 'priority' | 'relevance';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Maximum results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

export interface SearchResult {
  /** Total number of matches (before pagination) */
  total: number;
  /** Matching blocks */
  items: SearchResultItem[];
  /** Facets for filtering */
  facets: SearchFacets;
  /** Query metadata */
  meta: SearchMeta;
}

export interface SearchResultItem {
  /** The matched block */
  block: ScheduleBlock;
  /** Relevance score (0-100) */
  score: number;
  /** Highlighted matches */
  highlights: SearchHighlight[];
}

export interface SearchHighlight {
  field: 'title' | 'description' | 'location' | 'attendee';
  text: string;
  matches: Array<{ start: number; end: number }>;
}

export interface SearchFacets {
  types: Array<{ type: BlockType; count: number }>;
  statuses: Array<{ status: BlockStatus; count: number }>;
  priorities: Array<{ priority: Priority; count: number }>;
  calendars: Array<{ id: string; name: string; count: number }>;
  tags: Array<{ tag: string; count: number }>;
}

export interface SearchMeta {
  query: SearchQuery;
  took: number; // milliseconds
  cached: boolean;
}

// ============================================================================
// Search Service Implementation
// ============================================================================

export class SchedulingSearchService {
  private blocks: ScheduleBlock[] = [];
  private calendarsMap: Map<string, string> = new Map();

  constructor(
    blocks: ScheduleBlock[] = [],
    calendarsMap: Map<string, string> = new Map()
  ) {
    this.blocks = blocks;
    this.calendarsMap = calendarsMap;
  }

  /**
   * Update the search index with new blocks
   */
  updateIndex(blocks: ScheduleBlock[]): void {
    this.blocks = blocks;
  }

  /**
   * Execute a search query
   */
  search(query: SearchQuery): SearchResult {
    const startTime = performance.now();

    // Apply filters
    let filtered = this.applyFilters(this.blocks, query);

    // Calculate facets before pagination
    const facets = this.calculateFacets(filtered);

    // Apply text search and scoring
    let scored: SearchResultItem[];
    if (query.text?.trim()) {
      scored = this.applyTextSearch(filtered, query.text);
    } else {
      scored = filtered.map((block) => ({
        block,
        score: 50, // Base score when no text search
        highlights: [],
      }));
    }

    // Sort results
    scored = this.applySorting(scored, query);

    // Store total before pagination
    const total = scored.length;

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    const paginated = scored.slice(offset, offset + limit);

    const endTime = performance.now();

    return {
      total,
      items: paginated,
      facets,
      meta: {
        query,
        took: Math.round(endTime - startTime),
        cached: false,
      },
    };
  }

  /**
   * Quick search - simplified interface for instant search
   */
  quickSearch(text: string, limit: number = 10): SearchResultItem[] {
    const result = this.search({
      text,
      limit,
      sortBy: 'relevance',
      sortDirection: 'desc',
    });
    return result.items;
  }

  /**
   * Get suggestions based on partial input
   */
  getSuggestions(partial: string, limit: number = 5): string[] {
    const lowerPartial = partial.toLowerCase();
    const suggestions = new Set<string>();

    for (const block of this.blocks) {
      // Title matches
      if (block.title.toLowerCase().includes(lowerPartial)) {
        suggestions.add(block.title);
      }

      // Tag matches
      if (block.tags) {
        for (const tag of block.tags) {
          if (tag.toLowerCase().includes(lowerPartial)) {
            suggestions.add(`#${tag}`);
          }
        }
      }

      // Location matches
      if (block.location?.name.toLowerCase().includes(lowerPartial)) {
        suggestions.add(`@${block.location.name}`);
      }

      if (suggestions.size >= limit) break;
    }

    return Array.from(suggestions).slice(0, limit);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private applyFilters(
    blocks: ScheduleBlock[],
    query: SearchQuery
  ): ScheduleBlock[] {
    return blocks.filter((block) => {
      // Type filter
      if (query.types?.length && !query.types.includes(block.type)) {
        return false;
      }

      // Status filter
      if (query.statuses?.length && !query.statuses.includes(block.status || 'confirmed')) {
        return false;
      }

      // Priority filter
      if (query.priorities?.length && !query.priorities.includes(block.priority || 'medium')) {
        return false;
      }

      // Calendar filter
      if (query.calendarIds?.length && !query.calendarIds.includes(block.calendarId || '')) {
        return false;
      }

      // Tags filter
      if (query.tags?.length) {
        if (!block.tags || !query.tags.some((t) => block.tags!.includes(t))) {
          return false;
        }
      }

      // Date range filter
      if (query.dateRange) {
        const blockStart = new Date(block.start);
        if (
          !isWithinInterval(blockStart, {
            start: startOfDay(query.dateRange.start),
            end: endOfDay(query.dateRange.end),
          })
        ) {
          return false;
        }
      }

      // User filter (organizer or assignee)
      if (query.userId) {
        const isOrganizer = block.metadata?.organizerId === query.userId;
        const isAssignee =
          block.type === 'task' && (block as unknown as Task).assigneeId === query.userId;
        if (!isOrganizer && !isAssignee) {
          return false;
        }
      }

      // Attendee filter
      if (query.attendeeEmail) {
        const hasAttendee = block.attendees?.some(
          (a) => a.email.toLowerCase() === query.attendeeEmail!.toLowerCase()
        );
        if (!hasAttendee) {
          return false;
        }
      }

      // Location filter
      if (query.location) {
        const locationMatch = block.location?.name
          .toLowerCase()
          .includes(query.location.toLowerCase());
        if (!locationMatch) {
          return false;
        }
      }

      return true;
    });
  }

  private applyTextSearch(
    blocks: ScheduleBlock[],
    text: string
  ): SearchResultItem[] {
    const searchTerms = text
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    return blocks
      .map((block) => {
        let score = 0;
        const highlights: SearchHighlight[] = [];

        // Search in title (highest weight)
        const titleScore = this.scoreField(block.title, searchTerms);
        if (titleScore.score > 0) {
          score += titleScore.score * 3;
          if (titleScore.matches.length > 0) {
            highlights.push({
              field: 'title',
              text: block.title,
              matches: titleScore.matches,
            });
          }
        }

        // Search in description
        if (block.description) {
          const descScore = this.scoreField(block.description, searchTerms);
          if (descScore.score > 0) {
            score += descScore.score * 2;
            if (descScore.matches.length > 0) {
              highlights.push({
                field: 'description',
                text: block.description,
                matches: descScore.matches,
              });
            }
          }
        }

        // Search in location
        if (block.location?.name) {
          const locScore = this.scoreField(block.location.name, searchTerms);
          if (locScore.score > 0) {
            score += locScore.score;
            if (locScore.matches.length > 0) {
              highlights.push({
                field: 'location',
                text: block.location.name,
                matches: locScore.matches,
              });
            }
          }
        }

        // Search in attendees
        if (block.attendees) {
          for (const attendee of block.attendees) {
            const nameScore = this.scoreField(attendee.name, searchTerms);
            const emailScore = this.scoreField(attendee.email, searchTerms);
            if (nameScore.score > 0 || emailScore.score > 0) {
              score += Math.max(nameScore.score, emailScore.score);
              highlights.push({
                field: 'attendee',
                text: `${attendee.name} (${attendee.email})`,
                matches: nameScore.score > 0 ? nameScore.matches : emailScore.matches,
              });
            }
          }
        }

        // Search in tags
        if (block.tags) {
          for (const tag of block.tags) {
            if (searchTerms.some((t) => tag.toLowerCase().includes(t))) {
              score += 20;
            }
          }
        }

        // Normalize score to 0-100
        score = Math.min(100, Math.round(score));

        return { block, score, highlights };
      })
      .filter((item) => item.score > 0);
  }

  private scoreField(
    text: string,
    searchTerms: string[]
  ): { score: number; matches: Array<{ start: number; end: number }> } {
    const lowerText = text.toLowerCase();
    let score = 0;
    const matches: Array<{ start: number; end: number }> = [];

    for (const term of searchTerms) {
      let index = lowerText.indexOf(term);
      while (index !== -1) {
        // Exact word match scores higher
        const isWordStart =
          index === 0 || /\W/.test(lowerText[index - 1]);
        const isWordEnd =
          index + term.length === lowerText.length ||
          /\W/.test(lowerText[index + term.length]);

        if (isWordStart && isWordEnd) {
          score += 30; // Full word match
        } else if (isWordStart) {
          score += 20; // Word starts with term
        } else {
          score += 10; // Partial match
        }

        matches.push({
          start: index,
          end: index + term.length,
        });

        index = lowerText.indexOf(term, index + 1);
      }
    }

    return { score, matches };
  }

  private applySorting(
    items: SearchResultItem[],
    query: SearchQuery
  ): SearchResultItem[] {
    const sortBy = query.sortBy || 'relevance';
    const direction = query.sortDirection || 'desc';
    const multiplier = direction === 'asc' ? 1 : -1;

    return [...items].sort((a, b) => {
      switch (sortBy) {
        case 'relevance':
          return (b.score - a.score) * multiplier;
        case 'start':
          return (
            (new Date(a.block.start).getTime() -
              new Date(b.block.start).getTime()) *
            multiplier
          );
        case 'title':
          return a.block.title.localeCompare(b.block.title) * multiplier;
        case 'updatedAt':
          return (
            (new Date(a.block.updatedAt).getTime() -
              new Date(b.block.updatedAt).getTime()) *
            multiplier
          );
        case 'priority': {
          const priorityOrder: Record<Priority, number> = {
            urgent: 4,
            high: 3,
            medium: 2,
            low: 1,
          };
          const aPriority = a.block.priority || 'medium';
          const bPriority = b.block.priority || 'medium';
          return (priorityOrder[bPriority] - priorityOrder[aPriority]) * multiplier;
        }
        default:
          return 0;
      }
    });
  }

  private calculateFacets(blocks: ScheduleBlock[]): SearchFacets {
    const typeCounts = new Map<BlockType, number>();
    const statusCounts = new Map<BlockStatus, number>();
    const priorityCounts = new Map<Priority, number>();
    const calendarCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();

    for (const block of blocks) {
      // Types
      typeCounts.set(block.type, (typeCounts.get(block.type) || 0) + 1);

      // Statuses
      const status = block.status || 'confirmed';
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);

      // Priorities
      const priority = block.priority || 'medium';
      priorityCounts.set(priority, (priorityCounts.get(priority) || 0) + 1);

      // Calendars
      if (block.calendarId) {
        calendarCounts.set(
          block.calendarId,
          (calendarCounts.get(block.calendarId) || 0) + 1
        );
      }

      // Tags
      if (block.tags) {
        for (const tag of block.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
    }

    return {
      types: Array.from(typeCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      statuses: Array.from(statusCounts.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      priorities: Array.from(priorityCounts.entries())
        .map(([priority, count]) => ({ priority, count }))
        .sort((a, b) => b.count - a.count),
      calendars: Array.from(calendarCounts.entries())
        .map(([id, count]) => ({
          id,
          name: this.calendarsMap.get(id) || id,
          count,
        }))
        .sort((a, b) => b.count - a.count),
      tags: Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count),
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let searchServiceInstance: SchedulingSearchService | null = null;

export function getSearchService(): SchedulingSearchService {
  if (!searchServiceInstance) {
    searchServiceInstance = new SchedulingSearchService();
  }
  return searchServiceInstance;
}

export function initSearchService(
  blocks: ScheduleBlock[],
  calendarsMap?: Map<string, string>
): SchedulingSearchService {
  searchServiceInstance = new SchedulingSearchService(blocks, calendarsMap);
  return searchServiceInstance;
}
