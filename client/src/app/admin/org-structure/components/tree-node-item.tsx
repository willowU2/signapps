"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Edit,
  Move,
  Trash2,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getNodeTypeConfig } from "./tab-config";
import type { OrgNode } from "@/types/org";

// =============================================================================
// TreeNode type (local — extends OrgNode with children)
// =============================================================================

export interface TreeNode extends OrgNode {
  children: TreeNode[];
  _personCount?: number;
}

// =============================================================================
// BoardInfo
// =============================================================================

export interface BoardInfo {
  decisionMakerName?: string;
  isInherited: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

export function matchesSearch(node: TreeNode, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (node.name.toLowerCase().includes(q)) return true;
  if (node.code?.toLowerCase().includes(q)) return true;
  return node.children.some((c) => matchesSearch(c, q));
}

// =============================================================================
// TreeNodeItem
// =============================================================================

export interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (node: TreeNode) => void;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onContextAction: (action: string, node: TreeNode) => void;
  searchQuery: string;
  draggedId: string | null;
  onDragStart: (id: string) => void;
  onDrop: (targetId: string) => void;
  onDragEnd: () => void;
  onDoubleClick?: (node: TreeNode) => void;
  boardMap?: Record<string, BoardInfo>;
}

function TreeNodeItemInner({
  node,
  depth,
  selectedId,
  onSelect,
  expanded,
  onToggleExpand,
  onContextAction,
  searchQuery,
  draggedId,
  onDragStart,
  onDrop,
  onDragEnd,
  onDoubleClick,
  boardMap,
}: TreeNodeItemProps) {
  const [dragOver, setDragOver] = useState(false);
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const cfg = getNodeTypeConfig(node.node_type);
  const hasChildren = node.children.length > 0;
  const isDragged = draggedId === node.id;

  if (searchQuery && !matchesSearch(node, searchQuery)) return null;

  const visibleChildren = searchQuery
    ? node.children.filter((c) => matchesSearch(c, searchQuery))
    : node.children;

  const showChildren = searchQuery ? true : isExpanded;

  return (
    <div
      className={cn(isDragged && "opacity-40")}
      onDragOver={(e) => e.preventDefault()}
    >
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              onDragStart(node.id);
            }}
            onDragEnd={onDragEnd}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "move";
              if (draggedId !== node.id) {
                setDragOver(true);
              }
            }}
            onDragLeave={(e) => {
              e.stopPropagation();
              setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
              if (draggedId !== node.id) {
                onDrop(node.id);
              }
            }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all group select-none min-w-0",
              isSelected
                ? "bg-primary/10 ring-1 ring-primary/30 text-foreground"
                : "hover:bg-muted/60",
              dragOver &&
                draggedId &&
                draggedId !== node.id &&
                "ring-2 ring-primary bg-primary/10 shadow-md",
            )}
            style={{ paddingLeft: `${depth * 20 + 12}px` }}
            onClick={() => onSelect(node)}
            onDoubleClick={() => onDoubleClick?.(node)}
          >
            {/* Expand/collapse */}
            <button
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground transition-colors",
                !hasChildren && "invisible",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(node.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            {/* Type badge */}
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] px-1.5 py-0 shrink-0 font-medium",
                cfg.color,
                cfg.bg,
              )}
            >
              {cfg.label}
            </Badge>

            {/* Governance board indicator */}
            {boardMap?.[node.id] && (
              <div
                className="flex items-center gap-1 shrink-0"
                title={
                  boardMap[node.id].isInherited
                    ? "Gouvernance heritee"
                    : "Gouvernance propre"
                }
              >
                <Shield
                  className={cn(
                    "h-3 w-3",
                    boardMap[node.id].isInherited
                      ? "text-muted-foreground/50"
                      : "text-blue-500",
                  )}
                />
                {boardMap[node.id].decisionMakerName && (
                  <span className="text-[10px] bg-muted rounded-full w-5 h-5 flex items-center justify-center font-medium text-muted-foreground">
                    {boardMap[node.id]
                      .decisionMakerName!.slice(0, 2)
                      .toUpperCase()}
                  </span>
                )}
              </div>
            )}

            {/* Name */}
            <span className="text-sm font-medium flex-1 truncate">
              {node.name}
            </span>

            {/* Code — subtle, narrow, clipped to avoid overflow */}
            {node.code && (
              <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[80px] hidden xl:inline shrink-0">
                {node.code}
              </span>
            )}

            {/* Children count */}
            {hasChildren && (
              <span className="text-xs text-muted-foreground shrink-0">
                {node.children.length}
              </span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onContextAction("add-child", node)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un enfant
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onContextAction("edit", node)}>
            <Edit className="h-4 w-4 mr-2" />
            Modifier
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onContextAction("move", node)}>
            <Move className="h-4 w-4 mr-2" />
            Deplacer
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onContextAction("delete", node)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {showChildren && visibleChildren.length > 0 && (
        <div
          className="border-l border-border/50 ml-[calc(var(--depth)*20px+20px)]"
          style={{ "--depth": depth } as React.CSSProperties}
          onDragOver={(e) => {
            e.preventDefault();
          }}
        >
          {visibleChildren.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onContextAction={onContextAction}
              searchQuery={searchQuery}
              draggedId={draggedId}
              onDragStart={onDragStart}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              onDoubleClick={onDoubleClick}
              boardMap={boardMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const TreeNodeItem = React.memo(
  TreeNodeItemInner,
  (prev, next) =>
    prev.node.id === next.node.id &&
    prev.node.name === next.node.name &&
    prev.node.node_type === next.node.node_type &&
    prev.node.code === next.node.code &&
    prev.node.children === next.node.children &&
    prev.selectedId === next.selectedId &&
    prev.depth === next.depth &&
    prev.expanded === next.expanded &&
    prev.searchQuery === next.searchQuery &&
    prev.draggedId === next.draggedId &&
    prev.boardMap === next.boardMap &&
    // onDrop closes over `nodes` / `currentTree`; skipping it causes stale
    // drop handlers when siblings are added between renders.
    prev.onDrop === next.onDrop &&
    prev.onDragStart === next.onDragStart &&
    prev.onDragEnd === next.onDragEnd &&
    prev.onContextAction === next.onContextAction &&
    prev.onDoubleClick === next.onDoubleClick,
);
