import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        embedSheet: {
            /**
             * Insert a sheet embed into the document
             */
            insertSheetEmbed: (attrs: {
                sheetId: string
                sheetName: string
                range?: string
            }) => ReturnType
        }
    }
}

export interface EmbedSheetOptions {
    HTMLAttributes: Record<string, unknown>
    /** React component to render the node view */
    component: any
}

export const EmbedSheet = Node.create<EmbedSheetOptions>({
    name: 'embedSheet',
    group: 'block',
    atom: true,
    draggable: true,

    addOptions() {
        return {
            HTMLAttributes: {},
            component: null,
        }
    },

    addAttributes() {
        return {
            sheetId: {
                default: '',
                parseHTML: (element) => element.getAttribute('data-sheet-id'),
                renderHTML: (attributes) => ({
                    'data-sheet-id': attributes.sheetId,
                }),
            },
            sheetName: {
                default: 'Untitled Sheet',
                parseHTML: (element) => element.getAttribute('data-sheet-name'),
                renderHTML: (attributes) => ({
                    'data-sheet-name': attributes.sheetName,
                }),
            },
            range: {
                default: '',
                parseHTML: (element) => element.getAttribute('data-range'),
                renderHTML: (attributes) => ({
                    'data-range': attributes.range,
                }),
            },
            lastRefreshed: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-last-refreshed'),
                renderHTML: (attributes) => ({
                    'data-last-refreshed': attributes.lastRefreshed,
                }),
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-embed-sheet]',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                'data-embed-sheet': '',
                class: 'embed-sheet-block',
            }),
            `[Sheet: ${HTMLAttributes['data-sheet-name']}]`,
        ]
    },

    addNodeView() {
        if (this.options.component) {
            return ReactNodeViewRenderer(this.options.component)
        }
        return () => ({})
    },

    addCommands() {
        return {
            insertSheetEmbed:
                (attrs) =>
                ({ commands }) => {
                    return commands.insertContent({
                        type: this.name,
                        attrs: {
                            ...attrs,
                            lastRefreshed: new Date().toISOString(),
                        },
                    })
                },
        }
    },
})
