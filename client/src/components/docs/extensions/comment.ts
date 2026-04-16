import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface CommentData {
  id: string;
  author: string;
  authorId: string;
  content: string;
  createdAt: string;
  resolved: boolean;
  replies: CommentReply[];
}

export interface CommentReply {
  id: string;
  author: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface CommentOptions {
  HTMLAttributes: Record<string, unknown>;
  onCommentActivated?: (commentId: string | null) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      /**
       * Set a comment on selected text
       */
      setComment: (commentId: string) => ReturnType;
      /**
       * Remove a comment
       */
      unsetComment: (commentId: string) => ReturnType;
      /**
       * Toggle comment resolved state
       */
      resolveComment: (commentId: string) => ReturnType;
    };
  }
}

export const commentPluginKey = new PluginKey("comment");

export const Comment = Mark.create<CommentOptions>({
  name: "comment",

  addOptions() {
    return {
      HTMLAttributes: {},
      onCommentActivated: undefined,
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-comment-id"),
        renderHTML: (attributes) => {
          if (!attributes.commentId) {
            return {};
          }
          return {
            "data-comment-id": attributes.commentId,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-comment-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "comment-highlight",
      }),
      0,
    ];
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
        ({ tr, state, dispatch }) => {
          const { doc } = state;
          let modified = false;

          doc.descendants((node, pos) => {
            if (!node.isText) return;

            const marks = node.marks.filter(
              (mark) =>
                mark.type.name === this.name &&
                mark.attrs.commentId === commentId,
            );

            marks.forEach((mark) => {
              tr.removeMark(pos, pos + node.nodeSize, mark);
              modified = true;
            });
          });

          if (dispatch && modified) {
            dispatch(tr);
          }

          return modified;
        },
      resolveComment:
        (_commentId: string) =>
        ({ commands }) => {
          // Resolution state is managed externally in comments store
          // This command is for triggering UI updates
          return commands.focus();
        },
    };
  },

  addProseMirrorPlugins() {
    const { onCommentActivated } = this.options;
    let lastActiveCommentId: string | null = null;

    return [
      new Plugin({
        key: commentPluginKey,
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = [];
            const { doc, selection } = state;
            const { from, to } = selection;

            // Find active comment at cursor position
            let activeCommentId: string | null = null;

            doc.nodesBetween(from, to, (node) => {
              if (!node.isText) return;

              const commentMark = node.marks.find(
                (mark) => mark.type.name === "comment",
              );

              if (commentMark) {
                activeCommentId = commentMark.attrs.commentId;
              }
            });

            // Only call callback if value changed to prevent infinite loops
            if (onCommentActivated && activeCommentId !== lastActiveCommentId) {
              lastActiveCommentId = activeCommentId;
              // Use setTimeout to avoid calling setState during render
              setTimeout(() => onCommentActivated(activeCommentId), 0);
            }

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
