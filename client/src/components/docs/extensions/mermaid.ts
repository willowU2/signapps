// IDEA-005: Mermaid diagram extension — renders ```mermaid code blocks as SVG
import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        mermaidDiagram: { insertMermaid: (code: string) => ReturnType };
    }
}

const renderMermaid = async (code: string, dom: HTMLElement): Promise<void> => {
    try {
        // Dynamic import to avoid SSR issues — mermaid may not be installed
        // Use Function constructor to bypass TS module resolution at compile time
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mermaid: any = await new Function('pkg', 'return import(pkg)')('mermaid').catch(() => null);
        if (!mermaid) {
            dom.innerHTML = `<pre class="mermaid-fallback text-xs text-gray-500 p-2 bg-gray-50 dark:bg-gray-900 rounded">${code}</pre>`;
            return;
        }
        mermaid.default.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.default.render(id, code);
        dom.innerHTML = svg;
    } catch (err) {
        dom.innerHTML = `<div class="text-red-500 text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200">
            <strong>Mermaid error:</strong> ${String(err)}
            <pre class="mt-1 text-gray-500">${code}</pre>
        </div>`;
    }
};

export const MermaidDiagram = Node.create({
    name: 'mermaidDiagram',
    group: 'block',
    atom: true,

    addAttributes() {
        return { code: { default: 'graph TD\n    A-->B' } };
    },

    parseHTML() {
        return [{ tag: 'div[data-mermaid]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-mermaid': '' }), 0];
    },

    addNodeView() {
        return ({ node }) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'mermaid-diagram my-4 flex justify-center overflow-auto p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700';
            wrapper.contentEditable = 'false';

            const inner = document.createElement('div');
            inner.className = 'mermaid-inner';
            inner.textContent = 'Rendering diagram...';
            wrapper.appendChild(inner);

            renderMermaid(node.attrs.code, inner);

            return {
                dom: wrapper,
                update(updatedNode) {
                    if (updatedNode.attrs.code !== node.attrs.code) {
                        renderMermaid(updatedNode.attrs.code, inner);
                    }
                    return true;
                },
            };
        };
    },

    addCommands() {
        return {
            insertMermaid: (code: string) => ({ commands }) =>
                commands.insertContent({ type: this.name, attrs: { code } }),
        };
    },
});
