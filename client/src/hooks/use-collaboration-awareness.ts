"use client";

import { useEffect, useCallback, useRef } from "react";
import { Awareness } from "y-protocols/awareness";
import { usePresenceStore, UserPresence } from "@/stores/presence-store";
import { Editor } from "@tiptap/react";

interface UseCollaborationAwarenessOptions {
  /**
   * Yjs Awareness instance from y-websocket
   */
  awareness: Awareness | null;
  /**
   * Current user info
   */
  user: {
    id: string;
    name: string;
  };
  /**
   * Optional Tiptap editor for cursor position
   */
  editor?: Editor | null;
  /**
   * Container element for cursor position calculation
   */
  containerRef?: React.RefObject<HTMLElement>;
}

interface AwarenessState {
  userId: string;
  username: string;
  color: string;
  cursor?: {
    x: number;
    y: number;
    anchor?: number;
    head?: number;
  };
}

export function useCollaborationAwareness({
  awareness,
  user,
  editor,
  containerRef,
}: UseCollaborationAwarenessOptions) {
  const setCurrentUser = usePresenceStore((state) => state.setCurrentUser);
  const currentColor = usePresenceStore((state) => state.currentColor);
  const updateUserPresence = usePresenceStore(
    (state) => state.updateUserPresence,
  );
  const removeUser = usePresenceStore((state) => state.removeUser);
  const setConnectionStatus = usePresenceStore(
    (state) => state.setConnectionStatus,
  );
  const setSynced = usePresenceStore((state) => state.setSynced);

  const lastCursorUpdate = useRef<number>(0);
  const CURSOR_THROTTLE_MS = 50; // Throttle cursor updates to 20fps

  // Initialize current user
  useEffect(() => {
    if (user.id && user.name) {
      setCurrentUser(user.id, user.name);
    }
  }, [user.id, user.name, setCurrentUser]);

  // Set local awareness state
  useEffect(() => {
    if (!awareness || !user.id) return;

    const localState: AwarenessState = {
      userId: user.id,
      username: user.name,
      color: currentColor,
    };

    awareness.setLocalState(localState);

    return () => {
      awareness.setLocalState(null);
    };
  }, [awareness, user.id, user.name, currentColor]);

  // Listen for awareness changes from other users
  useEffect(() => {
    if (!awareness) return;

    const handleAwarenessChange = () => {
      const states = awareness.getStates();

      // Process all awareness states
      states.forEach((state, clientId) => {
        const awarenessState = state as AwarenessState | null;
        if (!awarenessState || awarenessState.userId === user.id) return;

        updateUserPresence(awarenessState.userId, {
          username: awarenessState.username,
          color: awarenessState.color,
          cursor: awarenessState.cursor,
          isOnline: true,
        });
      });

      // Mark users who left as offline
      const activeUserIds = new Set<string>();
      states.forEach((state) => {
        const awarenessState = state as AwarenessState | null;
        if (awarenessState?.userId) {
          activeUserIds.add(awarenessState.userId);
        }
      });
    };

    awareness.on("change", handleAwarenessChange);

    // Initial sync
    handleAwarenessChange();

    return () => {
      awareness.off("change", handleAwarenessChange);
    };
  }, [awareness, user.id, updateUserPresence, removeUser]);

  // Update cursor position from Tiptap editor
  useEffect(() => {
    if (!awareness || !editor) return;

    const handleSelectionUpdate = () => {
      const now = Date.now();
      if (now - lastCursorUpdate.current < CURSOR_THROTTLE_MS) return;
      lastCursorUpdate.current = now;

      const { from, to } = editor.state.selection;
      const localState = awareness.getLocalState() as AwarenessState | null;

      if (localState) {
        awareness.setLocalState({
          ...localState,
          cursor: {
            x: 0,
            y: 0,
            anchor: from,
            head: to,
          },
        });
      }
    };

    editor.on("selectionUpdate", handleSelectionUpdate);

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [awareness, editor]);

  // Track mouse position for cursor display
  const updateMousePosition = useCallback(
    (x: number, y: number) => {
      if (!awareness) return;

      const now = Date.now();
      if (now - lastCursorUpdate.current < CURSOR_THROTTLE_MS) return;
      lastCursorUpdate.current = now;

      const localState = awareness.getLocalState() as AwarenessState | null;

      // Calculate relative position if container ref provided
      let relativeX = x;
      let relativeY = y;

      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect();
        relativeX = x - rect.left;
        relativeY = y - rect.top;
      }

      if (localState) {
        awareness.setLocalState({
          ...localState,
          cursor: {
            ...localState.cursor,
            x: relativeX,
            y: relativeY,
          },
        });
      }
    },
    [awareness, containerRef],
  );

  // Track connection status from WebSocket provider
  const handleConnectionChange = useCallback(
    (connected: boolean, synced: boolean = false) => {
      if (connected) {
        setConnectionStatus(synced ? "connected" : "connecting");
        setSynced(synced);
      } else {
        setConnectionStatus("disconnected");
        setSynced(false);
      }
    },
    [setConnectionStatus, setSynced],
  );

  return {
    updateMousePosition,
    handleConnectionChange,
  };
}
