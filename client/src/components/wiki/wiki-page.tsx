"use client";

import { useMemo } from "react";
import { Edit2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

interface TableOfContentsItem {
  id: string;
  title: string;
  level: number;
}

interface WikiPageProps {
  title: string;
  content: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  onEdit?: () => void;
  editableByUser?: boolean;
}

/**
 * Extract headers from markdown-style content and create a table of contents
 */
function extractTableOfContents(content: string): TableOfContentsItem[] {
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  const items: TableOfContentsItem[] = [];
  let match;

  while ((match = headerRegex.exec(content)) !== null) {
    const level = match[1].length;
    const title = match[2];
    const id = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");

    items.push({ id, title, level });
  }

  return items;
}

/**
 * Convert markdown content to HTML
 * Supports: headers, bold, italic, code blocks, lists, links
 */
function markdownToHtml(content: string): string {
  let html = content
    // Headers
    .replace(/^### (.*?)$/gm, "<h3 class='text-lg font-semibold mt-4 mb-2'>$1</h3>")
    .replace(/^## (.*?)$/gm, "<h2 class='text-xl font-bold mt-6 mb-3'>$1</h2>")
    .replace(/^# (.*?)$/gm, "<h1 class='text-2xl font-bold mt-8 mb-4'>$1</h1>")
    // Bold
    .replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold'>$1</strong>")
    // Italic
    .replace(/_(.*?)_/g, "<em class='italic'>$1</em>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code class='bg-muted px-1.5 py-0.5 rounded font-mono text-sm'>$1</code>")
    // Links
    .replace(/\[(.*?)\]\((.*?)\)/g, "<a href='$2' class='text-blue-600 hover:underline'>$1</a>")
    // Line breaks
    .replace(/\n\n/g, "</p><p>")
    // Lists (basic)
    .replace(/^\s*[-*]\s+(.*?)$/gm, "<li class='ml-4'>$1</li>");

  // Wrap content in paragraphs
  if (!html.startsWith("<h") && !html.startsWith("<p")) {
    html = `<p>${html}</p>`;
  }

  return html
    .replace(/(<li[^>]*>[\s\S]*?<\/li>)/, "<ul class='list-disc space-y-1'>$1</ul>")
    .replace(/\n/g, "<br/>");
}

export function WikiPage({
  title,
  content,
  breadcrumbs = [],
  onEdit,
  editableByUser = false,
}: WikiPageProps) {
  const tableOfContents = useMemo(
    () => extractTableOfContents(content),
    [content]
  );

  const htmlContent = useMemo(() => markdownToHtml(content), [content]);

  return (
    <div className="flex gap-6 min-h-screen bg-background">
      {/* Main Content */}
      <div className="flex-1 max-w-4xl">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <div className="mb-6 border-b pb-4">
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {idx > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {crumb.href ? (
                        <BreadcrumbLink href={crumb.href}>
                          {crumb.label}
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </div>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        )}

        {/* Title and Edit Button */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-foreground">{title}</h1>
          </div>
          {editableByUser && onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="mt-2 whitespace-nowrap"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>

        {/* Content */}
        <Card className="p-6 prose prose-sm max-w-none">
          <div
            className={cn(
              "space-y-4 text-base leading-relaxed",
              "prose-headings:font-bold prose-headings:text-foreground",
              "prose-p:text-muted-foreground prose-p:mb-4",
              "prose-a:text-blue-600 prose-a:hover:underline",
              "prose-code:bg-muted prose-code:px-2 prose-code:py-1 prose-code:rounded",
              "prose-ul:list-disc prose-ul:pl-6 prose-li:text-muted-foreground"
            )}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </Card>
      </div>

      {/* Table of Contents Sidebar */}
      {tableOfContents.length > 0 && (
        <aside className="w-64 hidden lg:block sticky top-4 self-start">
          <Card className="p-4">
            <h3 className="font-semibold text-sm text-foreground mb-4">
              On this page
            </h3>
            <nav className="space-y-2">
              {tableOfContents.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={cn(
                    "text-sm text-muted-foreground hover:text-foreground transition-colors block truncate",
                    item.level === 1 && "font-medium",
                    item.level > 1 && "ml-4",
                    item.level > 2 && "ml-8"
                  )}
                  title={item.title}
                >
                  {item.title}
                </a>
              ))}
            </nav>
          </Card>
        </aside>
      )}
    </div>
  );
}
