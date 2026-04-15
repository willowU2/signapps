"use client";

import { useState } from "react";
import { ChevronRight, Book, FileText, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface WikiPage {
  id: string;
  title: string;
  href: string;
  level?: number;
}

export interface WikiSpace {
  id: string;
  title: string;
  href?: string;
  expanded?: boolean;
  pages: (WikiPage | WikiSpace)[];
}

interface WikiSidebarProps {
  spaces: WikiSpace[];
  currentPageId?: string;
  onNavigate?: (href: string) => void;
}

interface TreeNodeProps {
  item: WikiPage | WikiSpace;
  isSpace: boolean;
  level: number;
  isCurrentPage: boolean;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  onNavigate?: (href: string) => void;
}

function TreeNode({
  item,
  isSpace,
  level,
  isCurrentPage,
  expanded,
  onToggleExpand,
  onNavigate,
}: TreeNodeProps) {
  const hasChildren = isSpace && (item as WikiSpace).pages.length > 0;
  const href = item.href || "#";

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors",
          isCurrentPage
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onToggleExpand(item.id);
            }}
            className={cn(
              "flex items-center justify-center transition-transform",
              expanded && "rotate-90",
            )}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
        {!hasChildren && <div className="w-4" />}

        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isSpace ? (
            <Folder className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          )}
          <a
            href={href}
            onClick={(e) => {
              if (onNavigate && href !== "#") {
                e.preventDefault();
                onNavigate(href);
              }
            }}
            className={cn(
              "truncate transition-colors hover:text-foreground",
              isCurrentPage && "font-medium",
            )}
            title={item.title}
          >
            {item.title}
          </a>
        </div>
      </div>

      {/* Child pages/spaces */}
      {hasChildren && expanded && (
        <div>
          {(item as WikiSpace).pages.map((child) => (
            <TreeNode
              key={child.id}
              item={child}
              isSpace={"pages" in child}
              level={level + 1}
              isCurrentPage={child.id === "currentPageId"}
              expanded={(child as WikiSpace).expanded ?? false}
              onToggleExpand={onToggleExpand}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function WikiSidebar({
  spaces,
  currentPageId,
  onNavigate,
}: WikiSidebarProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(spaces.map((s) => s.id)),
  );

  const handleToggleExpand = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  return (
    <aside className="w-72 h-screen sticky top-0 border-r bg-muted/30 overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2 px-2">
          <Book className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Wiki</h2>
        </div>

        {/* Search placeholder - can be enhanced later */}
        {/* <Input
          placeholder="Rechercher..."
          className="h-8"
        /> */}

        {/* Wiki Spaces Tree */}
        <nav className="space-y-1">
          {spaces.length === 0 ? (
            <div className="text-xs text-muted-foreground px-2 py-4 text-center">
              No wiki spaces yet
            </div>
          ) : (
            spaces.map((space) => (
              <TreeNode
                key={space.id}
                item={space}
                isSpace={true}
                level={0}
                isCurrentPage={space.id === currentPageId}
                expanded={expandedNodes.has(space.id)}
                onToggleExpand={handleToggleExpand}
                onNavigate={onNavigate}
              />
            ))
          )}
        </nav>
      </div>
    </aside>
  );
}
