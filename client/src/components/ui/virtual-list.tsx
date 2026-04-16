"use client";

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VirtualListProps<T> {
  /** Full array of items to virtualise. */
  items: T[];
  /** Render function for a single row. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Fixed pixel height of every row. */
  itemHeight: number;
  /** Number of extra rows rendered above & below the viewport (default 5). */
  overscan?: number;
  /** Optional CSS class for the scrollable container. */
  className?: string;
  /** Optional fixed height for the container (px). Defaults to 100% of parent. */
  height?: number;
  /** Callback fired when the user scrolls near the bottom (infinite-scroll). */
  onEndReached?: () => void;
  /** Distance from the bottom (px) that triggers `onEndReached` (default 200). */
  onEndReachedThreshold?: number;
  /** Optional key extractor. Falls back to array index. */
  getItemKey?: (item: T, index: number) => string | number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * High-performance virtualised list that only renders visible items plus
 * an overscan buffer.  Uses a simple scroll-position calculation (no
 * IntersectionObserver) for maximum compatibility and predictability with
 * fixed-height rows.
 *
 * @example
 * ```tsx
 * <VirtualList
 *   items={contacts}
 *   itemHeight={48}
 *   renderItem={(contact, i) => <ContactRow key={contact.id} contact={contact} />}
 *   overscan={8}
 *   onEndReached={loadMore}
 * />
 * ```
 */
export function VirtualList<T>({
  items,
  renderItem,
  itemHeight,
  overscan = 5,
  className,
  height,
  onEndReached,
  onEndReachedThreshold = 200,
  getItemKey,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Track whether we already fired onEndReached for the current scroll
  const endReachedRef = useRef(false);

  // ── Measure container height ────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height);
    });
    observer.observe(el);
    setContainerHeight(el.clientHeight);

    return () => observer.disconnect();
  }, []);

  // ── Scroll handler ──────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);

    // Infinite-scroll trigger
    if (onEndReached) {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom <= onEndReachedThreshold) {
        if (!endReachedRef.current) {
          endReachedRef.current = true;
          onEndReached();
        }
      } else {
        endReachedRef.current = false;
      }
    }
  }, [onEndReached, onEndReachedThreshold]);

  // ── Visible range calculation ───────────────────────────────────────────
  const { startIndex, endIndex, totalHeight, offsetY } = useMemo(() => {
    const total = items.length * itemHeight;
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const rawStart = Math.floor(scrollTop / itemHeight);
    const start = Math.max(0, rawStart - overscan);
    const end = Math.min(items.length - 1, rawStart + visibleCount + overscan);
    return {
      startIndex: start,
      endIndex: end,
      totalHeight: total,
      offsetY: start * itemHeight,
    };
  }, [items.length, itemHeight, containerHeight, scrollTop, overscan]);

  // ── Render ──────────────────────────────────────────────────────────────
  const visibleItems: ReactNode[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const item = items[i];
    if (item === undefined) continue;
    const key = getItemKey ? getItemKey(item, i) : i;
    visibleItems.push(
      <div
        key={key}
        style={{ height: itemHeight, boxSizing: "border-box" }}
        data-virtual-index={i}
      >
        {renderItem(item, i)}
      </div>,
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={className}
      style={{
        height: height ?? "100%",
        overflow: "auto",
        position: "relative",
      }}
    >
      {/* Spacer that keeps the scrollbar the correct total size */}
      <div style={{ height: totalHeight, position: "relative" }}>
        {/* Translated inner container holding only visible rows */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${offsetY}px)`,
          }}
        >
          {visibleItems}
        </div>
      </div>
    </div>
  );
}
