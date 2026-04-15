"use client";

import { useRef, useCallback, useEffect } from "react";

interface PullToRefreshOptions {
  /** Pixel distance to pull before triggering refresh (default: 72px) */
  threshold?: number;
  /** Called when the user pulls past the threshold */
  onRefresh: () => void | Promise<void>;
  /** Whether the parent container is already at scroll-top = 0 */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Attach pull-to-refresh gesture to a scrollable container or the window.
 * Only activates on touch devices when the container is scrolled to the top.
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * usePullToRefresh({ onRefresh: () => refetch(), scrollContainerRef: containerRef });
 * return <div ref={containerRef} className="overflow-y-auto">...</div>;
 * ```
 */
export function usePullToRefresh({
  threshold = 72,
  onRefresh,
  scrollContainerRef,
}: PullToRefreshOptions) {
  const startY = useRef<number | null>(null);
  const isPulling = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const el = scrollContainerRef?.current;
      // Only trigger when scrolled to the very top
      if (el && el.scrollTop > 0) return;
      const touch = e.touches[0];
      if (!touch) return;
      startY.current = touch.clientY;
      isPulling.current = true;
    },
    [scrollContainerRef],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!isPulling.current || startY.current === null) return;
      const touch = e.changedTouches[0];
      if (!touch) {
        isPulling.current = false;
        return;
      }
      const deltaY = touch.clientY - startY.current;
      if (deltaY >= threshold) {
        void onRefresh();
      }
      startY.current = null;
      isPulling.current = false;
    },
    [threshold, onRefresh],
  );

  useEffect(() => {
    const target = scrollContainerRef?.current ?? window;
    target.addEventListener("touchstart", handleTouchStart as EventListener, {
      passive: true,
    });
    target.addEventListener("touchend", handleTouchEnd as EventListener, {
      passive: true,
    });
    return () => {
      target.removeEventListener(
        "touchstart",
        handleTouchStart as EventListener,
      );
      target.removeEventListener("touchend", handleTouchEnd as EventListener);
    };
  }, [handleTouchStart, handleTouchEnd, scrollContainerRef]);
}
