"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Generic virtualized list wrapper.  Callers pass `items`, an
 * estimator, and a renderer.  ARIA row semantics are applied
 * automatically.
 *
 * Usage:
 *   <VirtualList
 *     items={messages}
 *     estimateSize={() => 72}
 *     renderItem={(m) => <MessageRow msg={m} />}
 *     className="h-full"
 *   />
 */
export interface VirtualListProps<T> {
  items: T[];
  estimateSize: (index: number) => number;
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  /** Auto-scroll to bottom when true (chat UX). */
  scrollToBottom?: boolean;
  /** Optional scroll handler on the viewport div. */
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

export function VirtualList<T>({
  items,
  estimateSize,
  overscan = 10,
  renderItem,
  className,
  scrollToBottom,
  onScroll,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
  });

  useEffect(() => {
    if (scrollToBottom && items.length > 0) {
      virtualizer.scrollToIndex(items.length - 1, {
        align: "end",
        behavior: "smooth",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToBottom, items.length]);

  return (
    <div
      ref={parentRef}
      className={className}
      role="list"
      aria-rowcount={items.length}
      onScroll={onScroll}
      style={{ overflow: "auto", contain: "strict" }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vi) => (
          <div
            key={vi.key}
            role="listitem"
            aria-rowindex={vi.index + 1}
            data-index={vi.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${vi.start}px)`,
            }}
          >
            {renderItem(items[vi.index]!, vi.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
