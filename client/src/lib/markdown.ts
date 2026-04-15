import TurndownService from "turndown";

// Create a configured Turndown instance for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
});

// Add custom rules for better conversion
turndownService.addRule("strikethrough", {
  filter: ["del", "s"] as (keyof HTMLElementTagNameMap)[],
  replacement: (content) => `~~${content}~~`,
});

turndownService.addRule("taskList", {
  filter: (node) => {
    return (
      node.nodeName === "LI" &&
      node.parentNode?.nodeName === "UL" &&
      node.querySelector('input[type="checkbox"]') !== null
    );
  },
  replacement: (content, node) => {
    const checkbox = (node as HTMLElement).querySelector(
      'input[type="checkbox"]',
    );
    const isChecked = checkbox?.hasAttribute("checked");
    const cleanContent = content.replace(/^\s*\[.\]\s*/, "").trim();
    return `- [${isChecked ? "x" : " "}] ${cleanContent}\n`;
  },
});

turndownService.addRule("highlight", {
  filter: "mark",
  replacement: (content) => `==${content}==`,
});

/**
 * Convert HTML content to Markdown
 */
export function htmlToMarkdown(html: string): string {
  return turndownService.turndown(html);
}

/**
 * Convert Markdown to HTML (basic conversion using regex)
 * For full Markdown parsing, consider using a library like marked
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gm, "<h1>$1</h1>");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Code blocks
  html = html.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    '<pre><code class="language-$1">$2</code></pre>',
  );

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Unordered lists
  html = html.replace(/^\s*[-*+]\s+(.*)$/gm, "<li>$1</li>");

  // Ordered lists
  html = html.replace(/^\s*\d+\.\s+(.*)$/gm, "<li>$1</li>");

  // Task lists
  html = html.replace(/<li>\[(x| )\]\s+(.*)<\/li>/g, (_, checked, content) => {
    const isChecked = checked === "x";
    return `<li data-type="taskItem" data-checked="${isChecked}">${content}</li>`;
  });

  // Wrap consecutive li in ul
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (match) => {
    return `<ul>${match}</ul>`;
  });

  // Blockquotes
  html = html.replace(/^>\s+(.*)$/gm, "<blockquote>$1</blockquote>");

  // Horizontal rules
  html = html.replace(/^---$/gm, "<hr />");

  // Paragraphs (wrap remaining text)
  html = html.replace(/^(?!<[a-z])(.*\S.*)$/gm, "<p>$1</p>");

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, "");

  return html;
}

/**
 * Detect if text is likely Markdown
 */
export function isMarkdown(text: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s+/m, // Headers
    /\*\*.*\*\*/, // Bold
    /\[.*\]\(.*\)/, // Links
    /^[-*+]\s+/m, // Unordered lists
    /^\d+\.\s+/m, // Ordered lists
    /^```/m, // Code blocks
    /^>\s+/m, // Blockquotes
    /^---$/m, // Horizontal rules
    /!\[.*\]\(.*\)/, // Images
  ];

  return markdownPatterns.some((pattern) => pattern.test(text));
}
