"use client";

import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { Clock, Globe, Users } from "lucide-react";

export function TranscriptMetaView({ node }: NodeViewProps) {
  const { duration, source, speakers, language } = node.attrs;
  const speakerList: string[] = Array.isArray(speakers) ? speakers : [];
  const sourceLabel =
    source === "meet"
      ? "SignApps Meet"
      : source === "external_capture"
        ? "Capture externe"
        : "Mémo vocal";

  return (
    <NodeViewWrapper>
      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground mb-4">
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" /> {duration}
        </span>
        <span className="flex items-center gap-1.5">
          <Globe className="h-4 w-4" /> {String(language).toUpperCase()}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4" /> {speakerList.length} participant
          {speakerList.length > 1 ? "s" : ""}
        </span>
        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
          {sourceLabel}
        </span>
      </div>
    </NodeViewWrapper>
  );
}
