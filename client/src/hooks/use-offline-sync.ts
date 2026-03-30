'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import * as Y from 'yjs';
import { usePresenceStore } from '@/stores/presence-store';

interface PendingOperation {
    id: string;
    timestamp: number;
    type: 'update' | 'awareness';
    data: Uint8Array;
}

interface UseOfflineSyncOptions {
    /**
     * Yjs document to sync
     */
    ydoc: Y.Doc;
    /**
     * Document ID for storage key
     */
    docId: string;
    /**
     * Enable IndexedDB persistence
     */
    enablePersistence?: boolean;
    /**
     * Max operations to queue offline
     */
    maxQueueSize?: number;
}

const STORAGE_KEY_PREFIX = 'signapps_offline_';
const QUEUE_KEY_PREFIX = 'signapps_queue_';

export function useOfflineSync({
    ydoc,
    docId,
    enablePersistence = true,
    maxQueueSize = 1000,
}: UseOfflineSyncOptions) {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    const [pendingCount, setPendingCount] = useState(0);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

    const incrementPendingChanges = usePresenceStore((state) => state.incrementPendingChanges);
    const clearPendingChanges = usePresenceStore((state) => state.clearPendingChanges);

    const pendingOperations = useRef<PendingOperation[]>([]);
    const isSyncing = useRef(false);

    // Save document state to IndexedDB
    const saveToStorage = useCallback(async () => {
        if (!enablePersistence || typeof indexedDB === 'undefined') return;

        try {
            const state = Y.encodeStateAsUpdate(ydoc);
            const stateVector = Y.encodeStateVector(ydoc);

            await saveToIndexedDB(STORAGE_KEY_PREFIX + docId, {
                state: Array.from(state),
                stateVector: Array.from(stateVector),
                timestamp: Date.now(),
            });
        } catch (error) {
            console.error("[useOfflineSync] Impossible d'enregistrer to storage:", error);
        }
    }, [ydoc, docId, enablePersistence]);

    // Load document state from IndexedDB
    const loadFromStorage = useCallback(async () => {
        if (!enablePersistence || typeof indexedDB === 'undefined') return false;

        try {
            const data = await loadFromIndexedDB(STORAGE_KEY_PREFIX + docId);
            if (data && data.state) {
                const state = new Uint8Array(data.state);
                Y.applyUpdate(ydoc, state);
                setLastSyncTime(new Date(data.timestamp));
                return true;
            }
        } catch (error) {
            console.error('[useOfflineSync] Failed to load from storage:', error);
        }
        return false;
    }, [ydoc, docId, enablePersistence]);

    // Queue an operation for sync when back online
    const queueOperation = useCallback(
        (type: 'update' | 'awareness', data: Uint8Array) => {
            if (pendingOperations.current.length >= maxQueueSize) {
                // Remove oldest operations to make room
                pendingOperations.current.shift();
            }

            const operation: PendingOperation = {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                type,
                data,
            };

            pendingOperations.current.push(operation);
            setPendingCount(pendingOperations.current.length);
            incrementPendingChanges();

            // Persist queue to storage
            saveQueueToStorage();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [maxQueueSize, incrementPendingChanges]
    );

    // Save pending operations queue to IndexedDB
    const saveQueueToStorage = useCallback(async () => {
        if (typeof indexedDB === 'undefined') return;

        try {
            const queueData = pendingOperations.current.map((op) => ({
                ...op,
                data: Array.from(op.data),
            }));

            await saveToIndexedDB(QUEUE_KEY_PREFIX + docId, queueData);
        } catch (error) {
            console.error("[useOfflineSync] Impossible d'enregistrer queue:", error);
        }
    }, [docId]);

    // Load pending operations queue from IndexedDB
    const loadQueueFromStorage = useCallback(async () => {
        if (typeof indexedDB === 'undefined') return;

        try {
            const queueData = await loadFromIndexedDB(QUEUE_KEY_PREFIX + docId);
            if (Array.isArray(queueData)) {
                pendingOperations.current = queueData.map((op: any) => ({
                    ...op,
                    data: new Uint8Array(op.data),
                }));
                setPendingCount(pendingOperations.current.length);
            }
        } catch (error) {
            console.error('[useOfflineSync] Failed to load queue:', error);
        }
    }, [docId]);

    // Sync pending operations when back online
    const syncPendingOperations = useCallback(
        async (applyUpdate: (update: Uint8Array) => void) => {
            if (isSyncing.current || pendingOperations.current.length === 0) return;

            isSyncing.current = true;

            try {
                // Sort by timestamp to apply in order
                const sorted = [...pendingOperations.current].sort(
                    (a, b) => a.timestamp - b.timestamp
                );

                for (const op of sorted) {
                    if (op.type === 'update') {
                        applyUpdate(op.data);
                    }
                }

                // Clear the queue
                pendingOperations.current = [];
                setPendingCount(0);
                clearPendingChanges();
                setLastSyncTime(new Date());

                // Clear from storage
                await saveToIndexedDB(QUEUE_KEY_PREFIX + docId, []);
            } catch (error) {
                console.error('[useOfflineSync] Failed to sync:', error);
            } finally {
                isSyncing.current = false;
            }
        },
        [docId, clearPendingChanges]
    );

    // Track online/offline status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Auto-save document state periodically
    useEffect(() => {
        if (!enablePersistence) return;

        const interval = setInterval(() => {
            saveToStorage();
        }, 30000); // Save every 30 seconds

        return () => clearInterval(interval);
    }, [enablePersistence, saveToStorage]);

    // Save on document update
    useEffect(() => {
        const handleUpdate = () => {
            saveToStorage();
        };

        ydoc.on('update', handleUpdate);

        return () => {
            ydoc.off('update', handleUpdate);
        };
    }, [ydoc, saveToStorage]);

    // Initial load
    useEffect(() => {
        loadFromStorage();
        loadQueueFromStorage();
    }, [loadFromStorage, loadQueueFromStorage]);

    return {
        isOnline,
        pendingCount,
        lastSyncTime,
        queueOperation,
        syncPendingOperations,
        saveToStorage,
        loadFromStorage,
    };
}

// IndexedDB helpers
const DB_NAME = 'signapps_offline';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

async function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

async function saveToIndexedDB(key: string, value: any): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

async function loadFromIndexedDB(key: string): Promise<any> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}
