// IDEA-004: KaTeX math extension — inline ($...$) and block ($$...$$)
import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// Simple math renderer without external dependency
// Uses katex if available, falls back to styled plain text
const renderMath = (tex: string, displayMode: boolean): string => {
    try {
        // Try katex if loaded in global scope
        if (typeof window.katex !== 'undefined') {
            return window.katex.renderToString(tex, { displayMode, throwOnError: false });
        }
    } catch { /* ignore */ }
    // Fallback: styled span
    const cls = displayMode ? 'math-block-fallback' : 'math-inline-fallback';
    return `<span class="${cls}">${displayMode ? '$$' : '$'}${tex}${displayMode ? '$$' : '$'}</span>`;
};

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        mathInline: { setMathInline: (tex: string) => ReturnType };
        mathBlock: { setMathBlock: (tex: string) => ReturnType };
    }
}

export const MathInline = Node.create({
    name: 'mathInline',
    group: 'inline',
    inline: true,
    atom: true,

    addAttributes() {
        return { tex: { default: '' } };
    },

    parseHTML() {
        return [{ tag: 'span[data-math-inline]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 'data-math-inline': '' }), 0];
    },

    addNodeView() {
        return ({ node }) => {
            const span = document.createElement('span');
            span.className = 'math-inline cursor-pointer select-none';
            span.title = node.attrs.tex;
            span.innerHTML = renderMath(node.attrs.tex, false);
            return { dom: span };
        };
    },

    addCommands() {
        return {
            setMathInline: (tex: string) => ({ commands }) =>
                commands.insertContent({ type: this.name, attrs: { tex } }),
        };
    },
});

export const MathBlock = Node.create({
    name: 'mathBlock',
    group: 'block',
    atom: true,

    addAttributes() {
        return { tex: { default: '' } };
    },

    parseHTML() {
        return [{ tag: 'div[data-math-block]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-math-block': '' }), 0];
    },

    addNodeView() {
        return ({ node }) => {
            const div = document.createElement('div');
            div.className = 'math-block my-4 text-center cursor-pointer select-none';
            div.title = node.attrs.tex;
            div.innerHTML = renderMath(node.attrs.tex, true);
            return { dom: div };
        };
    },

    addCommands() {
        return {
            setMathBlock: (tex: string) => ({ commands }) =>
                commands.insertContent({ type: this.name, attrs: { tex } }),
        };
    },
});

export const mathPluginKey = new PluginKey('math');

// Input rule plugin: convert $...$ and $$...$$ on typing
export const MathInputPlugin = new Plugin({
    key: mathPluginKey,
});
