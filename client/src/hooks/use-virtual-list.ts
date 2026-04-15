/**
 * Hook companion for VirtualList -- provides imperative scroll control.
 *
 * @example
 * ```tsx
 * const { containerRef, scrollToIndex } = useVirtualList({ itemHeight: 48 });
 * ```
 */

import { useRef, useCallback } from "react";

interface UseVirtualListOptions {
  itemHeight: number;
}

export function useVirtualList({ itemHeight }: UseVirtualListOptions) {
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const el = containerRef.current;
      if (!el) return;
      el.scrollTo({ top: index * itemHeight, behavior });
    },
    [itemHeight],
  );

  const scrollToTop = useCallback((behavior: ScrollBehavior = "smooth") => {
    containerRef.current?.scrollTo({ top: 0, behavior });
  }, []);

  return { containerRef, scrollToIndex, scrollToTop };
}
