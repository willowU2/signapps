import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface TrailingNodeOptions {
  /**
   * The node type to insert at the end of the document.
   * @default 'paragraph'
   */
  node: string;
  /**
   * Nodes that are not considered "content" and won't prevent trailing node insertion.
   * @default ['paragraph']
   */
  notAfter: string[];
}

/**
 * TrailingNode extension ensures there's always an empty paragraph at the end
 * of the document, making it easier for users to continue typing.
 */
export const TrailingNode = Extension.create<TrailingNodeOptions>({
  name: "trailingNode",

  addOptions() {
    return {
      node: "paragraph",
      notAfter: ["paragraph"],
    };
  },

  addProseMirrorPlugins() {
    const plugin = new PluginKey(this.name);
    const disabledNodes = Object.entries(this.editor.schema.nodes)
      .map(([, value]) => value)
      .filter((node) => this.options.notAfter.includes(node.name));

    return [
      new Plugin({
        key: plugin,
        appendTransaction: (_, __, state) => {
          const { doc, tr, schema } = state;
          const shouldInsertNodeAtEnd = plugin.getState(state);
          const endPosition = doc.content.size;
          const type = schema.nodes[this.options.node];

          if (!shouldInsertNodeAtEnd) {
            return;
          }

          return tr.insert(endPosition, type.create());
        },
        state: {
          init: (_, state) => {
            const lastNode = state.doc.lastChild;
            return lastNode ? !disabledNodes.includes(lastNode.type) : false;
          },
          apply: (tr, value) => {
            if (!tr.docChanged) {
              return value;
            }

            const lastNode = tr.doc.lastChild;
            return lastNode ? !disabledNodes.includes(lastNode.type) : false;
          },
        },
      }),
    ];
  },
});
