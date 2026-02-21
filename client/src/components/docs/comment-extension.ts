import { Mark, mergeAttributes } from '@tiptap/core';

export interface CommentOptions {
    HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        comment: {
            /**
             * Set a comment mark
             */
            setComment: (commentId: string) => ReturnType;
            /**
             * Unset a comment mark
             */
            unsetComment: (commentId: string) => ReturnType;
        };
    }
}

export const Comment = Mark.create<CommentOptions>({
    name: 'comment',

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            commentId: {
                default: null,
                parseHTML: element => element.getAttribute('data-comment-id'),
                renderHTML: attributes => {
                    if (!attributes.commentId) {
                        return {};
                    }

                    return {
                        'data-comment-id': attributes.commentId,
                        class: 'comment-mark',
                    };
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-comment-id]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setComment:
                (commentId: string) =>
                    ({ commands }) => {
                        return commands.setMark(this.name, { commentId });
                    },
            unsetComment:
                (commentId: string) =>
                    ({ tr, dispatch }) => {
                        if (!dispatch) {
                            return true;
                        }

                        const { doc, selection } = tr;
                        const { from, to } = selection;
                        let hasComment = false;

                        doc.nodesBetween(from, to, (node, pos) => {
                            if (hasComment) return false;
                            if (node.marks.find(mark => mark.type.name === this.name && mark.attrs.commentId === commentId)) {
                                hasComment = true;
                            }
                        })

                        if (!hasComment) return false;

                        tr.removeMark(from, to, this.type);

                        return true;
                    },
        };
    },
});
