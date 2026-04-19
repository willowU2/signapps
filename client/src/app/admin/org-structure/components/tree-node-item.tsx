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
import type { OrgNode, Person } from "@/types/org";

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

export interface NodeAssignment {
  personId: string;
  role?: string;
  isPrimary: boolean;
}

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
  assignmentsByNode?: Record<string, NodeAssignment[]>;
  personsById?: Record<string, Person>;
}

/**
 * Deterministic color per person, using hash on the id — stable across
 * renders so the same person always gets the same avatar tint.
 */
function avatarTint(personId: string): string {
  const palette = [
    "bg-blue-500/20 text-blue-700 dark:text-blue-300",
    "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    "bg-purple-500/20 text-purple-700 dark:text-purple-300",
    "bg-orange-500/20 text-orange-700 dark:text-orange-300",
    "bg-pink-500/20 text-pink-700 dark:text-pink-300",
    "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300",
    "bg-rose-500/20 text-rose-700 dark:text-rose-300",
  ];
  let h = 0;
  for (let i = 0; i < personId.length; i++)
    h = (h * 31 + personId.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

function personInitials(p: Person | undefined): string {
  if (!p) return "?";
  const a = p.first_name?.[0] ?? "";
  const b = p.last_name?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

/**
 * Read the title from either `attributes.title` (signapps-org raw
 * response) or `metadata.title` (legacy workforce shape). Types don't
 * match exactly so we index defensively.
 */
function personTitle(p: Person | undefined): string | undefined {
  if (!p) return undefined;
  const raw = p as unknown as {
    attributes?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
  const src = raw.attributes ?? raw.metadata ?? {};
  const t = src.title;
  return typeof t === "string" && t.length > 0 ? t : undefined;
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
  assignmentsByNode,
  personsById,
}: TreeNodeItemProps) {
  const [dragOver, setDragOver] = useState(false);
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const cfg = getNodeTypeConfig(node.node_type);
  const hasChildren = node.children.length > 0;
  const isDragged = draggedId === node.id;

  const nodeAssignments = assignmentsByNode?.[node.id] ?? [];
  const manager = nodeAssignments.find((a) => a.isPrimary);
  const managerPerson = manager ? personsById?.[manager.personId] : undefined;
  const otherAssignments = manager
    ? nodeAssignments.filter((a) => a.personId !== manager.personId)
    : nodeAssignments;
  const shown = otherAssignments.slice(0, 3);
  const overflow = otherAssignments.length - shown.length;

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

            {/* Manager (primary assignment) */}
            {managerPerson && (
              <div
                className="flex items-center gap-1.5 shrink-0"
                title={`Responsable : ${managerPerson.first_name} ${managerPerson.last_name}${personTitle(managerPerson) ? " — " + personTitle(managerPerson) : ""}`}
              >
                <span
                  className={cn(
                    "text-[10px] rounded-full w-6 h-6 flex items-center justify-center font-semibold ring-2 ring-primary/60",
                    avatarTint(managerPerson.id),
                  )}
                >
                  {personInitials(managerPerson)}
                </span>
              </div>
            )}

            {/* Other assignees (up to 3 avatars + overflow badge) */}
            {shown.length > 0 && (
              <div className="flex items-center -space-x-1.5 shrink-0">
                {shown.map((a) => {
                  const p = personsById?.[a.personId];
                  return (
                    <span
                      key={a.personId}
                      className={cn(
                        "text-[9px] rounded-full w-5 h-5 flex items-center justify-center font-medium ring-1 ring-background",
                        avatarTint(a.personId),
                      )}
                      title={
                        p
                          ? `${p.first_name} ${p.last_name}${personTitle(p) ? " — " + personTitle(p) : ""}`
                          : a.personId
                      }
                    >
                      {personInitials(p)}
                    </span>
                  );
                })}
                {overflow > 0 && (
                  <span
                    className="text-[9px] rounded-full w-5 h-5 flex items-center justify-center font-medium bg-muted text-muted-foreground ring-1 ring-background"
                    title={`${overflow} autre${overflow > 1 ? "s" : ""}`}
                  >
                    +{overflow}
                  </span>
                )}
              </div>
            )}

            {/* Total people count on this node */}
            {nodeAssignments.length > 0 && (
              <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                {nodeAssignments.length}p
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
              assignmentsByNode={assignmentsByNode}
              personsById={personsById}
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
    prev.assignmentsByNode === next.assignmentsByNode &&
    prev.personsById === next.personsById &&
    // onDrop closes over `nodes` / `currentTree`; skipping it causes stale
    // drop handlers when siblings are added between renders.
    prev.onDrop === next.onDrop &&
    prev.onDragStart === next.onDragStart &&
    prev.onDragEnd === next.onDragEnd &&
    prev.onContextAction === next.onContextAction &&
    prev.onDoubleClick === next.onDoubleClick,
);
