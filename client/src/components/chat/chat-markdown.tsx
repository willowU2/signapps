"use client";

import DOMPurify from "isomorphic-dompurify";
import { cn } from "@/lib/utils";

interface ChatMarkdownProps {
  content: string;
  className?: string;
}

/**
 * IDEA-143: Markdown formatting in messages.
 * Renders **bold**, *italic*, `code`, ```code blocks```, [links](url),
 * and ~~strikethrough~~ inline in chat messages.
 * Content is HTML-escaped before inline processing and the final result is
 * passed through DOMPurify to prevent any XSS that bypasses regex sanitization.
 */
export function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  const rendered = DOMPurify.sanitize(renderMarkdown(content), {
    FORBID_TAGS: ["script", "iframe", "object", "embed"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
  return (
    <span
      className={cn("chat-markdown", className)}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMarkdown(raw: string): string {
  // Split into code-block segments to avoid processing markdown inside them
  const segments = raw.split(/(```[\s\S]*?```)/g);
  return segments
    .map((seg, i) => {
      if (i % 2 === 1) {
        // Code block — strip the backticks, escape, wrap
        const inner = seg.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
        return `<pre class="chat-code-block bg-muted/70 rounded-md px-3 py-2 my-1 text-sm font-mono overflow-x-auto whitespace-pre">${escape(inner)}</pre>`;
      }
      return renderInline(seg);
    })
    .join("");
}

function renderInline(text: string): string {
  let out = escape(text);

  // Inline code `...`
  out = out.replace(
    /`([^`]+)`/g,
    (_, c) =>
      `<code class="bg-muted/70 rounded px-1 py-0.5 text-[13px] font-mono">${c}</code>`,
  );

  // Bold **text** or __text__
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic *text* or _text_ (not greedy, avoid double-processing)
  out = out.replace(/\*(?!\*)(.+?)\*(?!\*)/g, "<em>$1</em>");
  out = out.replace(/_(?!_)(.+?)_(?!_)/g, "<em>$1</em>");

  // Strikethrough ~~text~~
  out = out.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Links [text](url) — only http/https
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    `<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline underline-offset-2 hover:text-primary/80">$1</a>`,
  );

  // Bare URLs
  out = out.replace(
    /(?<!["\(])(https?:\/\/[^\s<>]+)/g,
    `<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline underline-offset-2 hover:text-primary/80">$1</a>`,
  );

  // Newlines
  out = out.replace(/\n/g, "<br/>");

  return out;
}
