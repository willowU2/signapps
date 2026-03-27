"use client";

import { useRef, useCallback } from "react";

interface SwipeActionOptions {
  /** Pixel threshold to trigger the action (default: 80px) */
  threshold?: number;
  /** Called when the user swipes left past the threshold */
  onSwipeLeft?: () => void;
  /** Called when the user swipes right past the threshold */
  onSwipeRight?: () => void;
}

/**
 * Returns touch event handlers that detect a horizontal swipe gesture.
 * Attach the returned props to any element that should be swipeable.
 *
 * @example
 * ```tsx
 * const swipe = useSwipeAction({ onSwipeLeft: () => archive(id) });
 * return <div {...swipe.handlers}>...</div>;
 * ```
 */
export function useSwipeAction({
  threshold = 80,
  onSwipeLeft,
  onSwipeRight,
}: SwipeActionOptions) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startX.current = touch.clientX;
    startY.current = touch.clientY;
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (startX.current === null || startY.current === null) return;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;

      // Ignore vertical-dominant swipes (scrolling)
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        startX.current = null;
        startY.current = null;
        return;
      }

      if (deltaX < -threshold && onSwipeLeft) onSwipeLeft();
      else if (deltaX > threshold && onSwipeRight) onSwipeRight();

      startX.current = null;
      startY.current = null;
    },
    [threshold, onSwipeLeft, onSwipeRight],
  );

  return {
    handlers: {
      onTouchStart,
      onTouchEnd,
    } as const,
  };
}
