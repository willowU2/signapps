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
        wsUrl = process.env.NEXT_PUBLIC_COLLAB_URL || 'ws://localhost:3010',
        awareness: enableAwareness = true,
        onSync,
        onError,
    } = options;

    const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
    const [provider, setProvider] = useState<WebsocketProvider | null>(null);
    const [awareness, setAwareness] = useState<Awareness | null>(null);
    const [isSynced, setIsSynced] = useState(false);

    useEffect(() => {
        // Create new Y.js document
        const doc = new Y.Doc();

        try {
            // Create WebSocket provider
            const wsProvider = new WebsocketProvider(
                wsUrl,
                docId,
                doc,
                {
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
                console.warn('WebSocket disconnected');
            });

            wsProvider.on('connection-error', (error: Error) => {
                console.error('WebSocket error:', error);
                if (onError) {
                    onError(error);
                }
            });

            setYdoc(doc);
            setProvider(wsProvider);
            setAwareness(wsProvider.awareness || null);

            // Cleanup
            return () => {
                wsProvider.disconnect();
                doc.destroy();
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            console.error('Failed to initialize Y.js document:', err);
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
