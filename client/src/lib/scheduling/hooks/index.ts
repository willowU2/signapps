/**
 * Scheduling Hooks
 *
 * Custom hooks for the scheduling module.
 */

export {
  useEventDrag,
  useDragPreview,
  type DragState,
  type DragHandlers,
  type UseEventDragOptions,
} from './use-event-drag';

export {
  useConflictDetection,
  useConflictDetectionDebounced,
} from './use-conflict-detection';

export {
  useAvailabilityFinder,
  useQuickAvailability,
  type UseAvailabilityFinderOptions,
  type UseAvailabilityFinderResult,
} from './use-availability-finder';
