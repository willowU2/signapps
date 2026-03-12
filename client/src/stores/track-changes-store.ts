import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrackChange, ChangeType } from '@/components/docs/extensions/track-changes';

interface TrackChangesState {
    changes: Record<string, TrackChange[]>; // documentId -> changes
    enabled: Record<string, boolean>; // documentId -> enabled
    showChanges: Record<string, boolean>; // documentId -> showChanges (visibility toggle)
    activeChangeId: string | null;
}

interface TrackChangesActions {
    // Enable/disable
    setEnabled: (documentId: string, enabled: boolean) => void;
    isEnabled: (documentId: string) => boolean;

    // Visibility
    setShowChanges: (documentId: string, show: boolean) => void;
    isShowingChanges: (documentId: string) => boolean;

    // Change management
    addChange: (
        documentId: string,
        type: ChangeType,
        author: string,
        authorId: string,
        originalContent?: string,
        newContent?: string
    ) => string; // Returns change ID

    acceptChange: (documentId: string, changeId: string) => void;
    rejectChange: (documentId: string, changeId: string) => void;
    acceptAllChanges: (documentId: string) => void;
    rejectAllChanges: (documentId: string) => void;

    // Getters
    getChanges: (documentId: string) => TrackChange[];
    getPendingChanges: (documentId: string) => TrackChange[];
    getChange: (documentId: string, changeId: string) => TrackChange | undefined;

    // UI state
    setActiveChange: (changeId: string | null) => void;

    // Cleanup
    clearChanges: (documentId: string) => void;
}

const generateId = () => `change-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export const useTrackChangesStore = create<TrackChangesState & TrackChangesActions>()(
    persist(
        (set, get) => ({
            changes: {},
            enabled: {},
            showChanges: {},
            activeChangeId: null,

            setEnabled: (documentId, enabled) => {
                set((state) => ({
                    enabled: {
                        ...state.enabled,
                        [documentId]: enabled,
                    },
                }));
            },

            isEnabled: (documentId) => {
                return get().enabled[documentId] ?? false;
            },

            setShowChanges: (documentId, show) => {
                set((state) => ({
                    showChanges: {
                        ...state.showChanges,
                        [documentId]: show,
                    },
                }));
            },

            isShowingChanges: (documentId) => {
                return get().showChanges[documentId] ?? true;
            },

            addChange: (documentId, type, author, authorId, originalContent, newContent) => {
                const id = generateId();
                const change: TrackChange = {
                    id,
                    type,
                    author,
                    authorId,
                    timestamp: new Date().toISOString(),
                    originalContent,
                    newContent,
                    accepted: false,
                    rejected: false,
                };

                set((state) => {
                    const docChanges = state.changes[documentId] || [];
                    return {
                        changes: {
                            ...state.changes,
                            [documentId]: [...docChanges, change],
                        },
                    };
                });

                return id;
            },

            acceptChange: (documentId, changeId) => {
                set((state) => {
                    const docChanges = state.changes[documentId] || [];
                    return {
                        changes: {
                            ...state.changes,
                            [documentId]: docChanges.map((c) =>
                                c.id === changeId
                                    ? { ...c, accepted: true, rejected: false }
                                    : c
                            ),
                        },
                    };
                });
            },

            rejectChange: (documentId, changeId) => {
                set((state) => {
                    const docChanges = state.changes[documentId] || [];
                    return {
                        changes: {
                            ...state.changes,
                            [documentId]: docChanges.map((c) =>
                                c.id === changeId
                                    ? { ...c, accepted: false, rejected: true }
                                    : c
                            ),
                        },
                    };
                });
            },

            acceptAllChanges: (documentId) => {
                set((state) => {
                    const docChanges = state.changes[documentId] || [];
                    return {
                        changes: {
                            ...state.changes,
                            [documentId]: docChanges.map((c) => ({
                                ...c,
                                accepted: true,
                                rejected: false,
                            })),
                        },
                    };
                });
            },

            rejectAllChanges: (documentId) => {
                set((state) => {
                    const docChanges = state.changes[documentId] || [];
                    return {
                        changes: {
                            ...state.changes,
                            [documentId]: docChanges.map((c) => ({
                                ...c,
                                accepted: false,
                                rejected: true,
                            })),
                        },
                    };
                });
            },

            getChanges: (documentId) => {
                return get().changes[documentId] || [];
            },

            getPendingChanges: (documentId) => {
                const docChanges = get().changes[documentId] || [];
                return docChanges.filter((c) => !c.accepted && !c.rejected);
            },

            getChange: (documentId, changeId) => {
                const docChanges = get().changes[documentId] || [];
                return docChanges.find((c) => c.id === changeId);
            },

            setActiveChange: (changeId) => {
                set({ activeChangeId: changeId });
            },

            clearChanges: (documentId) => {
                set((state) => {
                    const { [documentId]: _, ...remaining } = state.changes;
                    return { changes: remaining };
                });
            },
        }),
        {
            name: 'signapps-track-changes-storage',
            partialize: (state) => ({
                changes: state.changes,
                enabled: state.enabled,
                showChanges: state.showChanges,
            }),
        }
    )
);

export default useTrackChangesStore;
