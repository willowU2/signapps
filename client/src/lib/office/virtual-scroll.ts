/**
 * Virtual Scroll Utilities
 *
 * Efficient rendering of large lists (comments, track changes, pages).
 */

// ============================================================================
// Types
// ============================================================================

export interface VirtualItem {
  index: number;
  start: number;
  size: number;
  end: number;
}

export interface VirtualRange {
  startIndex: number;
  endIndex: number;
  overscan: number;
}

export interface VirtualScrollConfig {
  /** Total number of items */
  count: number;
  /** Height of the container */
  containerHeight: number;
  /** Estimated item height (for variable heights) */
  estimatedItemHeight: number;
  /** Scroll offset from top */
  scrollOffset: number;
  /** Number of items to render outside visible area */
  overscan?: number;
  /** Get actual height of an item (for variable heights) */
  getItemHeight?: (index: number) => number;
}

export interface VirtualScrollResult {
  /** Virtual items to render */
  virtualItems: VirtualItem[];
  /** Total height of all items */
  totalHeight: number;
  /** Range of visible items */
  range: VirtualRange;
  /** Is currently scrolling */
  isScrolling: boolean;
}

// ============================================================================
// Virtual Scroll Calculator
// ============================================================================

export function calculateVirtualItems(config: VirtualScrollConfig): VirtualScrollResult {
  const {
    count,
    containerHeight,
    estimatedItemHeight,
    scrollOffset,
    overscan = 3,
    getItemHeight,
  } = config;

  if (count === 0) {
    return {
      virtualItems: [],
      totalHeight: 0,
      range: { startIndex: 0, endIndex: 0, overscan },
      isScrolling: false,
    };
  }

  // Calculate item positions
  const itemHeights: number[] = [];
  const itemOffsets: number[] = [];
  let totalHeight = 0;

  for (let i = 0; i < count; i++) {
    const height = getItemHeight ? getItemHeight(i) : estimatedItemHeight;
    itemHeights.push(height);
    itemOffsets.push(totalHeight);
    totalHeight += height;
  }

  // Find visible range
  let startIndex = 0;
  let endIndex = count - 1;

  // Binary search for start index
  let low = 0;
  let high = count - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (itemOffsets[mid] + itemHeights[mid] < scrollOffset) {
      low = mid + 1;
    } else if (itemOffsets[mid] > scrollOffset) {
      high = mid - 1;
    } else {
      startIndex = mid;
      break;
    }
  }
  startIndex = Math.max(0, low - overscan);

  // Find end index
  const endOffset = scrollOffset + containerHeight;
  for (let i = startIndex; i < count; i++) {
    if (itemOffsets[i] > endOffset) {
      endIndex = Math.min(count - 1, i + overscan);
      break;
    }
  }

  // Generate virtual items
  const virtualItems: VirtualItem[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    virtualItems.push({
      index: i,
      start: itemOffsets[i],
      size: itemHeights[i],
      end: itemOffsets[i] + itemHeights[i],
    });
  }

  return {
    virtualItems,
    totalHeight,
    range: { startIndex, endIndex, overscan },
    isScrolling: false,
  };
}

// ============================================================================
// Scroll State Manager
// ============================================================================

export class VirtualScrollState {
  private heights: Map<number, number> = new Map();
  private estimatedHeight: number;
  private lastScrollOffset = 0;
  private scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  private isScrolling = false;
  private onScrollEnd?: () => void;

  constructor(estimatedHeight: number, onScrollEnd?: () => void) {
    this.estimatedHeight = estimatedHeight;
    this.onScrollEnd = onScrollEnd;
  }

  /** Set measured height for an item */
  setItemHeight(index: number, height: number): void {
    this.heights.set(index, height);
  }

  /** Get height for an item */
  getItemHeight(index: number): number {
    return this.heights.get(index) || this.estimatedHeight;
  }

  /** Handle scroll event */
  handleScroll(offset: number): boolean {
    const wasScrolling = this.isScrolling;
    this.lastScrollOffset = offset;
    this.isScrolling = true;

    // Clear existing timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    // Set new timeout for scroll end
    this.scrollTimeout = setTimeout(() => {
      this.isScrolling = false;
      this.onScrollEnd?.();
    }, 150);

    return wasScrolling !== this.isScrolling;
  }

  /** Get current scroll state */
  getScrollState(): { offset: number; isScrolling: boolean } {
    return {
      offset: this.lastScrollOffset,
      isScrolling: this.isScrolling,
    };
  }

  /** Clear all cached heights */
  clear(): void {
    this.heights.clear();
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }
}

// ============================================================================
// Windowing Utilities
// ============================================================================

/**
 * Creates a range of indices to render
 */
export function getVisibleRange(
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  overscan = 3
): { start: number; end: number } {
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const end = Math.min(totalItems - 1, start + visibleCount + overscan * 2);

  return { start, end };
}

/**
 * Calculate offset for rendered items
 */
export function getOffsetForIndex(index: number, itemHeight: number): number {
  return index * itemHeight;
}

/**
 * Batch DOM updates for virtual list
 */
export function batchDOMUpdates(updates: (() => void)[]): void {
  if ('requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(
      () => {
        updates.forEach((update) => update());
      }
    );
  } else {
    requestAnimationFrame(() => {
      updates.forEach((update) => update());
    });
  }
}

// ============================================================================
// Scroll To Utilities
// ============================================================================

export interface ScrollToOptions {
  index: number;
  align?: 'start' | 'center' | 'end' | 'auto';
  behavior?: 'auto' | 'smooth';
}

export function calculateScrollToOffset(
  options: ScrollToOptions,
  containerHeight: number,
  getItemOffset: (index: number) => { start: number; size: number }
): number {
  const { index, align = 'auto' } = options;
  const { start, size } = getItemOffset(index);

  switch (align) {
    case 'start':
      return start;
    case 'center':
      return start - containerHeight / 2 + size / 2;
    case 'end':
      return start - containerHeight + size;
    case 'auto':
    default:
      return start;
  }
}
