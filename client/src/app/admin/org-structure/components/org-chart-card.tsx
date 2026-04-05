"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNodeTypeConfig } from "./tab-config";
import type { TreeNode, BoardInfo } from "./tree-node-item";

// =============================================================================
// OrgChartCard
// =============================================================================

export interface OrgChartCardProps {
  node: TreeNode;
  selectedId: string | null;
  onSelect: (node: TreeNode) => void;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  boardMap?: Record<string, BoardInfo>;
}

export function OrgChartCard({
  node,
  selectedId,
  onSelect,
  collapsed,
  onToggleCollapse,
  boardMap,
}: OrgChartCardProps) {
  const cfg = getNodeTypeConfig(node.node_type);
  const isSelected = selectedId === node.id;
  const isCollapsed = collapsed.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div
        onClick={() => onSelect(node)}
        className={cn(
          "relative px-4 py-3 rounded-xl border-2 cursor-pointer transition-all min-w-[160px] max-w-[220px] text-center",
          cfg.bg,
          cfg.border,
          isSelected && "ring-2 ring-primary shadow-lg",
        )}
      >
        <div className="flex items-center justify-center gap-1 mb-1">
          <Badge
            variant="secondary"
            className={cn(
              "text-[9px] px-1 py-0 font-medium",
              cfg.color,
              cfg.bg,
            )}
          >
            {cfg.label}
          </Badge>
          {boardMap?.[node.id] && (
            <div
              className="flex items-center gap-0.5"
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
        </div>
        <div className="text-sm font-semibold truncate">{node.name}</div>
        {node.code && (
          <div className="text-xs text-muted-foreground font-mono">
            {node.code}
          </div>
        )}

        {/* Toggle children */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(node.id);
            }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors shadow-sm"
          >
            {isCollapsed ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronUp className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      {/* Children */}
      {hasChildren && !isCollapsed && (
        <>
          {/* Vertical connector */}
          <div className="w-px h-6 bg-border" />

          {/* Horizontal connector + children row */}
          <div className="relative flex">
            {/* Horizontal line across all children */}
            {node.children.length > 1 && (
              <div
                className="absolute top-0 h-px bg-border"
                style={{
                  left: `calc(100% / ${node.children.length * 2})`,
                  right: `calc(100% / ${node.children.length * 2})`,
                }}
              />
            )}

            <div className="flex gap-6 items-start">
              {node.children.map((child) => (
                <div key={child.id} className="flex flex-col items-center">
                  {/* Vertical line from horizontal connector to child card */}
                  <div className="w-px h-6 bg-border" />
                  <OrgChartCard
                    node={child}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    collapsed={collapsed}
                    onToggleCollapse={onToggleCollapse}
                    boardMap={boardMap}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
