"use client";

/**
 * markdown-note-widget - render an admin-friendly markdown note.
 *
 * Kept voluntarily minimal : bold, italic, line breaks and headings.
 * No HTML injection path - everything goes through a safe renderer.
 */
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface MarkdownNoteWidgetProps {
  config: Record<string, unknown>;
}

function renderInline(text: string): (string | React.JSX.Element)[] {
  const parts: (string | React.JSX.Element)[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    key += 1;
    if (token.startsWith("**")) {
      parts.push(<strong key={"b-" + key}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={"i-" + key}>{token.slice(1, -1)}</em>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/**
 * Ultra-light markdown to JSX renderer: headings, bold/italic, lists,
 * line breaks. We intentionally avoid pulling a full markdown lib.
 */
function renderMarkdown(raw: string): React.JSX.Element[] {
  const lines = raw.split("\n");
  return lines.map((line, idx) => {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const sizeClass =
        level === 1
          ? "text-lg font-semibold"
          : level === 2
            ? "text-base font-semibold"
            : "text-sm font-semibold";
      return (
        <p key={idx} className={sizeClass + " mt-2"}>
          {renderInline(text)}
        </p>
      );
    }
    if (/^\s*[-*]\s+/.test(line)) {
      return (
        <li key={idx} className="text-sm ml-4 list-disc">
          {renderInline(line.replace(/^\s*[-*]\s+/, ""))}
        </li>
      );
    }
    if (line.trim() === "") {
      return <br key={idx} />;
    }
    return (
      <p key={idx} className="text-sm">
        {renderInline(line)}
      </p>
    );
  });
}

export function MarkdownNoteWidget({ config }: MarkdownNoteWidgetProps) {
  const title = typeof config.title === "string" ? config.title : "Note";
  const body = typeof config.body === "string" ? config.body : "";

  return (
    <Card className="m-4">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="py-2 px-3 space-y-1">
        {body.trim() === "" ? (
          <p className="text-xs text-muted-foreground">Note vide.</p>
        ) : (
          renderMarkdown(body)
        )}
      </CardContent>
    </Card>
  );
}
