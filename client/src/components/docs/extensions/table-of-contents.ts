import { Node, mergeAttributes } from "@tiptap/core";

export interface TocItem {
  id: string;
  level: number;
  text: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tableOfContents: {
      insertTableOfContents: () => ReturnType;
    };
  }
}

export const TableOfContents = Node.create({
  name: "tableOfContents",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      items: {
        default: [],
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-toc]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-toc": "" })];
  },

  addNodeView() {
    return ({ editor }) => {
      const dom = document.createElement("div");
      dom.className = "table-of-contents";

      const updateToc = () => {
        const headings: TocItem[] = [];
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === "heading") {
            headings.push({
              id: node.attrs.id || `heading-${pos}`,
              level: node.attrs.level,
              text: node.textContent,
            });
          }
        });

        dom.textContent = "";

        const nav = document.createElement("nav");
        nav.className = "toc-nav";

        const h3 = document.createElement("h3");
        h3.className = "toc-title";
        h3.textContent = "Table of Contents";
        nav.appendChild(h3);

        const ul = document.createElement("ul");
        ul.className = "toc-list";

        headings.forEach((h) => {
          const li = document.createElement("li");
          li.className = `toc-level-${Number(h.level)}`;
          const a = document.createElement("a");
          a.href = `#${encodeURIComponent(h.id || "")}`;
          a.className = "toc-link";
          a.textContent = h.text;
          li.appendChild(a);
          ul.appendChild(li);
        });

        nav.appendChild(ul);
        dom.appendChild(nav);
      };

      updateToc();
      editor.on("update", updateToc);

      return {
        dom,
        destroy() {
          editor.off("update", updateToc);
        },
      };
    };
  },

  addCommands() {
    return {
      insertTableOfContents:
        () =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name });
        },
    };
  },
});
