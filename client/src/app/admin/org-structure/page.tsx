"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrgStore } from "@/stores/org-store";
import { orgApi } from "@/lib/api/org";
import type {
  OrgTree,
  OrgNode,
  Assignment,
  Person,
  TreeType,
} from "@/types/org";
import {
  Building2,
  Plus,
  Users,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Trash2,
  Search,
  Printer,
  Download,
  Save,
  UserPlus,
  X,
  Edit,
  Move,
  FolderTree,
  LayoutGrid,
  List,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════════
// Node type configuration
// ═══════════════════════════════════════════════════════════════════════════════

interface NodeTypeConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
}

const INTERNAL_NODE_TYPES: Record<string, NodeTypeConfig> = {
  group: {
    label: "Groupe",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/30",
    border: "border-red-300 dark:border-red-700",
  },
  subsidiary: {
    label: "Filiale",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-900/30",
    border: "border-orange-300 dark:border-orange-700",
  },
  bu: {
    label: "BU",
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    border: "border-yellow-300 dark:border-yellow-700",
  },
  department: {
    label: "Departement",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    border: "border-blue-300 dark:border-blue-700",
  },
  service: {
    label: "Service",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-900/30",
    border: "border-green-300 dark:border-green-700",
  },
  team: {
    label: "Equipe",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    border: "border-purple-300 dark:border-purple-700",
  },
  position: {
    label: "Poste",
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-100 dark:bg-pink-900/30",
    border: "border-pink-300 dark:border-pink-700",
  },
};

const CLIENT_NODE_TYPES: Record<string, NodeTypeConfig> = {
  client_group: {
    label: "Groupe client",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-900/30",
    border: "border-slate-300 dark:border-slate-700",
  },
  client_company: {
    label: "Societe",
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-100 dark:bg-cyan-900/30",
    border: "border-cyan-300 dark:border-cyan-700",
  },
  client_department: {
    label: "Departement",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-100 dark:bg-sky-900/30",
    border: "border-sky-300 dark:border-sky-700",
  },
};

const SUPPLIER_NODE_TYPES: Record<string, NodeTypeConfig> = {
  supplier_group: {
    label: "Groupe fournisseur",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-100 dark:bg-rose-900/30",
    border: "border-rose-300 dark:border-rose-700",
  },
  supplier_company: {
    label: "Societe",
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-100 dark:bg-pink-900/30",
    border: "border-pink-300 dark:border-pink-700",
  },
  supplier_department: {
    label: "Departement",
    color: "text-fuchsia-600 dark:text-fuchsia-400",
    bg: "bg-fuchsia-100 dark:bg-fuchsia-900/30",
    border: "border-fuchsia-300 dark:border-fuchsia-700",
  },
};

function getNodeTypeConfig(type: string): NodeTypeConfig {
  return (
    INTERNAL_NODE_TYPES[type] ??
    CLIENT_NODE_TYPES[type] ??
    SUPPLIER_NODE_TYPES[type] ?? {
      label: type,
      color: "text-muted-foreground",
      bg: "bg-muted",
      border: "border-border",
    }
  );
}

function getNodeTypesByTreeType(
  treeType: string,
): Record<string, NodeTypeConfig> {
  if (treeType === "clients") return CLIENT_NODE_TYPES;
  if (treeType === "suppliers") return SUPPLIER_NODE_TYPES;
  return INTERNAL_NODE_TYPES;
}

const TREE_TYPE_CONFIG: Record<
  TreeType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  internal: {
    label: "Interne",
    icon: <Building2 className="h-4 w-4" />,
    color: "text-purple-600",
  },
  clients: {
    label: "Clients",
    icon: <Users className="h-4 w-4" />,
    color: "text-cyan-600",
  },
  suppliers: {
    label: "Fournisseurs",
    icon: <Briefcase className="h-4 w-4" />,
    color: "text-rose-600",
  },
};

const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  holder: "Titulaire",
  interim: "Interimaire",
  deputy: "Adjoint",
  intern: "Stagiaire",
  contractor: "Prestataire",
};

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: build tree hierarchy from flat nodes
// ═══════════════════════════════════════════════════════════════════════════════

interface TreeNode extends OrgNode {
  children: TreeNode[];
  _personCount?: number;
}

function buildTree(nodes: OrgNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const n of nodes) {
    map.set(n.id, { ...n, children: [] });
  }

  for (const n of nodes) {
    const treeNode = map.get(n.id)!;
    if (n.parent_id && map.has(n.parent_id)) {
      map.get(n.parent_id)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }

  // Sort children by sort_order
  const sortChildren = (list: TreeNode[]) => {
    list.sort((a, b) => a.sort_order - b.sort_order);
    list.forEach((n) => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

function flattenTree(roots: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      result.push(n);
      walk(n.children);
    }
  };
  walk(roots);
  return result;
}

function getAncestorNames(nodeId: string, nodes: OrgNode[]): string[] {
  const map = new Map(nodes.map((n) => [n.id, n]));
  const names: string[] = [];
  let current = map.get(nodeId);
  while (current?.parent_id) {
    const parent = map.get(current.parent_id);
    if (parent) {
      names.unshift(parent.name);
      current = parent;
    } else {
      break;
    }
  }
  return names;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tree View — Left-panel tree node (recursive)
// ═══════════════════════════════════════════════════════════════════════════════

interface TreeNodeItemProps {
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
}

function matchesSearch(node: TreeNode, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (node.name.toLowerCase().includes(q)) return true;
  if (node.code?.toLowerCase().includes(q)) return true;
  return node.children.some((c) => matchesSearch(c, q));
}

function TreeNodeItem({
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
    <div className={cn(isDragged && "opacity-40")}>
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
              e.dataTransfer.dropEffect = "move";
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              onDrop(node.id);
            }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all group select-none",
              isSelected
                ? "bg-primary/10 ring-1 ring-primary/30 text-foreground"
                : "hover:bg-muted/60",
              dragOver &&
                draggedId &&
                draggedId !== node.id &&
                "ring-2 ring-primary bg-primary/5",
            )}
            style={{ paddingLeft: `${depth * 20 + 12}px` }}
            onClick={() => onSelect(node)}
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

            {/* Name */}
            <span className="text-sm font-medium flex-1 truncate">
              {node.name}
            </span>

            {/* Code */}
            {node.code && (
              <span className="text-xs text-muted-foreground font-mono shrink-0">
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Orgchart View — horizontal card-based org chart
// ═══════════════════════════════════════════════════════════════════════════════

interface OrgChartCardProps {
  node: TreeNode;
  selectedId: string | null;
  onSelect: (node: TreeNode) => void;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
}

function OrgChartCard({
  node,
  selectedId,
  onSelect,
  collapsed,
  onToggleCollapse,
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
          isSelected && "ring-2 ring-primary shadow-lg scale-105",
        )}
      >
        <Badge
          variant="secondary"
          className={cn(
            "text-[9px] px-1 py-0 font-medium mb-1",
            cfg.color,
            cfg.bg,
          )}
        >
          {cfg.label}
        </Badge>
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
                className="absolute top-0 left-[calc(50%/(var(--count))+50%/(var(--count)))] right-[calc(50%/(var(--count))+50%/(var(--count)))] h-px bg-border"
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

// ═══════════════════════════════════════════════════════════════════════════════
// Detail panel (right)
// ═══════════════════════════════════════════════════════════════════════════════

type AssignmentWithPerson = Assignment & { person?: Person };

interface DetailPanelProps {
  node: OrgNode | null;
  allNodes: OrgNode[];
  tree: OrgTree;
  onClose: () => void;
  onNodeUpdated: () => void;
  onAddChild: (parentNode: OrgNode) => void;
  onDeleteNode: (node: OrgNode) => void;
  onMoveNode: (node: OrgNode) => void;
}

function DetailPanel({
  node,
  allNodes,
  tree,
  onClose,
  onNodeUpdated,
  onAddChild,
  onDeleteNode,
  onMoveNode,
}: DetailPanelProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailTab, setDetailTab] = useState("details");
  const [assignments, setAssignments] = useState<AssignmentWithPerson[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  useEffect(() => {
    if (node) {
      setName(node.name);
      setCode(node.code ?? "");
      setDescription(node.description ?? "");
      setDetailTab("details");
    }
  }, [node]);

  const loadAssignments = useCallback(async () => {
    if (!node) return;
    setAssignmentsLoading(true);
    try {
      const res = await orgApi.nodes.assignments(node.id);
      setAssignments((res.data ?? []) as AssignmentWithPerson[]);
    } catch {
      setAssignments([]);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [node]);

  useEffect(() => {
    if (node && detailTab === "people") {
      loadAssignments();
    }
  }, [node, detailTab, loadAssignments]);

  const handleSave = async () => {
    if (!node) return;
    setSaving(true);
    try {
      await orgApi.nodes.update(node.id, {
        name,
        code: code || undefined,
        description: description || undefined,
      });
      toast.success("Noeud mis a jour");
      onNodeUpdated();
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 p-8">
        <Building2 className="h-12 w-12 opacity-20" />
        <p className="text-sm font-medium">Selectionnez un noeud</p>
        <p className="text-xs">pour voir et modifier ses details</p>
      </div>
    );
  }

  const cfg = getNodeTypeConfig(node.node_type);
  const breadcrumb = getAncestorNames(node.id, allNodes);
  const childNodes = allNodes
    .filter((n) => n.parent_id === node.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Badge
              variant="secondary"
              className={cn("text-xs px-2 py-0.5 shrink-0", cfg.color, cfg.bg)}
            >
              {cfg.label}
            </Badge>
            <h3 className="font-semibold text-base truncate">{node.name}</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 h-7 w-7 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {breadcrumb.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {breadcrumb.join(" > ")} &gt; {node.name}
          </p>
        )}
        {node.code && (
          <span className="text-xs font-mono text-muted-foreground">
            Code: {node.code}
          </span>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        value={detailTab}
        onValueChange={setDetailTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="mx-4 mt-3 shrink-0">
          <TabsTrigger value="details" className="flex-1 text-xs">
            Details
          </TabsTrigger>
          <TabsTrigger value="people" className="flex-1 text-xs">
            Personnes
          </TabsTrigger>
          <TabsTrigger value="children" className="flex-1 text-xs">
            Sous-noeuds
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          {/* Details tab */}
          <TabsContent value="details" className="p-4 space-y-4 mt-0">
            <div className="space-y-2">
              <Label htmlFor="detail-name">Nom</Label>
              <Input
                id="detail-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom du noeud"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-code">Code</Label>
              <Input
                id="detail-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: DRH, IT, SALES"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-desc">Description</Label>
              <Textarea
                id="detail-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description optionnelle..."
                rows={3}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} size="sm">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Sauvegarde..." : "Enregistrer"}
              </Button>
            </div>

            {/* Actions */}
            <div className="border-t border-border pt-4 mt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMoveNode(node)}
                >
                  <Move className="h-4 w-4 mr-1" />
                  Deplacer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDeleteNode(node)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Supprimer
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* People tab */}
          <TabsContent value="people" className="p-4 space-y-3 mt-0">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {assignments.length} personne(s) affectee(s)
              </p>
              <Button size="sm" variant="outline">
                <UserPlus className="h-4 w-4 mr-1" />
                Affecter
              </Button>
            </div>
            {assignmentsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Chargement...
              </p>
            ) : assignments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                Aucune affectation pour ce noeud
              </div>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {a.person
                          ? `${a.person.first_name[0]}${a.person.last_name[0]}`
                          : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {a.person
                          ? `${a.person.first_name} ${a.person.last_name}`
                          : a.person_id}
                      </p>
                      {a.person?.email && (
                        <p className="text-xs text-muted-foreground truncate">
                          {a.person.email}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {ASSIGNMENT_TYPE_LABELS[a.assignment_type] ??
                        a.assignment_type}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Children tab */}
          <TabsContent value="children" className="p-4 space-y-3 mt-0">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {childNodes.length} sous-noeud(s)
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAddChild(node)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            </div>
            {childNodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                Aucun sous-noeud
              </div>
            ) : (
              <div className="space-y-1">
                {childNodes.map((child) => {
                  const childCfg = getNodeTypeConfig(child.node_type);
                  return (
                    <div
                      key={child.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/60 cursor-pointer transition-colors"
                    >
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-1.5 py-0 shrink-0",
                          childCfg.color,
                          childCfg.bg,
                        )}
                      >
                        {childCfg.label}
                      </Badge>
                      <span className="text-sm font-medium truncate">
                        {child.name}
                      </span>
                      {child.code && (
                        <span className="text-xs text-muted-foreground font-mono ml-auto shrink-0">
                          {child.code}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// List View — Table view
// ═══════════════════════════════════════════════════════════════════════════════

interface ListViewProps {
  nodes: OrgNode[];
  selectedId: string | null;
  onSelect: (node: OrgNode) => void;
  searchQuery: string;
}

function ListView({ nodes, selectedId, onSelect, searchQuery }: ListViewProps) {
  const [sortField, setSortField] = useState<
    "name" | "node_type" | "sort_order"
  >("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const parentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      map.set(n.id, n.name);
    }
    return map;
  }, [nodes]);

  const filtered = useMemo(() => {
    let list = [...nodes];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.code?.toLowerCase().includes(q) ||
          n.node_type.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [nodes, searchQuery, sortField, sortDir]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 inline ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 inline ml-1" />
    );
  };

  return (
    <div className="overflow-auto h-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => handleSort("name")}
            >
              Nom <SortIcon field="name" />
            </TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => handleSort("node_type")}
            >
              Type <SortIcon field="node_type" />
            </TableHead>
            <TableHead>Parent</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground py-12"
              >
                Aucun noeud
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((node) => {
              const cfg = getNodeTypeConfig(node.node_type);
              return (
                <TableRow
                  key={node.id}
                  className={cn(
                    "cursor-pointer",
                    selectedId === node.id && "bg-primary/5",
                  )}
                  onClick={() => onSelect(node)}
                >
                  <TableCell className="font-medium">{node.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        cfg.color,
                        cfg.bg,
                      )}
                    >
                      {cfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {node.parent_id
                      ? (parentMap.get(node.parent_id) ?? "—")
                      : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {node.code ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={node.is_active ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {node.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════════════════════════════════════════

export default function OrgStructurePage() {
  usePageTitle("Structure organisationnelle — Administration");

  const {
    trees,
    treesLoading,
    currentTree,
    nodes,
    nodesLoading,
    selectedNode,
    fetchTrees,
    setCurrentTree,
    fetchNodes,
    selectNode,
  } = useOrgStore();

  // View mode: tree | orgchart | list
  const [viewMode, setViewMode] = useState<"tree" | "orgchart" | "list">(
    "tree",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [orgchartCollapsed, setOrgchartCollapsed] = useState<Set<string>>(
    new Set(),
  );
  const [detailOpen, setDetailOpen] = useState(false);

  // Drag and drop
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Dialogs
  const [createTreeDialogOpen, setCreateTreeDialogOpen] = useState(false);
  const [newTreeName, setNewTreeName] = useState("");
  const [newTreeType, setNewTreeType] = useState<TreeType>("internal");
  const [creatingTree, setCreatingTree] = useState(false);

  const [addNodeDialogOpen, setAddNodeDialogOpen] = useState(false);
  const [addNodeParent, setAddNodeParent] = useState<OrgNode | null>(null);
  const [newNodeType, setNewNodeType] = useState("");
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeCode, setNewNodeCode] = useState("");
  const [newNodeDescription, setNewNodeDescription] = useState("");
  const [addingNode, setAddingNode] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<OrgNode | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [nodeToMove, setNodeToMove] = useState<OrgNode | null>(null);
  const [moveTargetId, setMoveTargetId] = useState("");
  const [moving, setMoving] = useState(false);

  // Build tree hierarchy
  const treeHierarchy = useMemo(() => buildTree(nodes), [nodes]);

  // Load trees on mount
  useEffect(() => {
    fetchTrees();
  }, [fetchTrees]);

  // Auto-select first tree
  useEffect(() => {
    if (trees.length > 0 && !currentTree) {
      setCurrentTree(trees[0]);
    }
  }, [trees, currentTree, setCurrentTree]);

  // Load nodes when tree changes
  useEffect(() => {
    if (currentTree) {
      fetchNodes(currentTree.id);
    }
  }, [currentTree, fetchNodes]);

  // Auto-expand root nodes
  useEffect(() => {
    if (nodes.length > 0) {
      const roots = nodes.filter((n) => !n.parent_id);
      setExpanded((prev) => {
        const next = new Set(prev);
        roots.forEach((r) => next.add(r.id));
        return next;
      });
    }
  }, [nodes]);

  // Handlers
  const handleToggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleOrgchartCollapse = useCallback((id: string) => {
    setOrgchartCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectNode = useCallback(
    (node: OrgNode) => {
      selectNode(node);
      setDetailOpen(true);
    },
    [selectNode],
  );

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false);
    selectNode(null);
  }, [selectNode]);

  const handleCreateTree = async () => {
    if (!newTreeName.trim()) return;
    setCreatingTree(true);
    try {
      const res = await orgApi.trees.create({
        tree_type: newTreeType,
        name: newTreeName.trim(),
      });
      toast.success("Arbre cree");
      setCreateTreeDialogOpen(false);
      setNewTreeName("");
      await fetchTrees();
      setCurrentTree(res.data!);
    } catch {
      toast.error("Erreur lors de la creation");
    } finally {
      setCreatingTree(false);
    }
  };

  const openAddNodeDialog = useCallback((parentNode: OrgNode | null) => {
    setAddNodeParent(parentNode);
    setNewNodeName("");
    setNewNodeCode("");
    setNewNodeDescription("");
    setNewNodeType("");
    setAddNodeDialogOpen(true);
  }, []);

  const handleAddNode = async () => {
    if (!newNodeName.trim() || !newNodeType || !currentTree) return;
    setAddingNode(true);
    try {
      await orgApi.nodes.create({
        tree_id: currentTree.id,
        parent_id: addNodeParent?.id,
        node_type: newNodeType,
        name: newNodeName.trim(),
        code: newNodeCode.trim() || undefined,
        description: newNodeDescription.trim() || undefined,
        sort_order: 0,
        is_active: true,
        config: {},
      });
      toast.success("Noeud cree");
      setAddNodeDialogOpen(false);
      fetchNodes(currentTree.id);
    } catch {
      toast.error("Erreur lors de la creation");
    } finally {
      setAddingNode(false);
    }
  };

  const openDeleteDialog = useCallback((node: OrgNode) => {
    setNodeToDelete(node);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteNode = async () => {
    if (!nodeToDelete || !currentTree) return;
    setDeleting(true);
    try {
      await orgApi.nodes.delete(nodeToDelete.id);
      toast.success("Noeud supprime");
      setDeleteDialogOpen(false);
      if (selectedNode?.id === nodeToDelete.id) {
        selectNode(null);
        setDetailOpen(false);
      }
      fetchNodes(currentTree.id);
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  const openMoveDialog = useCallback((node: OrgNode) => {
    setNodeToMove(node);
    setMoveTargetId("");
    setMoveDialogOpen(true);
  }, []);

  const handleMoveNode = async () => {
    if (!nodeToMove || !moveTargetId || !currentTree) return;
    setMoving(true);
    try {
      await orgApi.nodes.move(nodeToMove.id, moveTargetId);
      toast.success("Noeud deplace");
      setMoveDialogOpen(false);
      fetchNodes(currentTree.id);
    } catch {
      toast.error("Erreur lors du deplacement");
    } finally {
      setMoving(false);
    }
  };

  // Drag and drop handler
  const handleDrop = useCallback(
    async (targetId: string) => {
      if (!draggedId || draggedId === targetId || !currentTree) return;
      // Prevent dropping on own descendant
      const isDescendant = (parentId: string, checkId: string): boolean => {
        const children = nodes.filter((n) => n.parent_id === parentId);
        return children.some(
          (c) => c.id === checkId || isDescendant(c.id, checkId),
        );
      };
      if (isDescendant(draggedId, targetId)) {
        toast.error(
          "Impossible de deplacer un noeud dans un de ses descendants",
        );
        return;
      }
      try {
        await orgApi.nodes.move(draggedId, targetId);
        toast.success("Noeud deplace");
        fetchNodes(currentTree.id);
      } catch {
        toast.error("Erreur lors du deplacement");
      }
    },
    [draggedId, currentTree, nodes, fetchNodes],
  );

  // Context menu actions
  const handleContextAction = useCallback(
    (action: string, node: TreeNode) => {
      switch (action) {
        case "add-child":
          openAddNodeDialog(node);
          break;
        case "edit":
          selectNode(node);
          setDetailOpen(true);
          break;
        case "move":
          openMoveDialog(node);
          break;
        case "delete":
          openDeleteDialog(node);
          break;
      }
    },
    [openAddNodeDialog, selectNode, openMoveDialog, openDeleteDialog],
  );

  // Export
  const handleExport = useCallback(
    (format: "json" | "csv") => {
      if (format === "json") {
        const data = JSON.stringify(nodes, null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `org-structure-${currentTree?.name ?? "export"}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const header = "Nom,Type,Parent,Code,Description,Actif\n";
        const parentMap = new Map(nodes.map((n) => [n.id, n.name]));
        const rows = nodes.map((n) =>
          [
            `"${n.name}"`,
            n.node_type,
            n.parent_id ? `"${parentMap.get(n.parent_id) ?? ""}"` : "",
            n.code ?? "",
            `"${(n.description ?? "").replace(/"/g, '""')}"`,
            n.is_active ? "Oui" : "Non",
          ].join(","),
        );
        const csv = header + rows.join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `org-structure-${currentTree?.name ?? "export"}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success("Export termine");
    },
    [nodes, currentTree],
  );

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const nodeTypesByTree = currentTree
    ? getNodeTypesByTreeType(currentTree.tree_type)
    : INTERNAL_NODE_TYPES;

  // Possible move targets (exclude the node itself and its descendants)
  const moveTargets = useMemo(() => {
    if (!nodeToMove) return nodes;
    const descendants = new Set<string>();
    const collectDescendants = (id: string) => {
      descendants.add(id);
      nodes
        .filter((n) => n.parent_id === id)
        .forEach((c) => collectDescendants(c.id));
    };
    collectDescendants(nodeToMove.id);
    return nodes.filter((n) => !descendants.has(n.id));
  }, [nodeToMove, nodes]);

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* Header */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <PageHeader
            title="Structure organisationnelle"
            description="Gerez la hierarchie interne, les clients et les fournisseurs"
            icon={<Building2 className="h-5 w-5" />}
            actions={
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCreateTreeDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Nouvel arbre
                </Button>
              </div>
            }
          />

          {/* Tree type switcher */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {treesLoading ? (
              <span className="text-sm text-muted-foreground">
                Chargement...
              </span>
            ) : trees.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                Aucun arbre — cliquez sur &laquo;Nouvel arbre&raquo; pour
                commencer
              </span>
            ) : (
              trees.map((tree) => {
                const cfg = TREE_TYPE_CONFIG[tree.tree_type as TreeType];
                const isActive = currentTree?.id === tree.id;
                return (
                  <button
                    key={tree.id}
                    onClick={() => setCurrentTree(tree)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                      isActive
                        ? "bg-accent text-accent-foreground border-accent-foreground/20"
                        : "bg-card hover:bg-muted border-border text-muted-foreground",
                    )}
                  >
                    <span className={cfg?.color}>{cfg?.icon}</span>
                    <span>{tree.name}</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 py-0 ml-1"
                    >
                      {cfg?.label ?? tree.tree_type}
                    </Badge>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* Main content area */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {currentTree ? (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* ── Left panel: tree/chart/list ── */}
            <div
              className={cn(
                "flex-1 flex flex-col border-r border-border min-w-0",
                detailOpen ? "lg:w-[60%]" : "w-full",
              )}
            >
              {/* Toolbar */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card shrink-0 flex-wrap">
                {/* View mode tabs */}
                <div className="flex items-center bg-muted rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode("tree")}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                      viewMode === "tree"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <FolderTree className="h-3.5 w-3.5" />
                    Arbre
                  </button>
                  <button
                    onClick={() => setViewMode("orgchart")}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                      viewMode === "orgchart"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Organigramme
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                      viewMode === "list"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <List className="h-3.5 w-3.5" />
                    Liste
                  </button>
                </div>

                {/* Search */}
                <div className="relative flex-1 min-w-[160px] max-w-[280px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher..."
                    className="h-8 pl-8 text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Add node dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8">
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      {selectedNode
                        ? `Sous: ${selectedNode.name}`
                        : "Noeud racine"}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {Object.entries(nodeTypesByTree).map(([type, cfg]) => (
                      <DropdownMenuItem
                        key={type}
                        onClick={() => {
                          setNewNodeType(type);
                          setAddNodeParent(selectedNode);
                          setNewNodeName("");
                          setNewNodeCode("");
                          setNewNodeDescription("");
                          setAddNodeDialogOpen(true);
                        }}
                      >
                        <span
                          className={cn("text-xs font-medium mr-2", cfg.color)}
                        >
                          {cfg.label}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Export / Print */}
                <div className="ml-auto flex items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <Download className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExport("json")}>
                        Exporter JSON
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport("csv")}>
                        Exporter CSV
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={handlePrint}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* View content */}
              <div className="flex-1 overflow-auto">
                {nodesLoading ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    Chargement de la structure...
                  </div>
                ) : nodes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2 mt-12">
                    <Building2 className="h-10 w-10 opacity-30" />
                    <p>Aucun noeud dans cet arbre</p>
                    <p className="text-xs">
                      Cliquez sur &laquo;Ajouter&raquo; pour commencer
                    </p>
                  </div>
                ) : viewMode === "tree" ? (
                  /* ── Tree view ── */
                  <div className="p-2 space-y-0.5">
                    {treeHierarchy.map((node) => (
                      <TreeNodeItem
                        key={node.id}
                        node={node}
                        depth={0}
                        selectedId={selectedNode?.id ?? null}
                        onSelect={handleSelectNode}
                        expanded={expanded}
                        onToggleExpand={handleToggleExpand}
                        onContextAction={handleContextAction}
                        searchQuery={searchQuery}
                        draggedId={draggedId}
                        onDragStart={setDraggedId}
                        onDrop={handleDrop}
                        onDragEnd={() => setDraggedId(null)}
                      />
                    ))}
                  </div>
                ) : viewMode === "orgchart" ? (
                  /* ── Org chart view ── */
                  <div className="p-8 overflow-auto min-h-full">
                    <div className="flex flex-col items-center gap-0">
                      {treeHierarchy.map((root) => (
                        <OrgChartCard
                          key={root.id}
                          node={root}
                          selectedId={selectedNode?.id ?? null}
                          onSelect={handleSelectNode}
                          collapsed={orgchartCollapsed}
                          onToggleCollapse={handleToggleOrgchartCollapse}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  /* ── List view ── */
                  <ListView
                    nodes={nodes}
                    selectedId={selectedNode?.id ?? null}
                    onSelect={handleSelectNode}
                    searchQuery={searchQuery}
                  />
                )}
              </div>
            </div>

            {/* ── Right panel: detail ── */}
            {detailOpen ? (
              <div className="w-full lg:w-[40%] lg:max-w-[480px] border-t lg:border-t-0 border-border bg-card shrink-0 overflow-hidden">
                <DetailPanel
                  node={selectedNode}
                  allNodes={nodes}
                  tree={currentTree}
                  onClose={handleCloseDetail}
                  onNodeUpdated={() => {
                    if (currentTree) fetchNodes(currentTree.id);
                  }}
                  onAddChild={openAddNodeDialog}
                  onDeleteNode={openDeleteDialog}
                  onMoveNode={openMoveDialog}
                />
              </div>
            ) : (
              <div className="hidden lg:flex w-[320px] shrink-0 items-center justify-center text-muted-foreground text-sm p-8 text-center">
                <div>
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Selectionnez un noeud</p>
                  <p className="text-xs mt-1">
                    pour voir et modifier ses details
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-3">
            <Building2 className="h-16 w-16 opacity-20" />
            <p className="text-lg font-medium">
              Selectionnez un arbre organisationnel
            </p>
            <p className="text-sm">ou creez-en un nouveau</p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* Dialogs */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* Create tree dialog */}
      <Dialog
        open={createTreeDialogOpen}
        onOpenChange={setCreateTreeDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Creer un arbre organisationnel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tree-name">Nom *</Label>
              <Input
                id="tree-name"
                value={newTreeName}
                onChange={(e) => setNewTreeName(e.target.value)}
                placeholder="Ex: Groupe XYZ, Filiale France"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Type d&apos;arbre</Label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  Object.entries(TREE_TYPE_CONFIG) as [
                    TreeType,
                    (typeof TREE_TYPE_CONFIG)[TreeType],
                  ][]
                ).map(([type, cfg]) => (
                  <button
                    key={type}
                    onClick={() => setNewTreeType(type)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors",
                      newTreeType === type
                        ? "bg-accent text-accent-foreground border-accent-foreground/30"
                        : "bg-card border-border hover:bg-muted",
                    )}
                  >
                    <span className={cfg.color}>{cfg.icon}</span>
                    <span>{cfg.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateTreeDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateTree}
              disabled={creatingTree || !newTreeName.trim()}
            >
              {creatingTree ? "Creation..." : "Creer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add node dialog */}
      <Dialog open={addNodeDialogOpen} onOpenChange={setAddNodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Ajouter un noeud
              {addNodeParent ? ` sous "${addNodeParent.name}"` : " (racine)"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-node-name">Nom *</Label>
              <Input
                id="add-node-name"
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                placeholder="Nom du noeud"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={newNodeType} onValueChange={setNewNodeType}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un type..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(nodeTypesByTree).map(([type, cfg]) => (
                    <SelectItem key={type} value={type}>
                      <span className={cn("font-medium", cfg.color)}>
                        {cfg.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-node-code">Code</Label>
              <Input
                id="add-node-code"
                value={newNodeCode}
                onChange={(e) => setNewNodeCode(e.target.value)}
                placeholder="Ex: DRH, IT, SALES"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-node-desc">Description</Label>
              <Textarea
                id="add-node-desc"
                value={newNodeDescription}
                onChange={(e) => setNewNodeDescription(e.target.value)}
                placeholder="Description optionnelle..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddNodeDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleAddNode}
              disabled={addingNode || !newNodeName.trim() || !newNodeType}
            >
              {addingNode ? "Creation..." : "Creer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Supprimer &laquo;{nodeToDelete?.name}&raquo; ?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Cette action supprimera le noeud et tous ses sous-noeuds. Les
            affectations associees seront egalement supprimees.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteNode}
              disabled={deleting}
            >
              {deleting ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move node dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deplacer &laquo;{nodeToMove?.name}&raquo;</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nouveau parent</Label>
              <Select value={moveTargetId} onValueChange={setMoveTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir le noeud parent..." />
                </SelectTrigger>
                <SelectContent>
                  {moveTargets.map((n) => {
                    const nCfg = getNodeTypeConfig(n.node_type);
                    return (
                      <SelectItem key={n.id} value={n.id}>
                        <span className={cn("text-xs mr-1", nCfg.color)}>
                          [{nCfg.label}]
                        </span>{" "}
                        {n.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleMoveNode} disabled={moving || !moveTargetId}>
              {moving ? "Deplacement..." : "Deplacer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
