'use client';

/**
 * VirtualList Component
 *
 * Efficiently renders large lists using virtualization.
 * Used for comments sidebar, track changes list, and document outlines.
 */

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { cn } from '@/lib/utils';
import {
  calculateVirtualItems,
  VirtualScrollState,
  calculateScrollToOffset,
  type VirtualItem,
  type ScrollToOptions,
} from '@/lib/office/virtual-scroll';

// ============================================================================
// Types
// ============================================================================

export interface VirtualListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Estimated height of each item (for variable heights) */
  estimatedItemHeight: number;
  /** Number of items to render outside visible area */
  overscan?: number;
  /** Render function for each item */
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  /** Get unique key for item */
  getItemKey?: (item: T, index: number) => string | number;
  /** Called when an item becomes visible */
  onItemVisible?: (item: T, index: number) => void;
  /** Called when scroll position changes */
  onScroll?: (scrollTop: number) => void;
  /** Container className */
  className?: string;
  /** Inner container className */
  innerClassName?: string;
  /** Empty state content */
  emptyContent?: React.ReactNode;
  /** Loading state */
  isLoading?: boolean;
  /** Loading content */
  loadingContent?: React.ReactNode;
}

export interface VirtualListRef {
  scrollTo: (options: ScrollToOptions) => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
}

// ============================================================================
// Component
// ============================================================================

function VirtualListInner<T>(
  {
    items,
    estimatedItemHeight,
    overscan = 5,
    renderItem,
    getItemKey,
    onItemVisible,
    onScroll,
    className,
    innerClassName,
    emptyContent,
    isLoading,
    loadingContent,
  }: VirtualListProps<T>,
  ref: React.ForwardedRef<VirtualListRef>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Virtual scroll state manager
  const scrollStateRef = useRef(new VirtualScrollState(estimatedItemHeight));
  const measuredHeightsRef = useRef<Map<number, number>>(new Map());

  // Get item height (use measured or estimated)
  const getItemHeight = useCallback(
    (index: number) => {
      return measuredHeightsRef.current.get(index) || estimatedItemHeight;
    },
    [estimatedItemHeight]
  );

  // Calculate virtual items
  const { virtualItems, totalHeight } = useMemo(
    () =>
      calculateVirtualItems({
        count: items.length,
        containerHeight,
        estimatedItemHeight,
        scrollOffset,
        overscan,
        getItemHeight,
      }),
    [items.length, containerHeight, estimatedItemHeight, scrollOffset, overscan, getItemHeight]
  );

  // Handle scroll
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      const newOffset = target.scrollTop;
      setScrollOffset(newOffset);
      scrollStateRef.current.handleScroll(newOffset);
      onScroll?.(newOffset);
    },
    [onScroll]
  );

  // Measure container height
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Measure item heights
  const measureItem = useCallback((index: number, element: HTMLElement | null) => {
    if (element) {
      const height = element.getBoundingClientRect().height;
      if (height > 0) {
        measuredHeightsRef.current.set(index, height);
        scrollStateRef.current.setItemHeight(index, height);
      }
    }
  }, []);

  // Notify visible items
  useEffect(() => {
    if (onItemVisible) {
      virtualItems.forEach((vItem) => {
        onItemVisible(items[vItem.index], vItem.index);
      });
    }
  }, [virtualItems, items, onItemVisible]);

  // Imperative handle for ref
  useImperativeHandle(
    ref,
    () => ({
      scrollTo: (options: ScrollToOptions) => {
        const container = containerRef.current;
        if (!container) return;

        const offset = calculateScrollToOffset(options, containerHeight, (index) => ({
          start: virtualItems.find((v) => v.index === index)?.start || index * estimatedItemHeight,
          size: getItemHeight(index),
        }));

        container.scrollTo({
          top: offset,
          behavior: options.behavior || 'smooth',
        });
      },
      scrollToTop: () => {
        containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      },
      scrollToBottom: () => {
        containerRef.current?.scrollTo({ top: totalHeight, behavior: 'smooth' });
      },
    }),
    [containerHeight, virtualItems, estimatedItemHeight, getItemHeight, totalHeight]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        {loadingContent || (
          <div className="text-sm text-muted-foreground">Loading...</div>
        )}
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        {emptyContent || (
          <div className="text-sm text-muted-foreground">No items</div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto', className)}
      onScroll={handleScroll}
    >
      <div
        className={cn('relative', innerClassName)}
        style={{ height: totalHeight }}
      >
        {virtualItems.map((vItem) => {
          const item = items[vItem.index];
          const key = getItemKey ? getItemKey(item, vItem.index) : vItem.index;

          return (
            <VirtualItemWrapper
              key={key}
              vItem={vItem}
              measureItem={measureItem}
            >
              {renderItem(item, vItem.index, {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vItem.start}px)`,
              })}
            </VirtualItemWrapper>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Virtual Item Wrapper
// ============================================================================

interface VirtualItemWrapperProps {
  vItem: VirtualItem;
  measureItem: (index: number, element: HTMLElement | null) => void;
  children: React.ReactNode;
}

function VirtualItemWrapper({ vItem, measureItem, children }: VirtualItemWrapperProps) {
  const itemRef = useCallback(
    (el: HTMLDivElement | null) => {
      measureItem(vItem.index, el);
    },
    [vItem.index, measureItem]
  );

  return <div ref={itemRef}>{children}</div>;
}

// ============================================================================
// Export with forwardRef
// ============================================================================

export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: React.ForwardedRef<VirtualListRef> }
) => React.ReactElement;

// ============================================================================
// Preset Components
// ============================================================================

interface CommentItem {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  resolved?: boolean;
}

interface VirtualCommentListProps {
  comments: CommentItem[];
  onCommentClick?: (comment: CommentItem) => void;
  className?: string;
}

export function VirtualCommentList({
  comments,
  onCommentClick,
  className,
}: VirtualCommentListProps) {
  const renderComment = useCallback(
    (comment: CommentItem, _index: number, style: React.CSSProperties) => (
      <div
        style={style}
        className={cn(
          'border-b p-3 transition-colors hover:bg-muted/50',
          comment.resolved && 'opacity-60'
        )}
        onClick={() => onCommentClick?.(comment)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{comment.author}</span>
          <span className="text-xs text-muted-foreground">{comment.createdAt}</span>
        </div>
        <p className="mt-1 text-sm">{comment.content}</p>
      </div>
    ),
    [onCommentClick]
  );

  return (
    <VirtualList
      items={comments}
      estimatedItemHeight={80}
      renderItem={renderComment}
      getItemKey={(c) => c.id}
      className={className}
      emptyContent={
        <div className="text-center text-sm text-muted-foreground">
          No comments yet
        </div>
      }
    />
  );
}

interface ChangeItem {
  id: string;
  type: 'insert' | 'delete' | 'format';
  author: string;
  content: string;
  timestamp: string;
}

interface VirtualChangeListProps {
  changes: ChangeItem[];
  onChangeClick?: (change: ChangeItem) => void;
  className?: string;
}

export function VirtualChangeList({
  changes,
  onChangeClick,
  className,
}: VirtualChangeListProps) {
  const renderChange = useCallback(
    (change: ChangeItem, _index: number, style: React.CSSProperties) => (
      <div
        style={style}
        className="border-b p-3 transition-colors hover:bg-muted/50"
        onClick={() => onChangeClick?.(change)}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-xs font-medium',
              change.type === 'insert' && 'bg-green-100 text-green-800',
              change.type === 'delete' && 'bg-red-100 text-red-800',
              change.type === 'format' && 'bg-blue-100 text-blue-800'
            )}
          >
            {change.type}
          </span>
          <span className="text-sm">{change.author}</span>
          <span className="text-xs text-muted-foreground">{change.timestamp}</span>
        </div>
        <p className="mt-1 truncate text-sm">{change.content}</p>
      </div>
    ),
    [onChangeClick]
  );

  return (
    <VirtualList
      items={changes}
      estimatedItemHeight={70}
      renderItem={renderChange}
      getItemKey={(c) => c.id}
      className={className}
      emptyContent={
        <div className="text-center text-sm text-muted-foreground">
          No changes tracked
        </div>
      }
    />
  );
}
