import { Node, mergeAttributes } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";

export interface MentionOptions {
  HTMLAttributes: Record<string, unknown>;
  suggestion: Omit<SuggestionOptions, "editor">;
}

export interface MentionUser {
  id: string;
  name: string;
  username: string;
  avatar?: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mention: {
      /**
       * Insert a mention
       */
      insertMention: (user: MentionUser) => ReturnType;
    };
  }
}

export const MentionPluginKey = new PluginKey("mention");

export const Mention = Node.create<MentionOptions>({
  name: "mention",

  addOptions() {
    return {
      HTMLAttributes: {},
      suggestion: {
        char: "@",
        pluginKey: MentionPluginKey,
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: this.name,
                attrs: props,
              },
              {
                type: "text",
                text: " ",
              },
            ])
            .run();
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const type = state.schema.nodes[this.name];
          return !!$from.parent.type.contentMatch.matchType(type);
        },
      },
    };
  },

  group: "inline",

  inline: true,

  selectable: false,

  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-mention-id"),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {};
          }
          return {
            "data-mention-id": attributes.id,
          };
        },
      },
      name: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-mention-name"),
        renderHTML: (attributes) => {
          if (!attributes.name) {
            return {};
          }
          return {
            "data-mention-name": attributes.name,
          };
        },
      },
      username: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-mention-username"),
        renderHTML: (attributes) => {
          if (!attributes.username) {
            return {};
          }
          return {
            "data-mention-username": attributes.username,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `span[data-mention-id]`,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "mention",
      }),
      `@${node.attrs.username || node.attrs.name}`,
    ];
  },

  renderText({ node }) {
    return `@${node.attrs.username || node.attrs.name}`;
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
          let isMention = false;
          const { selection } = state;
          const { empty, anchor } = selection;

          if (!empty) {
            return false;
          }

          state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
            if (node.type.name === this.name) {
              isMention = true;
              tr.insertText("", pos, pos + node.nodeSize);
              return false;
            }
          });

          return isMention;
        }),
    };
  },

  addCommands() {
    return {
      insertMention:
        (user: MentionUser) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              id: user.id,
              name: user.name,
              username: user.username,
            },
          });
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
