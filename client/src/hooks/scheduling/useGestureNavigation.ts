/**
 * Gesture Navigation Hook
 *
 * Touch-based navigation for mobile calendar views.
 * Supports swipe, pinch-to-zoom, long press, and pull-to-refresh.
 */

'use client';

import * as React from 'react';
import type { ViewType } from '@/lib/scheduling/types/scheduling';

// ============================================================================
// Types
// ============================================================================

export interface GestureConfig {
  /** Enable swipe navigation between days/weeks */
  enableSwipe?: boolean;
  /** Enable pinch-to-zoom between views */
  enablePinch?: boolean;
  /** Enable long press for context menu */
  enableLongPress?: boolean;
  /** Enable pull-to-refresh */
  enablePullToRefresh?: boolean;
  /** Minimum swipe distance to trigger navigation (px) */
  swipeThreshold?: number;
  /** Swipe velocity threshold (px/ms) */
  velocityThreshold?: number;
  /** Long press duration (ms) */
  longPressDuration?: number;
  /** Pull distance to trigger refresh (px) */
  pullToRefreshThreshold?: number;
}

export interface GestureCallbacks {
  /** Called when swiping left (next) */
  onSwipeLeft?: () => void;
  /** Called when swiping right (previous) */
  onSwipeRight?: () => void;
  /** Called when pinching in (zoom out) */
  onPinchIn?: () => void;
  /** Called when pinching out (zoom in) */
  onPinchOut?: () => void;
  /** Called on long press with coordinates */
  onLongPress?: (x: number, y: number, target: HTMLElement) => void;
  /** Called when pull-to-refresh triggered */
  onRefresh?: () => Promise<void>;
  /** Called when view zoom should change */
  onViewZoom?: (direction: 'in' | 'out') => void;
}

export interface GestureState {
  /** Whether currently swiping */
  isSwiping: boolean;
  /** Current swipe direction */
  swipeDirection: 'left' | 'right' | null;
  /** Current swipe offset */
  swipeOffset: number;
  /** Whether pinching */
  isPinching: boolean;
  /** Current pinch scale */
  pinchScale: number;
  /** Whether long pressing */
  isLongPressing: boolean;
  /** Whether refreshing */
  isRefreshing: boolean;
  /** Pull offset for refresh */
  pullOffset: number;
}

export interface UseGestureNavigationResult {
  /** Ref to attach to the gesture target element */
  gestureRef: React.RefObject<HTMLDivElement | null>;
  /** Current gesture state */
  state: GestureState;
  /** Cancel any ongoing gesture */
  cancelGesture: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: Required<GestureConfig> = {
  enableSwipe: true,
  enablePinch: true,
  enableLongPress: true,
  enablePullToRefresh: true,
  swipeThreshold: 50,
  velocityThreshold: 0.3,
  longPressDuration: 500,
  pullToRefreshThreshold: 80,
};

// View zoom order for pinch gestures
const VIEW_ZOOM_ORDER: ViewType[] = ['day', '3-day', 'week', 'month'];

// ============================================================================
// Hook
// ============================================================================

export function useGestureNavigation(
  callbacks: GestureCallbacks,
  config: GestureConfig = {}
): UseGestureNavigationResult {
  const gestureRef = React.useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mergedConfig = React.useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [
    config.swipeThreshold,
    config.velocityThreshold,
    config.longPressDuration,
    config.pullToRefreshThreshold,
    config.enableSwipe,
    config.enablePinch,
    config.enableLongPress,
    config.enablePullToRefresh,
  ]);

  // Gesture state
  const [state, setState] = React.useState<GestureState>({
    isSwiping: false,
    swipeDirection: null,
    swipeOffset: 0,
    isPinching: false,
    pinchScale: 1,
    isLongPressing: false,
    isRefreshing: false,
    pullOffset: 0,
  });

  // Touch tracking refs
  const touchStartRef = React.useRef<{
    x: number;
    y: number;
    time: number;
    target: HTMLElement | null;
  } | null>(null);
  const lastTouchRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPinchDistanceRef = React.useRef<number>(0);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isGestureActiveRef = React.useRef(false);

  // Cancel all gestures
  const cancelGesture = React.useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    isGestureActiveRef.current = false;
    touchStartRef.current = null;
    initialPinchDistanceRef.current = 0;
    setState({
      isSwiping: false,
      swipeDirection: null,
      swipeOffset: 0,
      isPinching: false,
      pinchScale: 1,
      isLongPressing: false,
      isRefreshing: false,
      pullOffset: 0,
    });
  }, []);

  // Get distance between two touch points
  const getTouchDistance = (touches: TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Touch start handler
  const handleTouchStart = React.useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
        target: e.target as HTMLElement,
      };
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      isGestureActiveRef.current = true;

      // Handle pinch start
      if (e.touches.length === 2 && mergedConfig.enablePinch) {
        initialPinchDistanceRef.current = getTouchDistance(e.touches);
        setState((prev) => ({ ...prev, isPinching: true }));
      }

      // Start long press timer
      if (mergedConfig.enableLongPress && e.touches.length === 1) {
        longPressTimerRef.current = setTimeout(() => {
          if (touchStartRef.current && isGestureActiveRef.current) {
            setState((prev) => ({ ...prev, isLongPressing: true }));
            callbacks.onLongPress?.(
              touchStartRef.current.x,
              touchStartRef.current.y,
              touchStartRef.current.target!
            );
            cancelGesture();
          }
        }, mergedConfig.longPressDuration);
      }
    },
    [callbacks, mergedConfig, cancelGesture]
  );

  // Touch move handler
  const handleTouchMove = React.useCallback(
    (e: TouchEvent) => {
      if (!touchStartRef.current || !isGestureActiveRef.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // Cancel long press if moved too much
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }

      // Handle pinch
      if (e.touches.length === 2 && mergedConfig.enablePinch && initialPinchDistanceRef.current) {
        const currentDistance = getTouchDistance(e.touches);
        const scale = currentDistance / initialPinchDistanceRef.current;
        setState((prev) => ({ ...prev, pinchScale: scale }));
        e.preventDefault();
        return;
      }

      // Handle swipe (only if primarily horizontal)
      if (mergedConfig.enableSwipe && Math.abs(deltaX) > Math.abs(deltaY)) {
        const direction = deltaX > 0 ? 'right' : 'left';
        setState((prev) => ({
          ...prev,
          isSwiping: true,
          swipeDirection: direction,
          swipeOffset: deltaX,
        }));
        e.preventDefault();
        return;
      }

      // Handle pull-to-refresh (only at top of scrollable container)
      if (
        mergedConfig.enablePullToRefresh &&
        deltaY > 0 &&
        Math.abs(deltaY) > Math.abs(deltaX)
      ) {
        const element = gestureRef.current;
        if (element && element.scrollTop === 0) {
          const pullOffset = Math.min(deltaY * 0.5, mergedConfig.pullToRefreshThreshold * 1.5);
          setState((prev) => ({ ...prev, pullOffset }));
          e.preventDefault();
        }
      }

      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
    },
    [mergedConfig]
  );

  // Touch end handler
  const handleTouchEnd = React.useCallback(
    async (e: TouchEvent) => {
      if (!touchStartRef.current || !isGestureActiveRef.current) {
        cancelGesture();
        return;
      }

      // Clear long press timer
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const deltaX = lastTouchRef.current.x - touchStartRef.current.x;
      const deltaY = lastTouchRef.current.y - touchStartRef.current.y;
      const duration = Date.now() - touchStartRef.current.time;
      const velocity = Math.abs(deltaX) / duration;

      // Handle pinch end
      if (state.isPinching && initialPinchDistanceRef.current) {
        const finalScale = state.pinchScale;
        if (finalScale < 0.8) {
          // Pinch in - zoom out
          callbacks.onPinchIn?.();
          callbacks.onViewZoom?.('out');
        } else if (finalScale > 1.2) {
          // Pinch out - zoom in
          callbacks.onPinchOut?.();
          callbacks.onViewZoom?.('in');
        }
      }

      // Handle swipe end
      if (state.isSwiping) {
        const shouldTrigger =
          Math.abs(deltaX) > mergedConfig.swipeThreshold ||
          velocity > mergedConfig.velocityThreshold;

        if (shouldTrigger) {
          if (deltaX > 0) {
            callbacks.onSwipeRight?.();
          } else {
            callbacks.onSwipeLeft?.();
          }
        }
      }

      // Handle pull-to-refresh
      if (state.pullOffset >= mergedConfig.pullToRefreshThreshold) {
        setState((prev) => ({ ...prev, isRefreshing: true }));
        try {
          await callbacks.onRefresh?.();
        } finally {
          setState((prev) => ({ ...prev, isRefreshing: false }));
        }
      }

      cancelGesture();
    },
    [state, callbacks, mergedConfig, cancelGesture]
  );

  // Touch cancel handler
  const handleTouchCancel = React.useCallback(() => {
    cancelGesture();
  }, [cancelGesture]);

  // Attach event listeners
  React.useEffect(() => {
    const element = gestureRef.current;
    if (!element) return;

    // Add event listeners with passive: false for preventDefault
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel]);

  return {
    gestureRef,
    state,
    cancelGesture,
  };
}

// ============================================================================
// View Zoom Helper Hook
// ============================================================================

export interface UseViewZoomOptions {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export function useViewZoom({ currentView, onViewChange }: UseViewZoomOptions) {
  const handleViewZoom = React.useCallback(
    (direction: 'in' | 'out') => {
      const currentIndex = VIEW_ZOOM_ORDER.indexOf(currentView);
      if (currentIndex === -1) return;

      let newIndex: number;
      if (direction === 'in') {
        // Zoom in = more detail = lower index
        newIndex = Math.max(0, currentIndex - 1);
      } else {
        // Zoom out = less detail = higher index
        newIndex = Math.min(VIEW_ZOOM_ORDER.length - 1, currentIndex + 1);
      }

      if (newIndex !== currentIndex) {
        onViewChange(VIEW_ZOOM_ORDER[newIndex]);
      }
    },
    [currentView, onViewChange]
  );

  return { handleViewZoom };
}

// ============================================================================
// Swipe Animation Styles
// ============================================================================

export interface SwipeAnimationStyles {
  transform: string;
  transition: string;
  opacity: number;
}

export function getSwipeAnimationStyles(
  offset: number,
  isSwiping: boolean
): SwipeAnimationStyles {
  if (!isSwiping) {
    return {
      transform: 'translateX(0)',
      transition: 'transform 0.3s ease-out',
      opacity: 1,
    };
  }

  // Dampen the offset for a rubber-band effect
  const dampenedOffset = offset * 0.5;
  const opacity = Math.max(0.5, 1 - Math.abs(offset) / 500);

  return {
    transform: `translateX(${dampenedOffset}px)`,
    transition: 'none',
    opacity,
  };
}

// ============================================================================
// Pull-to-Refresh Styles
// ============================================================================

export interface PullToRefreshStyles {
  transform: string;
  transition: string;
}

export function getPullToRefreshStyles(
  pullOffset: number,
  isRefreshing: boolean,
  threshold: number
): PullToRefreshStyles {
  if (isRefreshing) {
    return {
      transform: `translateY(${threshold}px)`,
      transition: 'transform 0.3s ease-out',
    };
  }

  if (pullOffset > 0) {
    return {
      transform: `translateY(${pullOffset}px)`,
      transition: 'none',
    };
  }

  return {
    transform: 'translateY(0)',
    transition: 'transform 0.3s ease-out',
  };
}
