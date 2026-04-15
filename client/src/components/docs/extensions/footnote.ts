import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    footnote: {
      insertFootnote: (content: string) => ReturnType;
    };
  }
}

export const Footnote = Node.create({
  name: "footnote",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      number: { default: 1 },
      content: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "sup[data-footnote]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        "data-footnote": "",
        "data-content": node.attrs.content,
        class: "footnote-ref",
      }),
      `[${node.attrs.number}]`,
    ];
  },

  addCommands() {
    return {
      insertFootnote:
        (content: string) =>
        ({ commands, state }) => {
          // Count existing footnotes
          let count = 0;
          state.doc.descendants((node) => {
            if (node.type.name === "footnote") count++;
          });

          return commands.insertContent({
            type: this.name,
            attrs: { number: count + 1, content },
          });
        },
    };
  },
});
