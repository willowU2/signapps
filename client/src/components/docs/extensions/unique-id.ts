// Custom UniqueID extension for Tiptap v3
// Adds unique identifiers to nodes for tracking, comments, and collaboration

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { v4 as uuidv4 } from 'uuid';

export interface UniqueIDOptions {
    /**
     * The attribute name for the unique ID
     * @default 'id'
     */
    attributeName: string;
    /**
     * Node types that should get unique IDs
     * @default ['paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem', 'taskItem', 'table', 'tableRow', 'tableCell', 'image']
     */
    types: string[];
    /**
     * Function to generate unique IDs
     * @default uuidv4
     */
    generateID: () => string;
    /**
     * Filter function to determine if a node should get an ID
     * @default () => true
     */
    filterTransaction: (transaction: any) => boolean;
}

export const uniqueIDPluginKey = new PluginKey('uniqueID');

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        uniqueID: {
            /**
             * Reset all unique IDs in the document
             */
            resetUniqueIDs: () => ReturnType;
        };
    }
}

export const UniqueID = Extension.create<UniqueIDOptions>({
    name: 'uniqueID',

    addOptions() {
        return {
            attributeName: 'id',
            types: [
                'paragraph',
                'heading',
                'blockquote',
                'codeBlock',
                'listItem',
                'taskItem',
                'table',
                'tableRow',
                'tableCell',
                'tableHeader',
                'image',
                'horizontalRule',
                'pageBreak',
            ],
            generateID: () => uuidv4(),
            filterTransaction: () => true,
        };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    [this.options.attributeName]: {
                        default: null,
                        parseHTML: (element) => element.getAttribute(`data-${this.options.attributeName}`),
                        renderHTML: (attributes) => {
                            if (!attributes[this.options.attributeName]) {
                                return {};
                            }
                            return {
                                [`data-${this.options.attributeName}`]: attributes[this.options.attributeName],
                            };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            resetUniqueIDs:
                () =>
                ({ tr, dispatch }) => {
                    if (!dispatch) return true;

                    const { doc } = tr;
                    const positions: { pos: number; nodeType: string }[] = [];

                    doc.descendants((node, pos) => {
                        if (this.options.types.includes(node.type.name)) {
                            positions.push({ pos, nodeType: node.type.name });
                        }
                    });

                    // Apply new IDs in reverse order to maintain positions
                    positions.reverse().forEach(({ pos }) => {
                        tr.setNodeMarkup(pos, undefined, {
                            ...tr.doc.nodeAt(pos)?.attrs,
                            [this.options.attributeName]: this.options.generateID(),
                        });
                    });

                    return true;
                },
        };
    },

    addProseMirrorPlugins() {
        const { attributeName, types, generateID, filterTransaction } = this.options;

        return [
            new Plugin({
                key: uniqueIDPluginKey,
                appendTransaction: (transactions, oldState, newState) => {
                    // Only process if document changed
                    const docChanged = transactions.some((tr) => tr.docChanged);
                    if (!docChanged) return null;

                    // Check filter
                    if (!transactions.every(filterTransaction)) return null;

                    const { tr } = newState;
                    let modified = false;

                    // Find nodes that need IDs
                    newState.doc.descendants((node, pos) => {
                        if (!types.includes(node.type.name)) return;

                        const id = node.attrs[attributeName];
                        if (id) return; // Already has ID

                        // Check if this is a new node (not in old state at same position)
                        // Guard: pos may be outside old doc bounds after insert/delete
                        const oldNode = pos < oldState.doc.content.size ? oldState.doc.nodeAt(pos) : null;
                        const isNewNode = !oldNode || oldNode.type !== node.type;

                        // Also assign ID if node doesn't have one (e.g., pasted content)
                        if (isNewNode || !id) {
                            tr.setNodeMarkup(pos, undefined, {
                                ...node.attrs,
                                [attributeName]: generateID(),
                            });
                            modified = true;
                        }
                    });

                    return modified ? tr : null;
                },
            }),
        ];
    },

    // Add IDs to initial content on create
    onCreate() {
        const { state, view } = this.editor;
        const { tr } = state;
        let modified = false;

        state.doc.descendants((node, pos) => {
            if (!this.options.types.includes(node.type.name)) return;

            if (!node.attrs[this.options.attributeName]) {
                tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    [this.options.attributeName]: this.options.generateID(),
                });
                modified = true;
            }
        });

        if (modified) {
            view.dispatch(tr);
        }
    },
});

export default UniqueID;
