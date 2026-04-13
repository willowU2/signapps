import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TranscriptSegmentView } from "../transcript-segment-view";

export const TranscriptSegment = Node.create({
  name: "transcriptSegment",
  group: "block",
  content: "inline*",

  addAttributes() {
    return {
      speaker: { default: "Speaker" },
      timestamp: { default: "00:00" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="transcript-segment"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "transcript-segment" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TranscriptSegmentView);
  },
});
