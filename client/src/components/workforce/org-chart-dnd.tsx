"use client";

/**
 * HR3 — Interactive Org Chart with Drag & Drop
 *
 * Renders the workforce org tree as a visual tree where nodes can be
 * dragged to reorganise the hierarchy. Clicking a node opens an employee
 * details panel via the onSelectNode callback.
 *
 * Dependencies: @dnd-kit/core, @dnd-kit/sortable (already used in forms editor)
 */

import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  Building2,
  Users,
  MapPin,
  Briefcase,
  UserCircle,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { orgNodesApi } from "@/lib/api/workforce";
import type { OrgNodeWithStats } from "@/types/workforce";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TreeNode {
  node: OrgNodeWithStats;
  expanded: boolean;
  children: TreeNode[];
}

interface OrgChartDndProps {
  onSelectNode?: (node: OrgNodeWithStats) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const NODE_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  company: Building2,
  region: MapPin,
  department: Briefcase,
  team: Users,
  position: UserCircle,
};

function NodeIcon({ type, className }: { type?: string; className?: string }) {
  const Icon = NODE_ICONS[type ?? ""] ?? Building2;
  return <Icon className={className} />;
}

// ---------------------------------------------------------------------------
// Draggable + Droppable node row
// ---------------------------------------------------------------------------

interface NodeRowProps {
  item: TreeNode;
  depth: number;
  isDragTarget: boolean;
  onToggle: (id: string) => void;
  onSelect: (node: OrgNodeWithStats) => void;
}

function NodeRow({
  item,
  depth,
  isDragTarget,
  onToggle,
  onSelect,
}: NodeRowProps) {
  const { node, expanded, children } = item;

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: node.id, data: { node } });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop:${node.id}`,
    data: { nodeId: node.id },
  });

  const hasChildren = children.length > 0 || (node.employee_count ?? 0) > 0;

  return (
    <div ref={setDropRef}>
      {/* Drop target indicator */}
      {(isOver || isDragTarget) && (
        <div className="h-1 rounded-full bg-primary/40 mx-2 mb-1" />
      )}

      <div
        ref={setDragRef}
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer select-none transition-colors",
          "hover:bg-accent/60",
          isDragging && "opacity-40",
          isOver && "bg-primary/10 ring-1 ring-primary/30",
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onSelect(node)}
      >
        {/* Drag handle */}
        <span
          {...attributes}
          {...listeners}
          className="touch-none cursor-grab text-muted-foreground/40 hover:text-muted-foreground shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>

        {/* Expand/collapse toggle */}
        <button
          className="h-5 w-5 shrink-0 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.id);
          }}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )
          ) : (
            <span className="h-3 w-3" />
          )}
        </button>

        {/* Icon */}
        <NodeIcon
          type={node.node_type}
          className="h-4 w-4 text-primary/70 shrink-0"
        />

        {/* Name */}
        <span className="text-sm font-medium flex-1 truncate">{node.name}</span>

        {/* Employee count badge */}
        {(node.employee_count ?? 0) > 0 && (
          <Badge variant="secondary" className="text-xs px-1.5 h-5">
            {node.employee_count}
          </Badge>
        )}
      </div>

      {/* Children */}
      {expanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <NodeRow
              key={child.node.id}
              item={child}
              depth={depth + 1}
              isDragTarget={false}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------

function buildTreeState(nodes: OrgNodeWithStats[]): TreeNode[] {
  return nodes.map((node) => ({
    node,
    expanded: true,
    children: [],
  }));
}

function toggleNode(items: TreeNode[], id: string): TreeNode[] {
  return items.map((item) => {
    if (item.node.id === id) {
      return { ...item, expanded: !item.expanded };
    }
    if (item.children.length > 0) {
      return { ...item, children: toggleNode(item.children, id) };
    }
    return item;
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OrgChartDnd({ onSelectNode, className }: OrgChartDndProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await orgNodesApi.getTree({ max_depth: 10 });
      setTree(buildTreeState(resp.data));
    } catch {
      toast.error("Impossible de charger l'organigramme");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const handleToggle = useCallback((id: string) => {
    setTree((prev) => toggleNode(prev, id));
  }, []);

  const handleSelect = useCallback(
    (node: OrgNodeWithStats) => {
      onSelectNode?.(node);
    },
    [onSelectNode],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragNodeId(String(event.active.id));
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = String(event.over?.id ?? "");
    setDropTargetId(overId.startsWith("drop:") ? overId.slice(5) : null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setDragNodeId(null);
      setDropTargetId(null);

      const nodeId = String(event.active.id);
      const overId = String(event.over?.id ?? "");

      if (!overId.startsWith("drop:")) return;
      const newParentId = overId.slice(5);

      if (nodeId === newParentId) return;

      try {
        await orgNodesApi.move(nodeId, { new_parent_id: newParentId });
        toast.success("Nœud déplacé avec succès");
        await loadTree();
      } catch {
        toast.error("Impossible de déplacer ce nœud");
      }
    },
    [loadTree],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Chargement de l'organigramme…</span>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Aucun nœud dans l'organigramme.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={cn("rounded-lg border bg-card p-2", className)}>
        <p className="text-xs text-muted-foreground px-2 pb-2 border-b mb-2">
          Glissez les nœuds pour réorganiser la hiérarchie. Cliquez pour voir
          les détails.
        </p>
        {tree.map((item) => (
          <NodeRow
            key={item.node.id}
            item={item}
            depth={0}
            isDragTarget={dropTargetId === item.node.id}
            onToggle={handleToggle}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {dragNodeId && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border shadow-lg text-sm font-medium opacity-90">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            Déplacement…
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
