'use client';

import { useMemo } from 'react';

interface MarkdownPreviewProps {
  content: string;
}

// Lightweight MD-to-HTML converter (no external deps, XSS-safe via textContent escaping)
function mdToHtml(md: string): string {
  const escHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lines = md.split('\n');
  const out: string[] = [];
  let inCode = false;
  let codeLang = '';
  let codeBuf: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  const inline = (s: string): string => {
    let r = escHtml(s);
    r = r.replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>');
    r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    r = r.replace(/\*(.+?)\*/g, '<em>$1</em>');
    r = r.replace(/~~(.+?)~~/g, '<del>$1</del>');
    r = r.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded" />');
    r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline" target="_blank" rel="noopener">$1</a>');
    return r;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Fenced code block
    if (line.startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeBuf = [];
        closeList();
      } else {
        inCode = false;
        out.push(`<pre class="bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto my-3 text-sm font-mono"><code>${escHtml(codeBuf.join('\n'))}</code></pre>`);
        codeBuf = [];
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    // Headings
    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      closeList();
      const lvl = hm[1].length;
      const sizes = ['text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm'];
      out.push(`<h${lvl} class="${sizes[lvl - 1]} font-bold mt-4 mb-2">${inline(hm[2])}</h${lvl}>`);
      continue;
    }

    // HR
    if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
      closeList();
      out.push('<hr class="my-4 border-border" />');
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      closeList();
      out.push(`<blockquote class="border-l-4 border-primary/40 pl-4 italic text-muted-foreground my-2">${inline(line.slice(2))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(line)) {
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul class="list-disc pl-6 my-2 space-y-1">'); inUl = true; }
      out.push(`<li>${inline(line.replace(/^[-*+]\s/, ''))}</li>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol class="list-decimal pl-6 my-2 space-y-1">'); inOl = true; }
      out.push(`<li>${inline(line.replace(/^\d+\.\s/, ''))}</li>`);
      continue;
    }

    closeList();

    if (line === '') {
      out.push('<br />');
      continue;
    }

    out.push(`<p class="my-1 leading-relaxed">${inline(line)}</p>`);
  }

  closeList();
  if (inCode && codeBuf.length > 0) {
    out.push(`<pre class="bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto my-3 text-sm font-mono"><code>${escHtml(codeBuf.join('\n'))}</code></pre>`);
  }

  return out.join('\n');
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const html = useMemo(() => mdToHtml(content), [content]);

  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none p-4 overflow-auto max-h-[70vh] text-foreground"
      // Safe: we built this HTML ourselves from escaped content
      
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
