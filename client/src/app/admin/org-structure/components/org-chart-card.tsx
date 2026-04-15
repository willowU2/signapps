"use client";

import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Badge } from "@/components/ui/badge";
import { Shield, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNodeTypeConfig } from "./tab-config";
import type { BoardInfo } from "./tree-node-item";
import type { OrgNode } from "@/types/org";

// =============================================================================
// Types
// =============================================================================

interface OrgNodeData extends Record<string, unknown> {
  orgNode: OrgNode;
  selectedId: string | null;
  onSelect: (node: OrgNode) => void;
  boardInfo?: BoardInfo;
  cfg: ReturnType<typeof getNodeTypeConfig>;
}

// =============================================================================
// Layout algorithm — top-down tree
// =============================================================================

const NODE_WIDTH = 200;
const NODE_HEIGHT = 76;
const GAP_X = 32;
const GAP_Y = 64;

function computeSubtreeWidth(
  id: string,
  childrenMap: Map<string, string[]>,
): number {
  const children = childrenMap.get(id) ?? [];
  if (children.length === 0) return NODE_WIDTH;
  const childrenWidth = children.reduce(
    (sum, cid) => sum + computeSubtreeWidth(cid, childrenMap),
    0,
  );
  const totalGaps = (children.length - 1) * GAP_X;
  return Math.max(NODE_WIDTH, childrenWidth + totalGaps);
}

function assignPositions(
  id: string,
  centerX: number,
  level: number,
  childrenMap: Map<string, string[]>,
  result: Map<string, { x: number; y: number }>,
): void {
  const y = level * (NODE_HEIGHT + GAP_Y);
  result.set(id, { x: centerX - NODE_WIDTH / 2, y });

  const children = childrenMap.get(id) ?? [];
  if (children.length === 0) return;

  // Compute widths for all children to distribute them
  const childWidths = children.map((cid) =>
    computeSubtreeWidth(cid, childrenMap),
  );
  const totalWidth =
    childWidths.reduce((a, b) => a + b, 0) + (children.length - 1) * GAP_X;

  let curX = centerX - totalWidth / 2;
  for (let i = 0; i < children.length; i++) {
    const childCenter = curX + childWidths[i] / 2;
    assignPositions(children[i], childCenter, level + 1, childrenMap, result);
    curX += childWidths[i] + GAP_X;
  }
}

function layoutTree(nodes: OrgNode[]): Map<string, { x: number; y: number }> {
  const childrenMap = new Map<string, string[]>();
  const roots: string[] = [];

  for (const n of nodes) {
    if (!childrenMap.has(n.id)) childrenMap.set(n.id, []);
    if (n.parent_id && nodes.some((x) => x.id === n.parent_id)) {
      const siblings = childrenMap.get(n.parent_id) ?? [];
      siblings.push(n.id);
      childrenMap.set(n.parent_id, siblings);
    } else {
      roots.push(n.id);
    }
  }

  // Sort children by sort_order
  const sortOrderMap = new Map(nodes.map((n) => [n.id, n.sort_order]));
  for (const [, children] of childrenMap) {
    children.sort(
      (a, b) => (sortOrderMap.get(a) ?? 0) - (sortOrderMap.get(b) ?? 0),
    );
  }

  const result = new Map<string, { x: number; y: number }>();

  if (roots.length === 0) return result;

  if (roots.length === 1) {
    const rootWidth = computeSubtreeWidth(roots[0], childrenMap);
    assignPositions(roots[0], rootWidth / 2, 0, childrenMap, result);
  } else {
    // Multiple roots — lay them side by side
    const rootWidths = roots.map((r) => computeSubtreeWidth(r, childrenMap));
    const totalWidth =
      rootWidths.reduce((a, b) => a + b, 0) + (roots.length - 1) * GAP_X * 2;
    let curX = 0;
    for (let i = 0; i < roots.length; i++) {
      const center = curX + rootWidths[i] / 2;
      assignPositions(roots[i], center, 0, childrenMap, result);
      curX += rootWidths[i] + GAP_X * 2;
    }
    // Centre the whole thing
    const offset = -totalWidth / 2;
    for (const [id, pos] of result) {
      result.set(id, { x: pos.x + offset, y: pos.y });
    }
  }

  return result;
}

// =============================================================================
// Custom node component
// =============================================================================

function OrgNodeCard({ data }: { data: OrgNodeData }) {
  const { orgNode, selectedId, onSelect, boardInfo, cfg } = data;
  if (!orgNode?.node_type) return null;
  const isSelected = selectedId === orgNode.id;

  return (
    <div
      onClick={() => onSelect(orgNode)}
      className={cn(
        "relative px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all",
        "min-w-[180px] max-w-[200px] text-center bg-card shadow-sm",
        cfg.border,
        isSelected && "ring-2 ring-primary shadow-lg",
      )}
      style={{ width: NODE_WIDTH }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-border !border-0 !w-2 !h-2"
      />

      {/* Badge row */}
      <div className="flex items-center justify-center gap-1 mb-1">
        <Badge
          variant="secondary"
          className={cn(
            "text-[9px] px-1.5 py-0 font-medium",
            cfg.color,
            cfg.bg,
          )}
        >
          {cfg.label}
        </Badge>
        {boardInfo && (
          <div
            className="flex items-center gap-0.5"
            title={
              boardInfo.isInherited
                ? "Gouvernance heritee"
                : "Gouvernance propre"
            }
          >
            <Shield
              className={cn(
                "h-3 w-3",
                boardInfo.isInherited
                  ? "text-muted-foreground/50"
                  : "text-blue-500",
              )}
            />
            {boardInfo.decisionMakerName && (
              <span className="text-[10px] bg-muted rounded-full w-5 h-5 flex items-center justify-center font-medium text-muted-foreground">
                {boardInfo.decisionMakerName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Name */}
      <div className="text-sm font-semibold truncate text-foreground">
        {orgNode.name}
      </div>

      {/* Code */}
      {orgNode.code && (
        <div className="text-xs text-muted-foreground font-mono">
          {orgNode.code}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-border !border-0 !w-2 !h-2"
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  orgNode: OrgNodeCard as NodeTypes[string],
};

// =============================================================================
// FitView button (uses ReactFlow context — must be inside ReactFlowProvider)
// =============================================================================

function FitViewButton() {
  const { fitView } = useReactFlow();
  return (
    <button
      onClick={() => fitView({ padding: 0.15, duration: 400 })}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-card border border-border shadow-sm hover:bg-muted transition-colors text-foreground"
    >
      <Maximize2 className="h-3.5 w-3.5" />
      Tout afficher
    </button>
  );
}

// =============================================================================
// Inner flow component (needs ReactFlowProvider as parent)
// =============================================================================

interface OrgChartFlowProps {
  nodes: OrgNode[];
  selectedId: string | null;
  onSelect: (node: OrgNode) => void;
  boardMap?: Record<string, BoardInfo>;
}

function OrgChartFlow({
  nodes: orgNodes,
  selectedId,
  onSelect,
  boardMap,
}: OrgChartFlowProps) {
  const positions = useMemo(() => layoutTree(orgNodes), [orgNodes]);

  const initialNodes = useMemo<Node<OrgNodeData>[]>(() => {
    return orgNodes
      .filter((n) => n?.node_type)
      .map((orgNode) => {
        const pos = positions.get(orgNode.id) ?? { x: 0, y: 0 };
        const cfg = getNodeTypeConfig(orgNode.node_type);
        return {
          id: orgNode.id,
          type: "orgNode",
          position: pos,
          data: {
            orgNode,
            selectedId,
            onSelect,
            boardInfo: boardMap?.[orgNode.id],
            cfg,
          },
          draggable: false,
        };
      });
  }, [orgNodes, positions, selectedId, onSelect, boardMap]);

  const initialEdges = useMemo<Edge[]>(() => {
    return orgNodes
      .filter((n) => n.parent_id && orgNodes.some((p) => p.id === n.parent_id))
      .map((n) => ({
        id: `e-${n.parent_id}-${n.id}`,
        source: n.parent_id!,
        target: n.id,
        style: { stroke: "var(--border)", strokeWidth: 1.5 },
        type: "smoothstep",
      }));
  }, [orgNodes]);

  const [rfNodes, , onNodesChange] = useNodesState(initialNodes);
  const [rfEdges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync node + edge data changes (selection, boardMap, topology) without
  // full remount. useNodesState/useEdgesState only consume the initial
  // argument once — subsequent changes to the memoised inputs are ignored
  // unless we explicitly push them into the React Flow internal state.
  const { setNodes } = useReactFlow();

  useEffect(() => {
    setNodes(
      orgNodes
        .filter((n) => n?.node_type)
        .map((orgNode) => {
          const pos = positions.get(orgNode.id) ?? { x: 0, y: 0 };
          const cfg = getNodeTypeConfig(orgNode.node_type);
          return {
            id: orgNode.id,
            type: "orgNode",
            position: pos,
            data: {
              orgNode,
              selectedId,
              onSelect,
              boardInfo: boardMap?.[orgNode.id],
              cfg,
            },
            draggable: false,
          };
        }),
    );
  }, [orgNodes, positions, selectedId, onSelect, boardMap, setNodes]);

  // Same sync problem for edges: when orgNodes changes (initial fetch, new
  // parent relationships), the `initialEdges` captured by useEdgesState is
  // stale. Push the recomputed edges explicitly.
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      attributionPosition="bottom-right"
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={true}
      className="[&_.react-flow__node]:!bg-transparent"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="var(--border)"
      />
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor={(n) => {
          const data = n.data as OrgNodeData;
          if (!data?.cfg) return "#e5e7eb";
          // Extract a representative color from Tailwind border class
          const border = data.cfg.border ?? "";
          if (border.includes("red")) return "#fca5a5";
          if (border.includes("orange")) return "#fdba74";
          if (border.includes("yellow")) return "#fde047";
          if (border.includes("blue")) return "#93c5fd";
          if (border.includes("green")) return "#86efac";
          if (border.includes("purple")) return "#c4b5fd";
          if (border.includes("pink")) return "#f9a8d4";
          if (border.includes("cyan")) return "#67e8f9";
          if (border.includes("sky")) return "#7dd3fc";
          if (border.includes("rose")) return "#fda4af";
          if (border.includes("fuchsia")) return "#e879f9";
          return "#e5e7eb";
        }}
        maskColor="rgba(0, 0, 0, 0.2)"
        pannable={false}
        zoomable={false}
      />
      <Panel position="top-right">
        <FitViewButton />
      </Panel>
    </ReactFlow>
  );
}

// =============================================================================
// Public component — OrgChartCard (kept same export name for page.tsx compat)
// =============================================================================

export interface OrgChartCardProps {
  /** Flat array of all OrgNodes (page passes `nodes` directly) */
  nodes: OrgNode[];
  selectedId: string | null;
  onSelect: (node: OrgNode) => void;
  boardMap?: Record<string, BoardInfo>;
}

export function OrgChartCard({
  nodes,
  selectedId,
  onSelect,
  boardMap,
}: OrgChartCardProps) {
  // Filter out any invalid nodes (missing id or node_type)
  const validNodes = useMemo(
    () => nodes?.filter((n) => n && n.id && n.node_type) ?? [],
    [nodes],
  );

  if (!validNodes.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Aucun noeud a afficher
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <OrgChartFlow
          nodes={validNodes}
          selectedId={selectedId}
          onSelect={onSelect}
          boardMap={boardMap}
        />
      </ReactFlowProvider>
    </div>
  );
}
