// IDEA-006: Multi-column layout extension — 2 or 3 column layouts
import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columns: {
      setColumns: (count: 2 | 3) => ReturnType;
      unsetColumns: () => ReturnType;
    };
  }
}

export const ColumnBlock = Node.create({
  name: "columnBlock",
  group: "block",
  content: "block+",
  isolating: true,

  addAttributes() {
    return {
      columnIndex: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-column-block]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-column-block": "",
        class: "column-block min-h-[60px] p-2",
      }),
      0,
    ];
  },
});

export const Columns = Node.create({
  name: "columns",
  group: "block",
  content: "columnBlock+",

  addAttributes() {
    return {
      count: { default: 2 },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-columns]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const count = node.attrs.count || 2;
    const gridClass = count === 3 ? "grid-cols-3" : "grid-cols-2";
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-columns": count,
        class: `grid ${gridClass} gap-4 my-4 border border-dashed border-gray-300 dark:border-gray-600 rounded p-2`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setColumns:
        (count: 2 | 3) =>
        ({ commands }) => {
          const cols = Array.from({ length: count }, (_, i) => ({
            type: "columnBlock",
            attrs: { columnIndex: i },
            content: [{ type: "paragraph" }],
          }));
          return commands.insertContent({
            type: this.name,
            attrs: { count },
            content: cols,
          });
        },
      unsetColumns:
        () =>
        ({ commands }) =>
          commands.lift("columnBlock"),
    };
  },
});
