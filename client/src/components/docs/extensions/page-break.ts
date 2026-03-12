import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        pageBreak: {
            setPageBreak: () => ReturnType
        }
    }
}

export const PageBreak = Node.create({
    name: 'pageBreak',
    group: 'block',
    atom: true,

    parseHTML() {
        return [
            { tag: 'div[data-page-break]' },
            { tag: 'hr.page-break' },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, {
            'data-page-break': '',
            class: 'page-break',
        })]
    },

    addCommands() {
        return {
            setPageBreak: () => ({ commands }) => {
                return commands.insertContent({ type: this.name })
            },
        }
    },

    addKeyboardShortcuts() {
        return {
            'Mod-Enter': () => this.editor.commands.setPageBreak(),
        }
    },
})
