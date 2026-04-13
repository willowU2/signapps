import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TranscriptMetaView } from "../transcript-meta-view";

export const TranscriptMeta = Node.create({
  name: "transcriptMeta",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      duration: { default: "" },
      source: { default: "meet" },
      speakers: { default: [] },
      language: { default: "fr" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="transcript-meta"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "transcript-meta" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TranscriptMetaView);
  },
});
