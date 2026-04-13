"use client";

import { NodeViewContent, NodeViewWrapper, NodeViewProps } from "@tiptap/react";

export function TranscriptSegmentView({ node }: NodeViewProps) {
  const { speaker, timestamp } = node.attrs;
  const speakerName = String(speaker);
  const initials = speakerName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <NodeViewWrapper>
      <div className="flex gap-3 py-2 group">
        <div className="flex flex-col items-center gap-1 pt-0.5 min-w-[3rem]">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials}
          </div>
          <span className="text-[10px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity">
            {timestamp}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground/70 mb-0.5">
            {speakerName}
          </p>
          <div className="text-sm">
            <NodeViewContent />
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
