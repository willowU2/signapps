/**
 * React hook for real-time calendar WebSocket synchronization
 * Manages Yrs document sync and presence tracking
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

interface CalendarPresence {
  user_id: string;
  username: string;
  status: 'join' | 'leave' | 'viewing' | 'editing' | 'idle';
  editing_item_id?: string;
  timestamp: number;
}

interface UseCalendarWebSocketOptions {
  calendar_id: string | null;
  username?: string;
  enabled?: boolean;
}

/**
 * Hook for real-time calendar collaboration
 * Provides WebSocket sync with Yrs CRDT and presence tracking
 */
export function useCalendarWebSocket(options: UseCalendarWebSocketOptions) {
  const {
    calendar_id,
    username = 'Anonymous',
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [presence, setPresence] = useState<CalendarPresence[]>([]);
  const [error, setError] = useState<string | null>(null);

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const yeventsRef = useRef<Y.Map<any> | null>(null);

  /**
   * Initialize WebSocket connection to calendar
   */
  const connect = useCallback(async () => {
    if (!calendar_id || !enabled) {
      return;
    }

    try {
      // Create Yjs document
      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      // Create Y.Map for events
      const yevents = ydoc.getMap('events');
      yeventsRef.current = yevents;

      // Build WebSocket URL - use calendar service (port 3011), not the frontend
      const calendarHost = process.env.NEXT_PUBLIC_CALENDAR_URL?.replace(/^https?:\/\//, '').replace(/\/api\/v1$/, '') || 'localhost:3011';
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${calendarHost}/api/v1/calendars/${calendar_id}/ws`;

      // Create WebSocket provider
      const provider = new WebsocketProvider(
        wsUrl,
        `calendar-${calendar_id}`,
        ydoc,
        {
          connect: false,
          // @ts-expect-error y-websocket accepts boolean for awareness
          awareness: true,
          resyncInterval: 5000, // Resync every 5 seconds
        }
      );

      // Check if server is reachable before connecting
      const httpUrl = wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
      fetch(httpUrl, { method: 'HEAD' })
        .then(() => provider.connect())
        .catch(() => console.debug(`[useCalendarWebSocket] Collaboration server at ${wsUrl} is offline. Running in local-only mode.`));

      providerRef.current = provider;

      // Connection state handlers
      provider.on('status', ({ status }: { status: 'connected' | 'disconnected' }) => {
        setIsConnected(status === 'connected');
        if (status === 'connected') {
          setError(null);
        }
      });

      // Error handler
      provider.on('connection-error', (error: any) => {
        setError(`Connection error: ${error.message}`);
      });

      // Presence updates
      provider.awareness?.on('change', (changes: any[]) => {
        const presences: CalendarPresence[] = [];
        provider.awareness?.getStates().forEach((state: any) => {
          if (state.user) {
            presences.push({
              user_id: state.user.user_id,
              username: state.user.username,
              status: state.user.status,
              editing_item_id: state.user.editing_item_id,
              timestamp: state.user.timestamp,
            });
          }
        });
        setPresence(presences);
      });

      // Set local awareness
      provider.awareness?.setLocalState({
        user: {
          user_id: Math.random().toString(36).substr(2, 9), // Temporary user ID
          username,
          status: 'viewing',
          timestamp: Date.now(),
        },
      });

      return () => {
        provider.disconnect();
        ydoc.destroy();
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  }, [calendar_id, enabled, username]);

  /**
   * Track user activity
   */
  const trackActivity = useCallback(() => {
    if (providerRef.current?.awareness) {
      const currentState = providerRef.current.awareness.getLocalState();
      providerRef.current.awareness.setLocalState({
        ...currentState,
        user: {
          ...currentState?.user,
          status: 'viewing',
          timestamp: Date.now(),
        },
      });
    }
  }, []);

  /**
   * Track editing state
   */
  const trackEditing = useCallback((itemId: string | null) => {
    if (providerRef.current?.awareness) {
      const currentState = providerRef.current.awareness.getLocalState();
      providerRef.current.awareness.setLocalState({
        ...currentState,
        user: {
          ...currentState?.user,
          status: itemId ? 'editing' : 'viewing',
          editing_item_id: itemId || undefined,
          timestamp: Date.now(),
        },
      });
    }
  }, []);

  /**
   * Add event to shared calendar
   */
  const addEvent = useCallback((event: any) => {
    if (yeventsRef.current) {
      yeventsRef.current.set(event.id, JSON.parse(JSON.stringify(event)));
    }
  }, []);

  /**
   * Update existing event
   */
  const updateEvent = useCallback((id: string, updates: any) => {
    if (yeventsRef.current) {
      const existing = yeventsRef.current.get(id);
      if (existing) {
        yeventsRef.current.set(id, { ...existing, ...updates });
      }
    }
  }, []);

  /**
   * Delete event from shared calendar
   */
  const deleteEvent = useCallback((id: string) => {
    if (yeventsRef.current) {
      yeventsRef.current.delete(id);
    }
  }, []);

  /**
   * Get all events from shared state
   */
  const getEvents = useCallback(() => {
    if (!yeventsRef.current) return [];
    const events: any[] = [];
    yeventsRef.current.forEach((value: any, key: string) => {
      events.push({ id: key, ...value });
    });
    return events;
  }, []);

  /**
   * Subscribe to event changes
   */
  const onEventsChange = useCallback(
    (callback: (events: any[]) => void) => {
      if (!yeventsRef.current) return;

      const handleChange = () => {
        callback(getEvents());
      };

      yeventsRef.current.observe(handleChange);

      return () => {
        yeventsRef.current?.unobserve(handleChange);
      };
    },
    [getEvents]
  );

  // Setup connection on mount/change
  useEffect(() => {
    if (!calendar_id || !enabled) {
      return;
    }

    const cleanup = connect();

    // Activity tracking
    const activityInterval = setInterval(trackActivity, 30000); // Every 30s

    return () => {
      clearInterval(activityInterval);
      cleanup?.then((fn) => fn?.());
      providerRef.current?.disconnect();
      ydocRef.current?.destroy();
    };
  }, [calendar_id, enabled, connect, trackActivity]);

  return {
    isConnected,
    presence,
    error,
    doc: ydocRef.current,
    provider: providerRef.current,
    events: {
      add: addEvent,
      update: updateEvent,
      delete: deleteEvent,
      get: getEvents,
      onChange: onEventsChange,
    },
    tracking: {
      activity: trackActivity,
      editing: trackEditing,
    },
  };
}

export type CalendarWebSocketAPI = ReturnType<typeof useCalendarWebSocket>;
