import { useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Awareness } from 'y-protocols/awareness';

interface UseYjsDocumentOptions {
    /**
     * WebSocket server URL (e.g., 'ws://localhost:3010')
     */
    wsUrl?: string;
    /**
     * Enable awareness (presence/cursors)
     */
    awareness?: boolean;
    /**
     * Callback when document synced
     */
    onSync?: () => void;
    /**
     * Callback on errors
     */
    onError?: (error: Error) => void;
}

export function useYjsDocument(
    docId: string,
    options: UseYjsDocumentOptions = {}
) {
    const {
        wsUrl = process.env.NEXT_PUBLIC_DOCS_URL || 'ws://localhost:3010',
        awareness: enableAwareness = true,
        onSync,
        onError,
    } = options;

    const [ydoc] = useState<Y.Doc>(() => new Y.Doc());
    const [provider, setProvider] = useState<WebsocketProvider | null>(null);
    const [awareness, setAwareness] = useState<Awareness | null>(null);
    const [isSynced, setIsSynced] = useState(false);

    useEffect(() => {
        try {
            // Create WebSocket provider
            const wsProvider = new WebsocketProvider(
                wsUrl,
                docId,
                ydoc,
                {
                    // @ts-expect-error y-websocket accepts boolean for awareness
                    awareness: enableAwareness,
                    resyncInterval: 5000,
                    connect: true,
                }
            );

            // Listen for sync events
            wsProvider.on('sync', (isSynced: boolean) => {
                setIsSynced(isSynced);
                if (isSynced && onSync) {
                    onSync();
                }
            });

            // Handle connection state
            wsProvider.on('connection-close', () => {
                // WebSocket disconnected
            });

            wsProvider.on('connection-error', (error: Error) => {
                if (onError) {
                    onError(error);
                }
            });

            setProvider(wsProvider);
            setAwareness(wsProvider.awareness || null);

            // Cleanup
            return () => {
                wsProvider.disconnect();
                ydoc.destroy();
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            if (onError) {
                onError(err);
            }
        }
    }, [docId, wsUrl, enableAwareness, onSync, onError]);

    // Helper to update local awareness state (e.g., cursor position)
    const updateAwareness = useCallback(
        (state: Record<string, any>) => {
            if (awareness) {
                awareness.setLocalState(state);
            }
        },
        [awareness]
    );

    // Helper to get shared text
    const getSharedText = useCallback(
        (name: string = 'shared-text'): Y.Text | null => {
            if (!ydoc) return null;
            return ydoc.getText(name);
        },
        [ydoc]
    );

    // Helper to get shared map
    const getSharedMap = useCallback(
        (name: string = 'shared-map'): Y.Map<any> | null => {
            if (!ydoc) return null;
            return ydoc.getMap(name);
        },
        [ydoc]
    );

    // Helper to get shared array
    const getSharedArray = useCallback(
        (name: string = 'shared-array'): Y.Array<any> | null => {
            if (!ydoc) return null;
            return ydoc.getArray(name);
        },
        [ydoc]
    );

    return {
        ydoc,
        provider,
        awareness,
        isSynced,
        updateAwareness,
        getSharedText,
        getSharedMap,
        getSharedArray,
    };
}
