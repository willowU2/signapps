import { Node, mergeAttributes } from '@tiptap/core'

export interface TocItem {
    id: string
    level: number
    text: string
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        tableOfContents: {
            insertTableOfContents: () => ReturnType
        }
    }
}

export const TableOfContents = Node.create({
    name: 'tableOfContents',
    group: 'block',
    atom: true,

    addAttributes() {
        return {
            items: {
                default: [],
            },
        }
    },

    parseHTML() {
        return [{ tag: 'div[data-toc]' }]
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-toc': '' })]
    },

    addNodeView() {
        return ({ editor }) => {
            const dom = document.createElement('div')
            dom.className = 'table-of-contents'

            const updateToc = () => {
                const headings: TocItem[] = []
                editor.state.doc.descendants((node, pos) => {
                    if (node.type.name === 'heading') {
                        headings.push({
                            id: node.attrs.id || `heading-${pos}`,
                            level: node.attrs.level,
                            text: node.textContent,
                        })
                    }
                })

                dom.innerHTML = `
                    <nav class="toc-nav">
                        <h3 class="toc-title">Table of Contents</h3>
                        <ul class="toc-list">
                            ${headings.map(h => `
                                <li class="toc-level-${h.level}">
                                    <a href="#${h.id}" class="toc-link">${h.text}</a>
                                </li>
                            `).join('')}
                        </ul>
                    </nav>
                `
            }

            updateToc()
            editor.on('update', updateToc)

            return {
                dom,
                destroy() {
                    editor.off('update', updateToc)
                },
            }
        }
    },

    addCommands() {
        return {
            insertTableOfContents: () => ({ commands }) => {
                return commands.insertContent({ type: this.name })
            },
        }
    },
})
