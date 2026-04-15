/**
 * Undo/Redo Hook
 *
 * Provides undo/redo functionality for scheduling actions.
 * Supports create, update, delete, move, and batch operations.
 */

"use client";

import * as React from "react";
import { toast } from "sonner";
import type {
  UndoableAction,
  ScheduleBlock,
} from "@/lib/scheduling/types/scheduling";

// ============================================================================
// Types
// ============================================================================

export interface UndoRedoConfig {
  /** Maximum number of actions to keep in history */
  maxHistory?: number;
  /** Whether to show toast notifications */
  showToasts?: boolean;
  /** Custom toast duration in ms */
  toastDuration?: number;
}

export interface UndoRedoState {
  /** Actions that can be undone */
  undoStack: UndoableAction[];
  /** Actions that can be redone */
  redoStack: UndoableAction[];
  /** Whether currently executing an undo/redo */
  isExecuting: boolean;
  /** Last executed action */
  lastAction: UndoableAction | null;
}

export interface UseUndoRedoResult {
  /** Current state */
  state: UndoRedoState;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Undo the last action */
  undo: () => Promise<void>;
  /** Redo the last undone action */
  redo: () => Promise<void>;
  /** Push a new action onto the stack */
  pushAction: (action: UndoableAction) => void;
  /** Create an undoable action for event creation */
  createEventAction: (
    event: ScheduleBlock,
    onUndo: () => Promise<void>,
    onRedo: () => Promise<void>,
  ) => void;
  /** Create an undoable action for event update */
  updateEventAction: (
    eventId: string,
    before: Partial<ScheduleBlock>,
    after: Partial<ScheduleBlock>,
    onUndo: () => Promise<void>,
    onRedo: () => Promise<void>,
  ) => void;
  /** Create an undoable action for event deletion */
  deleteEventAction: (
    event: ScheduleBlock,
    onUndo: () => Promise<void>,
    onRedo: () => Promise<void>,
  ) => void;
  /** Create an undoable action for event move */
  moveEventAction: (
    event: ScheduleBlock,
    oldStart: Date,
    oldEnd: Date | undefined,
    newStart: Date,
    newEnd: Date | undefined,
    onUndo: () => Promise<void>,
    onRedo: () => Promise<void>,
  ) => void;
  /** Create a batch action from multiple actions */
  batchAction: (actions: UndoableAction[], description: string) => void;
  /** Clear all history */
  clearHistory: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: Required<UndoRedoConfig> = {
  maxHistory: 50,
  showToasts: true,
  toastDuration: 3000,
};

// ============================================================================
// Hook
// ============================================================================

export function useUndoRedo(config: UndoRedoConfig = {}): UseUndoRedoResult {
  const mergedConfig = React.useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.maxHistory, config.showToasts, config.toastDuration],
  );

  const [state, setState] = React.useState<UndoRedoState>({
    undoStack: [],
    redoStack: [],
    isExecuting: false,
    lastAction: null,
  });

  const canUndo = state.undoStack.length > 0 && !state.isExecuting;
  const canRedo = state.redoStack.length > 0 && !state.isExecuting;

  // Generate unique ID for actions
  const generateId = () =>
    `action-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Push action onto undo stack
  const pushAction = React.useCallback(
    (action: UndoableAction) => {
      setState((prev) => {
        const newUndoStack = [action, ...prev.undoStack].slice(
          0,
          mergedConfig.maxHistory,
        );
        return {
          ...prev,
          undoStack: newUndoStack,
          redoStack: [], // Clear redo stack when new action is performed
          lastAction: action,
        };
      });

      if (mergedConfig.showToasts) {
        toast.success(action.description, {
          duration: mergedConfig.toastDuration,
          action: {
            label: "Annuler",
            onClick: () => {
              // Trigger undo through state
              undo();
            },
          },
        });
      }
    },
    // undo is defined below — circular dep avoided intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mergedConfig],
  );

  // Undo last action
  const undo = React.useCallback(async () => {
    if (!canUndo) return;

    const [action, ...restUndo] = state.undoStack;
    if (!action) return;

    setState((prev) => ({ ...prev, isExecuting: true }));

    try {
      await action.undo();

      setState((prev) => ({
        ...prev,
        undoStack: restUndo,
        redoStack: [action, ...prev.redoStack].slice(
          0,
          mergedConfig.maxHistory,
        ),
        isExecuting: false,
        lastAction: action,
      }));

      if (mergedConfig.showToasts) {
        toast.info(`Action annul\u00e9e: ${action.description}`, {
          duration: mergedConfig.toastDuration,
          action: {
            label: "R\u00e9tablir",
            onClick: () => redo(),
          },
        });
      }
    } catch (error) {
      setState((prev) => ({ ...prev, isExecuting: false }));
      toast.error("Impossible d'annuler cette action");
      console.error("Undo failed:", error);
    }
    // redo is defined below — circular dep avoided intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUndo, state.undoStack, mergedConfig]);

  // Redo last undone action
  const redo = React.useCallback(async () => {
    if (!canRedo) return;

    const [action, ...restRedo] = state.redoStack;
    if (!action) return;

    setState((prev) => ({ ...prev, isExecuting: true }));

    try {
      await action.redo();

      setState((prev) => ({
        ...prev,
        undoStack: [action, ...prev.undoStack].slice(
          0,
          mergedConfig.maxHistory,
        ),
        redoStack: restRedo,
        isExecuting: false,
        lastAction: action,
      }));

      if (mergedConfig.showToasts) {
        toast.info(`Action r\u00e9tablie: ${action.description}`, {
          duration: mergedConfig.toastDuration,
        });
      }
    } catch (error) {
      setState((prev) => ({ ...prev, isExecuting: false }));
      toast.error("Impossible de r\u00e9tablir cette action");
      console.error("Redo failed:", error);
    }
  }, [canRedo, state.redoStack, mergedConfig]);

  // Helper: Create event action
  const createEventAction = React.useCallback(
    (
      event: ScheduleBlock,
      onUndo: () => Promise<void>,
      onRedo: () => Promise<void>,
    ) => {
      const action: UndoableAction = {
        id: generateId(),
        type: "create",
        timestamp: new Date(),
        description: `\u00c9v\u00e9nement cr\u00e9\u00e9: ${event.title}`,
        undo: onUndo,
        redo: onRedo,
        data: {
          after: event,
        },
      };
      pushAction(action);
    },
    [pushAction],
  );

  // Helper: Update event action
  const updateEventAction = React.useCallback(
    (
      eventId: string,
      before: Partial<ScheduleBlock>,
      after: Partial<ScheduleBlock>,
      onUndo: () => Promise<void>,
      onRedo: () => Promise<void>,
    ) => {
      const changes: string[] = [];
      if (before.title !== after.title) changes.push("titre");
      if (before.start !== after.start) changes.push("date");
      if (before.description !== after.description) changes.push("description");

      const action: UndoableAction = {
        id: generateId(),
        type: "update",
        timestamp: new Date(),
        description: `\u00c9v\u00e9nement modifi\u00e9${changes.length ? `: ${changes.join(", ")}` : ""}`,
        undo: onUndo,
        redo: onRedo,
        data: {
          before,
          after,
        },
      };
      pushAction(action);
    },
    [pushAction],
  );

  // Helper: Delete event action
  const deleteEventAction = React.useCallback(
    (
      event: ScheduleBlock,
      onUndo: () => Promise<void>,
      onRedo: () => Promise<void>,
    ) => {
      const action: UndoableAction = {
        id: generateId(),
        type: "delete",
        timestamp: new Date(),
        description: `\u00c9v\u00e9nement supprim\u00e9: ${event.title}`,
        undo: onUndo,
        redo: onRedo,
        data: {
          before: event,
        },
      };
      pushAction(action);
    },
    [pushAction],
  );

  // Helper: Move event action
  const moveEventAction = React.useCallback(
    (
      event: ScheduleBlock,
      oldStart: Date,
      oldEnd: Date | undefined,
      newStart: Date,
      newEnd: Date | undefined,
      onUndo: () => Promise<void>,
      onRedo: () => Promise<void>,
    ) => {
      const formatDate = (d: Date) =>
        d.toLocaleString("fr-FR", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });

      const action: UndoableAction = {
        id: generateId(),
        type: "move",
        timestamp: new Date(),
        description: `\u00c9v\u00e9nement d\u00e9plac\u00e9: ${event.title} \u2192 ${formatDate(newStart)}`,
        undo: onUndo,
        redo: onRedo,
        data: {
          before: { start: oldStart, end: oldEnd },
          after: { start: newStart, end: newEnd },
        },
      };
      pushAction(action);
    },
    [pushAction],
  );

  // Helper: Batch action
  const batchAction = React.useCallback(
    (actions: UndoableAction[], description: string) => {
      const batchUndo = async () => {
        for (const action of actions.reverse()) {
          await action.undo();
        }
      };

      const batchRedo = async () => {
        for (const action of actions) {
          await action.redo();
        }
      };

      const action: UndoableAction = {
        id: generateId(),
        type: "batch",
        timestamp: new Date(),
        description,
        undo: batchUndo,
        redo: batchRedo,
        data: {
          actions,
        },
      };
      pushAction(action);
    },
    [pushAction],
  );

  // Clear history
  const clearHistory = React.useCallback(() => {
    setState({
      undoStack: [],
      redoStack: [],
      isExecuting: false,
      lastAction: null,
    });
  }, []);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl/Cmd + Z (Undo)
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      }

      // Check for Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y (Redo)
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") ||
        ((e.ctrlKey || e.metaKey) && e.key === "y")
      ) {
        e.preventDefault();
        if (canRedo) redo();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  return {
    state,
    canUndo,
    canRedo,
    undo,
    redo,
    pushAction,
    createEventAction,
    updateEventAction,
    deleteEventAction,
    moveEventAction,
    batchAction,
    clearHistory,
  };
}

// ============================================================================
// Context Provider
// ============================================================================

interface UndoRedoContextValue extends UseUndoRedoResult {}

const UndoRedoContext = React.createContext<UndoRedoContextValue | null>(null);

export interface UndoRedoProviderProps {
  children: React.ReactNode;
  config?: UndoRedoConfig;
}

export function UndoRedoProvider({ children, config }: UndoRedoProviderProps) {
  const undoRedo = useUndoRedo(config);

  return (
    <UndoRedoContext.Provider value={undoRedo}>
      {children}
    </UndoRedoContext.Provider>
  );
}

export function useUndoRedoContext(): UndoRedoContextValue {
  const context = React.useContext(UndoRedoContext);
  if (!context) {
    throw new Error(
      "useUndoRedoContext must be used within an UndoRedoProvider",
    );
  }
  return context;
}

// ============================================================================
// UI Components
// ============================================================================

export interface UndoRedoButtonsProps {
  className?: string;
}

export function UndoRedoButtons({ className }: UndoRedoButtonsProps) {
  // This would be implemented in the actual component file
  // Just returning null here as a placeholder
  return null;
}
