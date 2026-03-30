"use client";

/**
 * useSwipe — global swipe gesture hook for list views.
 *
 * Usage in list rows:
 *   const swipe = useSwipe({ onSwipeLeft: () => archive(id), onSwipeRight: () => markDone(id) });
 *   return <div {...swipe.handlers}>...</div>
 *
 * Conventions for list views:
 *   - Swipe LEFT  → destructive / secondary action (archive, delete)
 *   - Swipe RIGHT → primary action (complete, reply, mark as read)
 *
 * Applied in: task list, contact list, deal list, mail list.
 * (Mail uses its own swipe implementation; this hook harmonises the other modules.)
 */
export { useSwipeAction as useSwipe } from './use-swipe-action';
export type { } from './use-swipe-action';
