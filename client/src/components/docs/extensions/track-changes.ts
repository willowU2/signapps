import { Mark as TiptapMark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export type ChangeType = 'insertion' | 'deletion' | 'format';

export interface TrackChange {
    id: string;
    type: ChangeType;
    author: string;
    authorId: string;
    timestamp: string;
    originalContent?: string;
    newContent?: string;
    formatChanges?: Record<string, { from: unknown; to: unknown }>;
    accepted?: boolean;
    rejected?: boolean;
}

export interface TrackChangesOptions {
    HTMLAttributes: Record<string, unknown>;
    enabled: boolean;
    currentUser: {
        id: string;
        name: string;
    };
    onChangeDetected?: (change: TrackChange) => void;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        trackChanges: {
            /**
             * Enable track changes mode
             */
            enableTrackChanges: () => ReturnType;
            /**
             * Disable track changes mode
             */
            disableTrackChanges: () => ReturnType;
            /**
             * Accept a change
             */
            acceptChange: (changeId: string) => ReturnType;
            /**
             * Reject a change
             */
            rejectChange: (changeId: string) => ReturnType;
            /**
             * Accept all changes
             */
            acceptAllChanges: () => ReturnType;
            /**
             * Reject all changes
             */
            rejectAllChanges: () => ReturnType;
        };
    }
}

export const trackChangesPluginKey = new PluginKey('trackChanges');

/**
 * Insertion mark - used to mark added text
 */
export const Insertion = TiptapMark.create({
    name: 'insertion',

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            changeId: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-change-id'),
                renderHTML: (attributes) => {
                    if (!attributes.changeId) return {};
                    return { 'data-change-id': attributes.changeId };
                },
            },
            author: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-author'),
                renderHTML: (attributes) => {
                    if (!attributes.author) return {};
                    return { 'data-author': attributes.author };
                },
            },
            authorId: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-author-id'),
                renderHTML: (attributes) => {
                    if (!attributes.authorId) return {};
                    return { 'data-author-id': attributes.authorId };
                },
            },
            timestamp: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-timestamp'),
                renderHTML: (attributes) => {
                    if (!attributes.timestamp) return {};
                    return { 'data-timestamp': attributes.timestamp };
                },
            },
        };
    },

    parseHTML() {
        return [{ tag: 'ins[data-change-id]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'ins',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                class: 'track-insertion',
            }),
            0,
        ];
    },
});

/**
 * Deletion mark - used to mark removed text (shown as strikethrough)
 */
export const Deletion = TiptapMark.create({
    name: 'deletion',

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            changeId: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-change-id'),
                renderHTML: (attributes) => {
                    if (!attributes.changeId) return {};
                    return { 'data-change-id': attributes.changeId };
                },
            },
            author: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-author'),
                renderHTML: (attributes) => {
                    if (!attributes.author) return {};
                    return { 'data-author': attributes.author };
                },
            },
            authorId: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-author-id'),
                renderHTML: (attributes) => {
                    if (!attributes.authorId) return {};
                    return { 'data-author-id': attributes.authorId };
                },
            },
            timestamp: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-timestamp'),
                renderHTML: (attributes) => {
                    if (!attributes.timestamp) return {};
                    return { 'data-timestamp': attributes.timestamp };
                },
            },
        };
    },

    parseHTML() {
        return [{ tag: 'del[data-change-id]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'del',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                class: 'track-deletion',
            }),
            0,
        ];
    },
});

/**
 * TrackChanges extension - manages track changes mode
 */
export const TrackChanges = TiptapMark.create<TrackChangesOptions>({
    name: 'trackChanges',

    addOptions() {
        return {
            HTMLAttributes: {},
            enabled: false,
            currentUser: {
                id: 'unknown',
                name: 'Unknown',
            },
            onChangeDetected: undefined,
        };
    },

    addStorage() {
        return {
            enabled: this.options.enabled,
            changes: [] as TrackChange[],
        };
    },

    addCommands() {
        return {
            enableTrackChanges:
                () =>
                ({ editor }) => {
                    (editor.storage as Record<string, any>).trackChanges.enabled = true;
                    return true;
                },
            disableTrackChanges:
                () =>
                ({ editor }) => {
                    (editor.storage as Record<string, any>).trackChanges.enabled = false;
                    return true;
                },
            acceptChange:
                (changeId: string) =>
                ({ tr, state, dispatch }) => {
                    const { doc } = state;
                    let modified = false;

                    doc.descendants((node, pos) => {
                        if (!node.isText) return;

                        // Find insertion marks to keep
                        const insertionMark = node.marks.find(
                            (mark) =>
                                mark.type.name === 'insertion' &&
                                mark.attrs.changeId === changeId
                        );
                        if (insertionMark) {
                            tr.removeMark(pos, pos + node.nodeSize, insertionMark);
                            modified = true;
                        }

                        // Find deletion marks to remove content
                        const deletionMark = node.marks.find(
                            (mark) =>
                                mark.type.name === 'deletion' &&
                                mark.attrs.changeId === changeId
                        );
                        if (deletionMark) {
                            tr.delete(pos, pos + node.nodeSize);
                            modified = true;
                        }
                    });

                    if (dispatch && modified) {
                        dispatch(tr);
                    }

                    return modified;
                },
            rejectChange:
                (changeId: string) =>
                ({ tr, state, dispatch }) => {
                    const { doc } = state;
                    let modified = false;

                    doc.descendants((node, pos) => {
                        if (!node.isText) return;

                        // Find insertion marks to remove content
                        const insertionMark = node.marks.find(
                            (mark) =>
                                mark.type.name === 'insertion' &&
                                mark.attrs.changeId === changeId
                        );
                        if (insertionMark) {
                            tr.delete(pos, pos + node.nodeSize);
                            modified = true;
                        }

                        // Find deletion marks to keep content (just remove mark)
                        const deletionMark = node.marks.find(
                            (mark) =>
                                mark.type.name === 'deletion' &&
                                mark.attrs.changeId === changeId
                        );
                        if (deletionMark) {
                            tr.removeMark(pos, pos + node.nodeSize, deletionMark);
                            modified = true;
                        }
                    });

                    if (dispatch && modified) {
                        dispatch(tr);
                    }

                    return modified;
                },
            acceptAllChanges:
                () =>
                ({ tr, state, dispatch }) => {
                    const { doc } = state;
                    let modified = false;

                    // Process in reverse to avoid position shifts
                    const changes: Array<{
                        pos: number;
                        size: number;
                        type: 'insertion' | 'deletion';
                        mark: any;
                    }> = [];

                    doc.descendants((node, pos) => {
                        if (!node.isText) return;

                        const insertionMark = node.marks.find(
                            (m: any) => m.type.name === 'insertion'
                        );
                        if (insertionMark) {
                            changes.push({
                                pos,
                                size: node.nodeSize,
                                type: 'insertion',
                                mark: insertionMark,
                            });
                        }

                        const deletionMark = node.marks.find(
                            (m: any) => m.type.name === 'deletion'
                        );
                        if (deletionMark) {
                            changes.push({
                                pos,
                                size: node.nodeSize,
                                type: 'deletion',
                                mark: deletionMark,
                            });
                        }
                    });

                    // Sort by position descending
                    changes.sort((a, b) => b.pos - a.pos);

                    for (const change of changes) {
                        if (change.type === 'insertion') {
                            tr.removeMark(change.pos, change.pos + change.size, change.mark);
                            modified = true;
                        } else {
                            tr.delete(change.pos, change.pos + change.size);
                            modified = true;
                        }
                    }

                    if (dispatch && modified) {
                        dispatch(tr);
                    }

                    return modified;
                },
            rejectAllChanges:
                () =>
                ({ tr, state, dispatch }) => {
                    const { doc } = state;
                    let modified = false;

                    const changes: Array<{
                        pos: number;
                        size: number;
                        type: 'insertion' | 'deletion';
                        mark: any;
                    }> = [];

                    doc.descendants((node, pos) => {
                        if (!node.isText) return;

                        const insertionMark = node.marks.find(
                            (mark) => mark.type.name === 'insertion'
                        );
                        if (insertionMark) {
                            changes.push({
                                pos,
                                size: node.nodeSize,
                                type: 'insertion',
                                mark: insertionMark,
                            });
                        }

                        const deletionMark = node.marks.find(
                            (mark) => mark.type.name === 'deletion'
                        );
                        if (deletionMark) {
                            changes.push({
                                pos,
                                size: node.nodeSize,
                                type: 'deletion',
                                mark: deletionMark,
                            });
                        }
                    });

                    // Sort by position descending
                    changes.sort((a, b) => b.pos - a.pos);

                    for (const change of changes) {
                        if (change.type === 'insertion') {
                            tr.delete(change.pos, change.pos + change.size);
                            modified = true;
                        } else {
                            tr.removeMark(change.pos, change.pos + change.size, change.mark);
                            modified = true;
                        }
                    }

                    if (dispatch && modified) {
                        dispatch(tr);
                    }

                    return modified;
                },
        };
    },

    addProseMirrorPlugins() {
        const extension = this;

        return [
            new Plugin({
                key: trackChangesPluginKey,
                appendTransaction(transactions, _oldState, newState) {
                    if (!extension.storage.enabled) {
                        return null;
                    }

                    // Check if any transaction has actual changes
                    const hasDocChanges = transactions.some(
                        (tr) => tr.docChanged && !tr.getMeta('trackChangesProcessed')
                    );
                    if (!hasDocChanges) {
                        return null;
                    }

                    // Process changes would be handled here
                    // For now, we just mark transactions as processed
                    const tr = newState.tr;
                    tr.setMeta('trackChangesProcessed', true);

                    return tr;
                },
            }),
        ];
    },
});

export default TrackChanges;
