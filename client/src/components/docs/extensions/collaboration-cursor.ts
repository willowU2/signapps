// Custom CollaborationCursor extension for Tiptap v3
// Shows remote user cursors and selections in collaborative editing

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface CollaborationCursorUser {
    name: string;
    color: string;
    clientId?: number;
}

export interface CollaborationCursorOptions {
    provider: any; // Y.js provider (WebsocketProvider, etc.)
    user: CollaborationCursorUser;
    render?: (user: CollaborationCursorUser) => HTMLElement;
    selectionRender?: (user: CollaborationCursorUser) => { style: string };
}

export const collaborationCursorPluginKey = new PluginKey('collaborationCursor');

const defaultRender = (user: CollaborationCursorUser): HTMLElement => {
    const cursor = document.createElement('span');
    cursor.classList.add('collaboration-cursor__caret');
    cursor.style.borderColor = user.color;

    const label = document.createElement('div');
    label.classList.add('collaboration-cursor__label');
    label.style.backgroundColor = user.color;
    label.textContent = user.name;

    cursor.appendChild(label);
    return cursor;
};

const defaultSelectionRender = (user: CollaborationCursorUser) => ({
    style: `background-color: ${user.color}33;`, // 20% opacity
});

export const CollaborationCursor = Extension.create<CollaborationCursorOptions>({
    name: 'collaborationCursor',

    addOptions() {
        return {
            provider: null,
            user: {
                name: 'Anonymous',
                color: '#6366f1',
            },
            render: defaultRender,
            selectionRender: defaultSelectionRender,
        };
    },

    addProseMirrorPlugins() {
        const { provider, user, render, selectionRender } = this.options;

        if (!provider) {
            console.warn('CollaborationCursor: No provider specified');
            return [];
        }

        // Get awareness from provider
        const awareness = provider.awareness;
        if (!awareness) {
            console.warn('CollaborationCursor: Provider has no awareness');
            return [];
        }

        // Set local user state
        awareness.setLocalStateField('user', user);

        return [
            new Plugin({
                key: collaborationCursorPluginKey,
                state: {
                    init() {
                        return DecorationSet.empty;
                    },
                    apply(tr, decorationSet, oldState, newState) {
                        // Update decorations based on awareness states
                        const decorations: Decoration[] = [];
                        const states = awareness.getStates();

                        states.forEach((state: any, clientId: number) => {
                            // Skip local user
                            if (clientId === awareness.clientID) return;

                            const remoteUser = state.user as CollaborationCursorUser | undefined;
                            if (!remoteUser) return;

                            const cursor = state.cursor;
                            if (!cursor) return;

                            const { anchor, head } = cursor;

                            // Validate positions
                            if (anchor < 0 || head < 0) return;
                            if (anchor > newState.doc.content.size || head > newState.doc.content.size) return;

                            // Add selection decoration
                            if (anchor !== head) {
                                const from = Math.min(anchor, head);
                                const to = Math.max(anchor, head);
                                const selectionStyle = (selectionRender || defaultSelectionRender)(remoteUser);

                                decorations.push(
                                    Decoration.inline(from, to, {
                                        class: 'collaboration-cursor__selection',
                                        style: selectionStyle.style,
                                    })
                                );
                            }

                            // Add cursor decoration
                            const cursorElement = (render || defaultRender)({ ...remoteUser, clientId });
                            decorations.push(
                                Decoration.widget(head, cursorElement, {
                                    key: `cursor-${clientId}`,
                                    side: 1,
                                })
                            );
                        });

                        return DecorationSet.create(newState.doc, decorations);
                    },
                },
                props: {
                    decorations(state) {
                        return this.getState(state);
                    },
                },
                view() {
                    // Update local cursor position on selection change
                    const updateCursor = () => {
                        const { state } = this.editor!.view;
                        const { from, to } = state.selection;

                        awareness.setLocalStateField('cursor', {
                            anchor: from,
                            head: to,
                        });
                    };

                    // Listen for awareness changes
                    const onAwarenessChange = () => {
                        // Force plugin state update
                        const { state, dispatch } = this.editor!.view;
                        dispatch(state.tr.setMeta(collaborationCursorPluginKey, { updated: true }));
                    };

                    awareness.on('change', onAwarenessChange);

                    return {
                        update: updateCursor,
                        destroy: () => {
                            awareness.off('change', onAwarenessChange);
                        },
                    };
                },
            }),
        ];
    },
});

export default CollaborationCursor;
