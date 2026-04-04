"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useUIStore } from "@/lib/store";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useOrgStore } from "@/stores/org-store";
import { orgApi } from "@/lib/api/org";
import type {
  OrgTree,
  OrgNode,
  Assignment,
  Person,
  TreeType,
  OrgGroup,
  Site,
  EffectivePolicy,
  PolicySource,
  OrgAuditEntry,
  OrgDelegation,
  OrgPolicy,
  AssignmentType,
  ResponsibilityType,
  EffectiveBoard,
  OrgBoardMember,
  BoardSummary,
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
  Shield,
  History,
  MapPin,
  Network,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Globe,
  UserCheck,
  Clock,
  FileText,
  LinkIcon,
  Ban,
  Star,
  Gavel,
  Info,
  Monitor,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// =============================================================================
// Node type configuration
// =============================================================================

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

const RESPONSIBILITY_TYPE_LABELS: Record<string, string> = {
  hierarchical: "Hierarchique",
  functional: "Fonctionnel",
  matrix: "Matriciel",
};

const GROUP_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  static: { label: "Statique", color: "text-blue-600 dark:text-blue-400" },
  dynamic: { label: "Dynamique", color: "text-green-600 dark:text-green-400" },
  derived: { label: "Derive", color: "text-orange-600 dark:text-orange-400" },
  hybrid: { label: "Hybride", color: "text-purple-600 dark:text-purple-400" },
};

const POLICY_DOMAIN_LABELS: Record<string, { label: string; color: string }> = {
  security: { label: "Securite", color: "text-red-600 dark:text-red-400" },
  modules: { label: "Modules", color: "text-blue-600 dark:text-blue-400" },
  naming: { label: "Nommage", color: "text-green-600 dark:text-green-400" },
  delegation: {
    label: "Delegation",
    color: "text-purple-600 dark:text-purple-400",
  },
  compliance: {
    label: "Conformite",
    color: "text-orange-600 dark:text-orange-400",
  },
  custom: {
    label: "Personnalise",
    color: "text-slate-600 dark:text-slate-400",
  },
};

const AUDIT_ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: "Creation", color: "text-green-600" },
  update: { label: "Modification", color: "text-blue-600" },
  delete: { label: "Suppression", color: "text-red-600" },
  move: { label: "Deplacement", color: "text-orange-600" },
  assign: { label: "Affectation", color: "text-purple-600" },
  unassign: { label: "Desaffectation", color: "text-pink-600" },
};

const BOARD_ROLE_LABELS: Record<string, string> = {
  president: "President",
  vice_president: "Vice-president",
  member: "Membre",
  treasurer: "Tresorier",
  secretary: "Secretaire",
};

const BOARD_ROLE_SUGGESTIONS = [
  "president",
  "vice_president",
  "member",
  "treasurer",
  "secretary",
];

const COUNTRY_FLAGS: Record<string, string> = {
  France: "FR",
  Belgique: "BE",
  Suisse: "CH",
  Canada: "CA",
  Luxembourg: "LU",
  Allemagne: "DE",
  "Royaume-Uni": "GB",
  "Etats-Unis": "US",
  Espagne: "ES",
  Italie: "IT",
};

// =============================================================================
// Helper: build tree hierarchy from flat nodes
// =============================================================================

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

// =============================================================================
// Tree View — Left-panel tree node (recursive)
// =============================================================================

interface BoardInfo {
  decisionMakerName?: string;
  isInherited: boolean;
}

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
  onDoubleClick?: (node: TreeNode) => void;
  boardMap?: Record<string, BoardInfo>;
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
                  <span className="text-[9px] bg-muted rounded-full w-4 h-4 flex items-center justify-center font-medium text-muted-foreground">
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

// =============================================================================
// Orgchart View — horizontal card-based org chart
// =============================================================================

interface OrgChartCardProps {
  node: TreeNode;
  selectedId: string | null;
  onSelect: (node: TreeNode) => void;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  boardMap?: Record<string, BoardInfo>;
}

function OrgChartCard({
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
          isSelected && "ring-2 ring-primary shadow-lg scale-105",
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
                <span className="text-[9px] bg-muted rounded-full w-4 h-4 flex items-center justify-center font-medium text-muted-foreground">
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

// =============================================================================
// Nav Panel — Groups Tab content
// =============================================================================

interface GroupsNavProps {
  groups: OrgGroup[];
  loading: boolean;
  selectedGroupId: string | null;
  onSelectGroup: (group: OrgGroup) => void;
}

function GroupsNav({
  groups,
  loading,
  selectedGroupId,
  onSelectGroup,
}: GroupsNavProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.description?.toLowerCase().includes(q) ||
        g.group_type.toLowerCase().includes(q),
    );
  }, [groups, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Chargement des groupes...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un groupe..."
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Aucun groupe</p>
          </div>
        ) : (
          filtered.map((group) => {
            const typeInfo = GROUP_TYPE_LABELS[group.group_type] ?? {
              label: group.group_type,
              color: "text-muted-foreground",
            };
            return (
              <div
                key={group.id}
                onClick={() => onSelectGroup(group)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
                  selectedGroupId === group.id
                    ? "bg-primary/10 ring-1 ring-primary/30"
                    : "hover:bg-muted/60",
                )}
              >
                <Network className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{group.name}</p>
                  {group.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {group.description}
                    </p>
                  )}
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] px-1.5 py-0 shrink-0",
                    typeInfo.color,
                  )}
                >
                  {typeInfo.label}
                </Badge>
                {!group.is_active && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1 py-0 shrink-0 text-muted-foreground"
                  >
                    Inactif
                  </Badge>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Nav Panel — Sites Tab content
// =============================================================================

interface SitesNavProps {
  sites: Site[];
  loading: boolean;
  selectedSiteId: string | null;
  onSelectSite: (site: Site) => void;
}

function SitesNav({
  sites,
  loading,
  selectedSiteId,
  onSelectSite,
}: SitesNavProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery) return sites;
    const q = searchQuery.toLowerCase();
    return sites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.country?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q),
    );
  }, [sites, searchQuery]);

  // Group by country
  const grouped = useMemo(() => {
    const map = new Map<string, Site[]>();
    for (const site of filtered) {
      const country = site.country ?? "Autre";
      if (!map.has(country)) map.set(country, []);
      map.get(country)!.push(site);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Chargement des sites...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un site..."
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {/* List grouped by country */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {grouped.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Aucun site</p>
          </div>
        ) : (
          grouped.map(([country, countrySites]) => {
            const flag = COUNTRY_FLAGS[country] ?? "";
            return (
              <div key={country}>
                <div className="flex items-center gap-2 px-3 py-1">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {flag ? `${flag} ` : ""}
                    {country}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1 py-0 ml-auto"
                  >
                    {countrySites.length}
                  </Badge>
                </div>
                <div className="space-y-0.5 ml-2">
                  {countrySites.map((site) => (
                    <div
                      key={site.id}
                      onClick={() => onSelectSite(site)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all",
                        selectedSiteId === site.id
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "hover:bg-muted/60",
                      )}
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {site.name}
                        </p>
                        {site.city && (
                          <p className="text-xs text-muted-foreground truncate">
                            {site.city}
                            {site.address ? ` — ${site.address}` : ""}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 shrink-0 capitalize"
                      >
                        {site.site_type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Stats bar
// =============================================================================

interface StatsBarProps {
  nodeCount: number;
  personCount: number;
  policyCount: number;
  siteCount: number;
}

function StatsBar({
  nodeCount,
  personCount,
  policyCount,
  siteCount,
}: StatsBarProps) {
  const stats = [
    {
      label: "Noeuds",
      value: nodeCount,
      icon: FolderTree,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Personnes",
      value: personCount,
      icon: Users,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-900/20",
    },
    {
      label: "Politiques",
      value: policyCount,
      icon: Shield,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      label: "Sites",
      value: siteCount,
      icon: MapPin,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-900/20",
    },
  ];

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card/50">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg",
              stat.bg,
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", stat.color)} />
            <span className={cn("text-sm font-bold", stat.color)}>
              {stat.value}
            </span>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Policies Tab content for Detail panel
// =============================================================================

interface PoliciesTabProps {
  nodeId: string;
  allPolicies: OrgPolicy[];
}

function PoliciesTab({ nodeId, allPolicies }: PoliciesTabProps) {
  const [effective, setEffective] = useState<EffectivePolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [attaching, setAttaching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    orgApi.policies
      .resolveNode(nodeId)
      .then((res) => {
        if (!cancelled) setEffective(res.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setEffective(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  const handleAttachPolicy = async () => {
    if (!selectedPolicyId) return;
    setAttaching(true);
    try {
      await orgApi.policies.addLink(selectedPolicyId, {
        link_type: "node",
        link_id: nodeId,
        is_blocked: false,
      });
      toast.success("Politique attachee");
      setAttachOpen(false);
      setSelectedPolicyId("");
      // Reload
      const res = await orgApi.policies.resolveNode(nodeId);
      setEffective(res.data ?? null);
    } catch {
      toast.error("Erreur lors de l'attachement");
    } finally {
      setAttaching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Chargement des politiques...
      </div>
    );
  }

  const sources = effective?.sources ?? [];
  const settings = effective?.settings ?? {};

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sources.length} regle(s) effective(s)
        </p>
        <DropdownMenu open={attachOpen} onOpenChange={setAttachOpen}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <LinkIcon className="h-4 w-4 mr-1" />
              Attacher une politique
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-3">
            <div className="space-y-3">
              <Select
                value={selectedPolicyId}
                onValueChange={setSelectedPolicyId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une politique..." />
                </SelectTrigger>
                <SelectContent>
                  {allPolicies.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="w-full"
                onClick={handleAttachPolicy}
                disabled={!selectedPolicyId || attaching}
              >
                {attaching ? "Attachement..." : "Attacher"}
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {sources.length === 0 && Object.keys(settings).length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucune politique effective</p>
          <p className="text-xs mt-1">
            Attachez une politique pour configurer les regles
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((source: PolicySource, idx: number) => {
            const domainInfo = POLICY_DOMAIN_LABELS[source.link_type] ?? {
              label: source.link_type,
              color: "text-muted-foreground",
            };
            return (
              <div
                key={`${source.policy_id}-${source.key}-${idx}`}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
              >
                <Shield className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{source.key}</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        domainInfo.color,
                      )}
                    >
                      {source.link_type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {source.policy_name} — via {source.via}
                  </p>
                  <p className="text-xs font-mono mt-1 text-foreground/70">
                    {JSON.stringify(source.value)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Audit Tab content for Detail panel
// =============================================================================

interface AuditTabProps {
  entityType: string;
  entityId: string;
}

function AuditTab({ entityType, entityId }: AuditTabProps) {
  const [entries, setEntries] = useState<OrgAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    orgApi.audit
      .entityHistory(entityType, entityId)
      .then((res) => {
        if (!cancelled) setEntries(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Chargement de l&apos;historique...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucun historique</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      <p className="text-sm text-muted-foreground mb-3">
        {entries.length} evenement(s)
      </p>
      <div className="space-y-2">
        {entries.map((entry) => {
          const actionInfo = AUDIT_ACTION_LABELS[entry.action] ?? {
            label: entry.action,
            color: "text-muted-foreground",
          };
          const date = new Date(entry.created_at);
          return (
            <div
              key={entry.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/30"
            >
              <div className="flex flex-col items-center mt-0.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px] px-1.5 py-0", actionInfo.color)}
                  >
                    {actionInfo.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {entry.entity_type}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {entry.actor_type}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {date.toLocaleDateString("fr-FR")}{" "}
                  {date.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {entry.actor_id && ` — ${entry.actor_id.slice(0, 8)}...`}
                </p>
                {Object.keys(entry.changes).length > 0 && (
                  <p className="text-xs font-mono mt-1 text-foreground/60 truncate">
                    {JSON.stringify(entry.changes).slice(0, 120)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Delegations Tab (focus mode only)
// =============================================================================

interface DelegationsTabProps {
  nodeId: string;
  persons: Person[];
}

function DelegationsTab({ nodeId, persons }: DelegationsTabProps) {
  const [delegations, setDelegations] = useState<OrgDelegation[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [delegateId, setDelegateId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    read: true,
    write: false,
    manage_assignments: false,
    manage_children: false,
    manage_policies: false,
    delegate: false,
  });
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadDelegations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orgApi.delegations.list();
      // Filter to only delegations scoped to this node
      const all = res.data ?? [];
      setDelegations(all.filter((d) => d.scope_node_id === nodeId));
    } catch {
      setDelegations([]);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    loadDelegations();
  }, [loadDelegations]);

  const handleCreate = async () => {
    if (!delegateId) return;
    setCreating(true);
    try {
      await orgApi.delegations.create({
        delegate_type: "person",
        delegate_id: delegateId,
        scope_node_id: nodeId,
        permissions,
        depth: 0,
        expires_at: expiresAt || undefined,
        is_active: true,
      });
      toast.success("Delegation creee");
      setCreateOpen(false);
      setDelegateId("");
      setExpiresAt("");
      setPermissions({
        read: true,
        write: false,
        manage_assignments: false,
        manage_children: false,
        manage_policies: false,
        delegate: false,
      });
      loadDelegations();
    } catch {
      toast.error("Erreur lors de la creation");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    try {
      await orgApi.delegations.revoke(id);
      toast.success("Delegation revoquee");
      loadDelegations();
    } catch {
      toast.error("Erreur lors de la revocation");
    } finally {
      setRevoking(null);
    }
  };

  const togglePermission = (key: string) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Chargement des delegations...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {delegations.length} delegation(s) active(s)
        </p>
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nouvelle delegation
        </Button>
      </div>

      {delegations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucune delegation pour ce noeud</p>
        </div>
      ) : (
        <div className="space-y-2">
          {delegations.map((d) => {
            const permKeys = Object.entries(d.permissions)
              .filter(([, v]) => v)
              .map(([k]) => k);
            const date = d.expires_at ? new Date(d.expires_at) : null;
            return (
              <div
                key={d.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
              >
                <UserCheck className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {d.delegate_id.slice(0, 8)}...
                    <span className="text-xs text-muted-foreground ml-2">
                      ({d.delegate_type})
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {permKeys.map((k) => (
                      <Badge
                        key={k}
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {k}
                      </Badge>
                    ))}
                  </div>
                  {date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Expire: {date.toLocaleDateString("fr-FR")}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-destructive hover:text-destructive h-7"
                  onClick={() => handleRevoke(d.id)}
                  disabled={revoking === d.id}
                >
                  <Ban className="h-3.5 w-3.5 mr-1" />
                  {revoking === d.id ? "..." : "Revoquer"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create delegation dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle delegation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Personne delegataire *</Label>
              <Select value={delegateId} onValueChange={setDelegateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une personne..." />
                </SelectTrigger>
                <SelectContent>
                  {persons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                      {p.email ? ` (${p.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(permissions).map((key) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors"
                  >
                    <Checkbox
                      checked={permissions[key]}
                      onCheckedChange={() => togglePermission(key)}
                    />
                    <span className="text-sm capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delegation-expires">Date d&apos;expiration</Label>
              <Input
                id="delegation-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={creating || !delegateId}>
              {creating ? "Creation..." : "Creer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Governance Tab content for Detail panel
// =============================================================================

interface GovernanceTabProps {
  nodeId: string;
  persons: Person[];
  allNodes: OrgNode[];
}

function GovernanceTab({ nodeId, persons, allNodes }: GovernanceTabProps) {
  const [effectiveBoard, setEffectiveBoard] = useState<EffectiveBoard | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberPersonId, setMemberPersonId] = useState("");
  const [memberRole, setMemberRole] = useState("member");
  const [memberIsDecisionMaker, setMemberIsDecisionMaker] = useState(false);
  const [memberPersonSearch, setMemberPersonSearch] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [creatingBoard, setCreatingBoard] = useState(false);

  const loadBoard = useCallback(async () => {
    if (typeof orgApi.nodes.board !== "function") return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await orgApi.nodes.board(nodeId);
      setEffectiveBoard(res.data ?? null);
    } catch {
      setEffectiveBoard(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const handleCreateBoard = async () => {
    setCreatingBoard(true);
    try {
      await orgApi.nodes.createBoard(nodeId);
      toast.success("Board de gouvernance cree");
      await loadBoard();
    } catch {
      toast.error("Erreur lors de la creation du board");
    } finally {
      setCreatingBoard(false);
    }
  };

  const handleAddMember = async () => {
    if (!memberPersonId) return;
    setAddingMember(true);
    try {
      await orgApi.nodes.addBoardMember(nodeId, {
        person_id: memberPersonId,
        role: memberRole,
        is_decision_maker: memberIsDecisionMaker,
        sort_order: (effectiveBoard?.members?.length ?? 0) + 1,
      });
      toast.success("Membre ajoute au board");
      setAddMemberOpen(false);
      setMemberPersonId("");
      setMemberRole("member");
      setMemberIsDecisionMaker(false);
      setMemberPersonSearch("");
      await loadBoard();
    } catch {
      toast.error("Erreur lors de l'ajout du membre");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMember(memberId);
    try {
      await orgApi.nodes.removeBoardMember(nodeId, memberId);
      toast.success("Membre retire du board");
      await loadBoard();
    } catch {
      toast.error("Erreur lors du retrait du membre");
    } finally {
      setRemovingMember(null);
    }
  };

  const filteredBoardPersons = useMemo(() => {
    if (!memberPersonSearch) return persons;
    const q = memberPersonSearch.toLowerCase();
    return persons.filter(
      (p) =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q),
    );
  }, [persons, memberPersonSearch]);

  const getPersonName = (personId: string): string => {
    const p = persons.find((p) => p.id === personId);
    return p ? `${p.first_name} ${p.last_name}` : personId.slice(0, 8) + "...";
  };

  const getPersonInitials = (personId: string): string => {
    const p = persons.find((p) => p.id === personId);
    return p ? `${p.first_name[0]}${p.last_name[0]}` : "?";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Chargement de la gouvernance...
      </div>
    );
  }

  const isInherited = !!effectiveBoard?.inherited_from_node_id;
  const inheritedNodeName =
    effectiveBoard?.inherited_from_node_name ??
    allNodes.find((n) => n.id === effectiveBoard?.inherited_from_node_id)
      ?.name ??
    "noeud parent";
  const members = effectiveBoard?.members ?? [];

  return (
    <div className="p-4 space-y-4">
      {/* Inherited banner */}
      {isInherited && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Board herite de{" "}
              <span className="font-semibold">{inheritedNodeName}</span>
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCreateBoard}
            disabled={creatingBoard}
            className="shrink-0"
          >
            {creatingBoard ? "Creation..." : "Definir un board propre"}
          </Button>
        </div>
      )}

      {/* No board at all */}
      {!effectiveBoard && !loadError && (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <Gavel className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucun board de gouvernance</p>
          <p className="text-xs mt-1">
            Creez un board pour definir les decideurs
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={handleCreateBoard}
            disabled={creatingBoard}
          >
            {creatingBoard ? "Creation..." : "Creer un board"}
          </Button>
        </div>
      )}

      {loadError && !effectiveBoard && (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <Gavel className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucun board de gouvernance</p>
          <p className="text-xs mt-1">
            Creez un board pour definir les decideurs
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={handleCreateBoard}
            disabled={creatingBoard}
          >
            {creatingBoard ? "Creation..." : "Creer un board"}
          </Button>
        </div>
      )}

      {/* Board members list */}
      {effectiveBoard && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {members.length} membre(s) du board
            </p>
            {!isInherited && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddMemberOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Ajouter un membre
              </Button>
            )}
          </div>

          {members.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
              <Users className="h-6 w-6 mx-auto mb-2 opacity-30" />
              <p>Aucun membre dans le board</p>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((m: OrgBoardMember) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getPersonInitials(m.person_id)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getPersonName(m.person_id)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {BOARD_ROLE_LABELS[m.role] ?? m.role}
                  </Badge>
                  {m.is_decision_maker && (
                    <Star className="h-4 w-4 shrink-0 text-amber-500 fill-amber-500" />
                  )}
                  {!isInherited && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveMember(m.id)}
                      disabled={removingMember === m.id}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add member inline form */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un membre au board</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rechercher une personne *</Label>
              <Input
                value={memberPersonSearch}
                onChange={(e) => setMemberPersonSearch(e.target.value)}
                placeholder="Nom, prenom ou email..."
              />
              <Select value={memberPersonId} onValueChange={setMemberPersonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une personne..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredBoardPersons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                      {p.email ? ` (${p.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={memberRole} onValueChange={setMemberRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOARD_ROLE_SUGGESTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {BOARD_ROLE_LABELS[role] ?? role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors">
              <Checkbox
                checked={memberIsDecisionMaker}
                onCheckedChange={(checked) =>
                  setMemberIsDecisionMaker(checked === true)
                }
              />
              <Star className="h-4 w-4 text-amber-500" />
              <span className="text-sm">Decideur final</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={addingMember || !memberPersonId}
            >
              {addingMember ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Detail panel (right) — enhanced with 6 tabs (7 in focus mode)
// =============================================================================

type AssignmentWithPerson = Assignment & { person?: Person };

// ── Tab Categories & Visibility ──────────────────────────────────────────────

interface TabDef {
  id: string;
  label: string;
  category: "organisation" | "groupes_politiques" | "infrastructure";
}

const ALL_TABS: TabDef[] = [
  // Organisation
  { id: "details", label: "Details", category: "organisation" },
  { id: "people", label: "Personnes", category: "organisation" },
  { id: "governance", label: "Gouvernance", category: "organisation" },
  // Groupes & Politiques
  { id: "groups", label: "Groupes", category: "groupes_politiques" },
  { id: "sites", label: "Sites", category: "groupes_politiques" },
  { id: "policies", label: "Policies", category: "groupes_politiques" },
  { id: "gpo", label: "GPO", category: "groupes_politiques" },
  // Infrastructure
  { id: "computers", label: "Ordinateurs", category: "infrastructure" },
  { id: "kerberos", label: "Kerberos", category: "infrastructure" },
  { id: "dns", label: "DNS", category: "infrastructure" },
  { id: "audit", label: "Audit", category: "infrastructure" },
];

const CATEGORY_LABELS: Record<string, string> = {
  organisation: "Organisation",
  groupes_politiques: "Groupes & Politiques",
  infrastructure: "Infrastructure",
};

const DEFAULT_TAB_VISIBILITY: Record<string, string[]> = {
  group: [
    "details",
    "people",
    "governance",
    "groups",
    "sites",
    "policies",
    "gpo",
    "computers",
    "kerberos",
    "dns",
    "audit",
  ],
  subsidiary: [
    "details",
    "people",
    "governance",
    "groups",
    "sites",
    "policies",
    "gpo",
    "computers",
    "kerberos",
    "audit",
  ],
  bu: [
    "details",
    "people",
    "governance",
    "groups",
    "sites",
    "policies",
    "gpo",
    "computers",
    "audit",
  ],
  department: [
    "details",
    "people",
    "governance",
    "groups",
    "sites",
    "policies",
    "gpo",
    "computers",
    "audit",
  ],
  service: [
    "details",
    "people",
    "groups",
    "policies",
    "gpo",
    "computers",
    "audit",
  ],
  team: ["details", "people", "groups", "gpo", "computers", "audit"],
  position: ["details", "people", "audit"],
  computer: ["details", "kerberos", "dns", "audit"],
};

/** Get visible tabs for a node type, with optional override from schema.visible_tabs */
function getVisibleTabs(
  nodeType: string,
  schema?: Record<string, unknown>,
): TabDef[] {
  // Check for override in schema.visible_tabs
  const override = schema?.visible_tabs as Record<string, string[]> | undefined;
  if (override) {
    const allIds = [
      ...(override.organisation || []),
      ...(override.groupes_politiques || []),
      ...(override.infrastructure || []),
    ];
    return ALL_TABS.filter((t) => allIds.includes(t.id));
  }
  // Default mapping
  const defaultIds =
    DEFAULT_TAB_VISIBILITY[nodeType] ?? DEFAULT_TAB_VISIBILITY["department"];
  return ALL_TABS.filter((t) => defaultIds.includes(t.id));
}

// ─────────────────────────────────────────────────────────────────────────────

interface DetailPanelProps {
  node: OrgNode | null;
  allNodes: OrgNode[];
  tree: OrgTree;
  onClose: () => void;
  onNodeUpdated: () => void;
  onAddChild: (parentNode: OrgNode) => void;
  onDeleteNode: (node: OrgNode) => void;
  onMoveNode: (node: OrgNode) => void;
  focusMode: boolean;
  allPolicies: OrgPolicy[];
  persons: Person[];
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
  focusMode,
  allPolicies,
  persons,
}: DetailPanelProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailTab, setDetailTab] = useState("details");
  const [assignments, setAssignments] = useState<AssignmentWithPerson[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  // Assignment creation dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignPersonSearch, setAssignPersonSearch] = useState("");
  const [assignPersonId, setAssignPersonId] = useState("");
  const [assignType, setAssignType] = useState<AssignmentType>("holder");
  const [assignResponsibility, setAssignResponsibility] =
    useState<ResponsibilityType>("hierarchical");
  const [assignFte, setAssignFte] = useState("1.0");
  const [assignStartDate, setAssignStartDate] = useState("");
  const [assignCreating, setAssignCreating] = useState(false);
  const [endingAssignment, setEndingAssignment] = useState<string | null>(null);

  // Board decision maker for the header
  const [boardDecisionMaker, setBoardDecisionMaker] = useState<{
    name: string;
    inherited: boolean;
    inheritedFrom?: string;
  } | null>(null);

  useEffect(() => {
    if (node) {
      setName(node.name);
      setCode(node.code ?? "");
      setDescription(node.description ?? "");
      setDetailTab("details");
      // Load board decision maker for header display
      setBoardDecisionMaker(null);
      if (typeof orgApi.nodes.board !== "function") return;
      orgApi.nodes
        .board(node.id)
        .then((res) => {
          const board = res.data;
          if (!board) return;
          const decisionMakers = (board.members ?? []).filter(
            (m: OrgBoardMember) => m.is_decision_maker,
          );
          if (decisionMakers.length > 0) {
            const dm = decisionMakers[0];
            const person = persons.find((p) => p.id === dm.person_id);
            const dmName = person
              ? `${person.first_name} ${person.last_name}`
              : dm.person_id.slice(0, 8) + "...";
            setBoardDecisionMaker({
              name: dmName,
              inherited: !!board.inherited_from_node_id,
              inheritedFrom:
                board.inherited_from_node_name ??
                allNodes.find((n) => n.id === board.inherited_from_node_id)
                  ?.name,
            });
          }
        })
        .catch(() => {
          // No board or error — leave null
        });
    }
  }, [node, persons, allNodes]);

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

  const visibleTabs = useMemo(() => {
    if (!node) return ALL_TABS.filter((t) => t.id === "details");
    return getVisibleTabs(node.node_type);
  }, [node]);

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

  const handleCreateAssignment = async () => {
    if (!node || !assignPersonId) return;
    setAssignCreating(true);
    try {
      await orgApi.assignments.create({
        person_id: assignPersonId,
        node_id: node.id,
        assignment_type: assignType,
        responsibility_type: assignResponsibility,
        fte_ratio: parseFloat(assignFte) || 1.0,
        start_date: assignStartDate || new Date().toISOString().split("T")[0],
        is_primary: true,
      });
      toast.success("Affectation creee");
      setAssignDialogOpen(false);
      setAssignPersonId("");
      setAssignPersonSearch("");
      setAssignType("holder");
      setAssignResponsibility("hierarchical");
      setAssignFte("1.0");
      setAssignStartDate("");
      loadAssignments();
    } catch {
      toast.error("Erreur lors de la creation");
    } finally {
      setAssignCreating(false);
    }
  };

  const handleEndAssignment = async (assignmentId: string) => {
    setEndingAssignment(assignmentId);
    try {
      await orgApi.assignments.end(assignmentId, "Fin d'affectation");
      toast.success("Affectation terminee");
      loadAssignments();
    } catch {
      toast.error("Erreur lors de la cloture");
    } finally {
      setEndingAssignment(null);
    }
  };

  // Filter persons by search
  const filteredPersons = useMemo(() => {
    if (!assignPersonSearch) return persons;
    const q = assignPersonSearch.toLowerCase();
    return persons.filter(
      (p) =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q),
    );
  }, [persons, assignPersonSearch]);

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
        {boardDecisionMaker && (
          <div className="flex items-center gap-1.5 mt-1">
            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
            <span className="text-xs text-muted-foreground">
              Decideur:{" "}
              <span className="font-medium text-foreground">
                {boardDecisionMaker.name}
              </span>
              {boardDecisionMaker.inherited &&
                boardDecisionMaker.inheritedFrom && (
                  <span className="text-muted-foreground">
                    {" "}
                    (herite de {boardDecisionMaker.inheritedFrom})
                  </span>
                )}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        value={detailTab}
        onValueChange={setDetailTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* Categorized TabsList */}
        <TabsList
          className={cn(
            "mx-4 mt-3 shrink-0 w-auto h-auto flex-wrap justify-start gap-0 bg-transparent p-0 border-b",
            focusMode && "mx-6",
          )}
        >
          {(
            ["organisation", "groupes_politiques", "infrastructure"] as const
          ).map((category) => {
            const categoryTabs = visibleTabs.filter(
              (t) => t.category === category,
            );
            if (categoryTabs.length === 0) return null;
            return (
              <div
                key={category}
                className="flex items-center gap-0.5 pr-3 mr-3 border-r border-border/30 last:border-r-0 last:mr-0 last:pr-0 py-1"
              >
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-2 hidden lg:inline">
                  {CATEGORY_LABELS[category]}
                </span>
                {categoryTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="text-xs px-2 py-1 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </div>
            );
          })}
          {focusMode && (
            <div className="flex items-center gap-0.5 py-1">
              <TabsTrigger
                value="delegations"
                className="text-xs px-2 py-1 h-7 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <UserCheck className="h-3 w-3 mr-1" />
                Delegations
              </TabsTrigger>
            </div>
          )}
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setAssignDialogOpen(true);
                  setAssignStartDate(new Date().toISOString().split("T")[0]);
                }}
              >
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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleEndAssignment(a.id)}
                      disabled={endingAssignment === a.id}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
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

          {/* Governance tab */}
          <TabsContent value="governance" className="mt-0">
            <GovernanceTab
              nodeId={node.id}
              persons={persons}
              allNodes={allNodes}
            />
          </TabsContent>

          {/* Policies tab */}
          <TabsContent value="policies" className="mt-0">
            <PoliciesTab nodeId={node.id} allPolicies={allPolicies} />
          </TabsContent>

          {/* Audit tab */}
          <TabsContent value="audit" className="mt-0">
            <AuditTab entityType="node" entityId={node.id} />
          </TabsContent>

          {/* GPO tab */}
          <TabsContent value="gpo" className="mt-0 p-4">
            <div className="text-center text-muted-foreground py-8">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Strategies de groupe (GPO)</p>
              <p className="text-xs mt-1">
                Les GPO liees a cette OU seront affichees ici
              </p>
            </div>
          </TabsContent>

          {/* Computers tab */}
          <TabsContent value="computers" className="mt-0 p-4">
            <div className="text-center text-muted-foreground py-8">
              <Monitor className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Ordinateurs</p>
              <p className="text-xs mt-1">
                Les machines jointes au domaine dans cette OU
              </p>
            </div>
          </TabsContent>

          {/* Kerberos tab */}
          <TabsContent value="kerberos" className="mt-0 p-4">
            <div className="text-center text-muted-foreground py-8">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Kerberos</p>
              <p className="text-xs mt-1">Principals et cles de chiffrement</p>
            </div>
          </TabsContent>

          {/* DNS tab */}
          <TabsContent value="dns" className="mt-0 p-4">
            <div className="text-center text-muted-foreground py-8">
              <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">DNS</p>
              <p className="text-xs mt-1">Records DNS associes a ce noeud</p>
            </div>
          </TabsContent>

          {/* Delegations tab (focus mode only) */}
          {focusMode && (
            <TabsContent value="delegations" className="mt-0">
              <DelegationsTab nodeId={node.id} persons={persons} />
            </TabsContent>
          )}
        </div>
      </Tabs>

      {/* Assignment creation dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Affecter une personne a &laquo;{node.name}&raquo;
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rechercher une personne *</Label>
              <Input
                value={assignPersonSearch}
                onChange={(e) => setAssignPersonSearch(e.target.value)}
                placeholder="Nom, prenom ou email..."
              />
              <Select value={assignPersonId} onValueChange={setAssignPersonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une personne..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredPersons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                      {p.email ? ` (${p.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type d&apos;affectation</Label>
                <Select
                  value={assignType}
                  onValueChange={(v) => setAssignType(v as AssignmentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsabilite</Label>
                <Select
                  value={assignResponsibility}
                  onValueChange={(v) =>
                    setAssignResponsibility(v as ResponsibilityType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RESPONSIBILITY_TYPE_LABELS).map(
                      ([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assign-fte">Ratio ETP</Label>
                <Input
                  id="assign-fte"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={assignFte}
                  onChange={(e) => setAssignFte(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign-start">Date de debut</Label>
                <Input
                  id="assign-start"
                  type="date"
                  value={assignStartDate}
                  onChange={(e) => setAssignStartDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateAssignment}
              disabled={assignCreating || !assignPersonId}
            >
              {assignCreating ? "Affectation..." : "Affecter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// List View — Table view
// =============================================================================

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
              const nodeCfg = getNodeTypeConfig(node.node_type);
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
                        nodeCfg.color,
                        nodeCfg.bg,
                      )}
                    >
                      {nodeCfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {node.parent_id
                      ? (parentMap.get(node.parent_id) ?? "\u2014")
                      : "\u2014"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {node.code ?? "\u2014"}
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

// =============================================================================
// Main page
// =============================================================================

export default function OrgStructurePage() {
  usePageTitle("Structure organisationnelle \u2014 Administration");

  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const rightSidebarOpen = useUIStore((s) => s.rightSidebarOpen);
  const rightSidebarPinned = useUIStore((s) => s.rightSidebarPinned);
  const rightPanelOpen = rightSidebarOpen || rightSidebarPinned;

  const {
    trees,
    treesLoading,
    currentTree,
    nodes,
    nodesLoading,
    selectedNode,
    persons,
    sites,
    groups,
    policies,
    groupsLoading,
    sitesLoading,
    policiesLoading,
    activeNavTab,
    focusMode,
    fetchTrees,
    setCurrentTree,
    fetchNodes,
    selectNode,
    fetchPersons,
    fetchSites,
    fetchGroups,
    fetchPolicies,
    setActiveNavTab,
    setFocusMode,
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

  // Group/Site selection
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  // Dialogs
  const [createTreeDialogOpen, setCreateTreeDialogOpen] = useState(false);
  const [newTreeName, setNewTreeName] = useState("");
  const [newTreeType, setNewTreeType] = useState<TreeType>("internal");
  const [creatingTree, setCreatingTree] = useState(false);
  const [newTreeDecisionMakerId, setNewTreeDecisionMakerId] = useState("");
  const [newTreePersonSearch, setNewTreePersonSearch] = useState("");

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

  // Board governance map for tree indicators
  const [boardMap, setBoardMap] = useState<Record<string, BoardInfo>>({});

  // Build tree hierarchy
  const treeHierarchy = useMemo(() => buildTree(nodes), [nodes]);

  // Fresh selectedNode from current nodes (avoids stale references)
  const freshSelectedNode = useMemo(
    () =>
      selectedNode
        ? (nodes.find((n) => n.id === selectedNode.id) ?? null)
        : null,
    [nodes, selectedNode],
  );

  // Track the currentTree.id to avoid duplicate fetches
  const currentTreeIdRef = React.useRef<string | null>(null);
  const selectedNodeIdRef = React.useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => {
    selectedNodeIdRef.current = selectedNode?.id ?? null;
  }, [selectedNode]);

  // Load data on mount (once)
  useEffect(() => {
    fetchTrees();
    fetchPersons();
    fetchSites();
    fetchGroups();
    fetchPolicies();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load board governance map for tree indicators
  useEffect(() => {
    if (nodes.length === 0) return;
    orgApi.nodes
      .listBoards()
      .then((res) => {
        const summaries = res.data;
        const map: Record<string, BoardInfo> = {};
        // Mark nodes that have their own board
        const boardNodeIds = new Set(
          summaries.map((s: BoardSummary) => s.node_id),
        );
        for (const s of summaries) {
          const person = s.decision_maker_person_id
            ? persons.find((p) => p.id === s.decision_maker_person_id)
            : undefined;
          map[s.node_id] = {
            decisionMakerName: person
              ? `${person.first_name} ${person.last_name}`
              : undefined,
            isInherited: false,
          };
        }
        // For nodes without own board, find inherited board via parent chain
        for (const node of nodes) {
          if (!boardNodeIds.has(node.id)) {
            let parentId: string | undefined = node.parent_id;
            while (parentId) {
              if (map[parentId]) {
                map[node.id] = {
                  ...map[parentId],
                  isInherited: true,
                };
                break;
              }
              const parentNode = nodes.find((n) => n.id === parentId);
              parentId = parentNode?.parent_id;
            }
          }
        }
        setBoardMap(map);
      })
      .catch(() => {
        /* silently ignore — indicators are optional */
      });
  }, [nodes, persons]);

  // Auto-select first tree (only when trees change and no current tree)
  useEffect(() => {
    if (trees.length > 0 && !currentTree) {
      setCurrentTree(trees[0]);
    }
  }, [trees, currentTree, setCurrentTree]);

  // Load nodes when tree changes (using ref to prevent double-fetch)
  useEffect(() => {
    if (currentTree && currentTree.id !== currentTreeIdRef.current) {
      currentTreeIdRef.current = currentTree.id;
      fetchNodes(currentTree.id);
    }
  }, [currentTree, fetchNodes]);

  // Track nodes version to detect actual data changes (not reference changes)
  const nodesVersionRef = React.useRef(0);
  const prevNodesLenRef = React.useRef(0);

  // When nodes actually change: expand new parents + sync selectedNode
  useEffect(() => {
    if (nodes.length === 0) {
      prevNodesLenRef.current = 0;
      return;
    }

    // Only run expansion logic if the node count changed (real mutation happened)
    if (nodes.length !== prevNodesLenRef.current) {
      prevNodesLenRef.current = nodes.length;
      nodesVersionRef.current += 1;

      // Expand all nodes that have children
      const parents = new Set<string>();
      for (const n of nodes) {
        if (!n.parent_id) parents.add(n.id);
        if (n.parent_id) parents.add(n.parent_id);
      }
      setExpanded(parents);
    }

    // Sync selectedNode reference (no store write if unchanged)
    const selId = selectedNodeIdRef.current;
    if (selId) {
      const updated = nodes.find((n) => n.id === selId);
      if (!updated) {
        selectedNodeIdRef.current = null;
        selectNode(null);
        setDetailOpen(false);
      }
      // Don't call selectNode(updated) here — it causes render loops.
      // The selectedNode in the store is stale but the detail panel
      // reads from nodes directly via selectedNode.id lookup.
    }
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Batch-fetch effective boards for all nodes (governance indicators)
  const boardFetchVersionRef = React.useRef(0);
  useEffect(() => {
    if (nodes.length === 0) {
      setBoardMap({});
      return;
    }
    if (typeof orgApi.nodes.board !== "function") return;

    const version = ++boardFetchVersionRef.current;
    const fetchBoards = async () => {
      const results = await Promise.allSettled(
        nodes.map((n) =>
          orgApi.nodes
            .board(n.id)
            .then((res) => ({ nodeId: n.id, data: res.data })),
        ),
      );
      // Abort if a newer fetch has started
      if (boardFetchVersionRef.current !== version) return;

      const map: Record<string, BoardInfo> = {};
      for (const result of results) {
        if (result.status !== "fulfilled" || !result.value.data) continue;
        const { nodeId, data } = result.value;
        const isInherited = !!data.inherited_from_node_id;
        const decisionMaker = data.members?.find((m) => m.is_decision_maker);
        let decisionMakerName: string | undefined;
        if (decisionMaker) {
          const person = persons.find((p) => p.id === decisionMaker.person_id);
          if (person) {
            decisionMakerName = `${person.first_name} ${person.last_name}`;
          }
        }
        map[nodeId] = { decisionMakerName, isInherited };
      }
      setBoardMap(map);
    };
    fetchBoards();
  }, [nodes, persons]);

  // Keyboard handler for focus mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focusMode) {
        setFocusMode(false);
      }
      if (e.key === "Enter" && selectedNode && !focusMode) {
        // Only enter focus mode when the main content area has focus, not dialogs
        const activeEl = document.activeElement;
        const isInput =
          activeEl?.tagName === "INPUT" ||
          activeEl?.tagName === "TEXTAREA" ||
          activeEl?.tagName === "SELECT";
        if (!isInput) {
          setFocusMode(true);
          setDetailOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusMode, selectedNode, setFocusMode]);

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

  // Full reload: refetch nodes for current tree (+ trees list)
  const reloadTree = useCallback(async () => {
    if (currentTree) {
      // Reset ref so the useEffect doesn't skip the fetch
      currentTreeIdRef.current = null;
      // Fetch both in parallel
      await Promise.all([fetchTrees(), fetchNodes(currentTree.id)]);
      // Restore ref
      currentTreeIdRef.current = currentTree.id;
    } else {
      await fetchTrees();
    }
  }, [fetchTrees, fetchNodes, currentTree]);

  const handleSelectNode = useCallback(
    (node: OrgNode) => {
      selectNode(node);
      setDetailOpen(true);
    },
    [selectNode],
  );

  const handleDoubleClickNode = useCallback(
    (node: TreeNode) => {
      selectNode(node);
      setDetailOpen(true);
      setFocusMode(true);
    },
    [selectNode, setFocusMode],
  );

  const handleCloseDetail = useCallback(() => {
    if (focusMode) {
      setFocusMode(false);
    }
    setDetailOpen(false);
    selectNode(null);
  }, [selectNode, focusMode, setFocusMode]);

  const handleExitFocusMode = useCallback(() => {
    setFocusMode(false);
  }, [setFocusMode]);

  const handleCreateTree = async () => {
    if (!newTreeName.trim() || !newTreeDecisionMakerId) return;
    setCreatingTree(true);
    try {
      const res = await orgApi.trees.create({
        tree_type: newTreeType,
        name: newTreeName.trim(),
      });
      const createdNode = res.data!;
      // Create board and add decision maker
      try {
        await orgApi.nodes.createBoard(createdNode.id);
        await orgApi.nodes.addBoardMember(createdNode.id, {
          person_id: newTreeDecisionMakerId,
          role: "president",
          is_decision_maker: true,
          sort_order: 1,
        });
      } catch {
        console.warn("Board creation succeeded but member add may have failed");
      }
      toast.success("Arbre cree avec decideur");
      setCreateTreeDialogOpen(false);
      setNewTreeName("");
      setNewTreeDecisionMakerId("");
      setNewTreePersonSearch("");
      await fetchTrees();
      // Map the created root node (OrgNode) to OrgTree shape
      setCurrentTree({
        id: createdNode.id,
        tenant_id: createdNode.tenant_id ?? "",
        tree_type: newTreeType,
        name: createdNode.name,
      });
    } catch {
      toast.error("Erreur lors de la creation");
    } finally {
      setCreatingTree(false);
    }
  };

  const handleDeleteTree = async () => {
    if (!currentTree) return;
    if (
      !confirm(
        `Supprimer l'arbre "${currentTree.name}" et tous ses noeuds ? Cette action est irreversible.`,
      )
    )
      return;
    try {
      await orgApi.nodes.deleteRecursive(currentTree.id);
      toast.success("Arbre supprime");
      setCurrentTree(null);
      selectNode(null);
      setDetailOpen(false);
      await fetchTrees();
    } catch {
      toast.error("Erreur lors de la suppression de l'arbre");
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
        // If no parent selected, add under the root (currentTree IS the root node)
        parent_id: addNodeParent?.id ?? currentTree.id,
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
      await reloadTree();
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
      // Check if the node has children — if so, use recursive delete
      const hasChildren = nodes.some((n) => n.parent_id === nodeToDelete.id);
      if (hasChildren) {
        await orgApi.nodes.deleteRecursive(nodeToDelete.id);
      } else {
        await orgApi.nodes.delete(nodeToDelete.id);
      }
      toast.success("Noeud supprime");
      setDeleteDialogOpen(false);
      if (selectedNode?.id === nodeToDelete.id) {
        selectNode(null);
        setDetailOpen(false);
      }
      // If deleting the root node (the tree itself), refresh trees and clear current
      if (nodeToDelete.id === currentTree.id) {
        setCurrentTree(null);
        await fetchTrees();
      } else {
        await reloadTree();
      }
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
      await reloadTree();
    } catch {
      toast.error("Erreur lors du deplacement");
    } finally {
      setMoving(false);
    }
  };

  // Drag and drop handler
  const handleDrop = useCallback(
    async (targetId: string) => {
      const movedId = draggedId;
      setDraggedId(null);
      if (!movedId || movedId === targetId || !currentTree) {
        console.warn(
          "[DnD] skip: movedId=",
          movedId,
          "targetId=",
          targetId,
          "same=",
          movedId === targetId,
        );
        return;
      }
      // Prevent dropping on own descendant
      const isDescendant = (parentId: string, checkId: string): boolean => {
        const children = nodes.filter((n) => n.parent_id === parentId);
        return children.some(
          (c) => c.id === checkId || isDescendant(c.id, checkId),
        );
      };
      if (isDescendant(movedId, targetId)) {
        toast.error(
          "Impossible de deplacer un noeud dans un de ses descendants",
        );
        return;
      }
      // Check not dropping on current parent (no-op)
      const movedNode = nodes.find((n) => n.id === movedId);
      if (movedNode?.parent_id === targetId) {
        console.warn("[DnD] skip: already under this parent");
        return;
      }
      console.warn(
        "[DnD] moving",
        movedNode?.name,
        "→",
        nodes.find((n) => n.id === targetId)?.name,
      );
      try {
        await orgApi.nodes.move(movedId, targetId);
        const targetNode = nodes.find((n) => n.id === targetId);
        toast.success(
          `"${movedNode?.name}" deplace sous "${targetNode?.name}"`,
        );
        await reloadTree();
      } catch (err) {
        console.error("[DnD] move failed:", err);
        toast.error("Erreur lors du deplacement");
      }
    },
    [draggedId, currentTree, nodes, reloadTree],
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
        const parentNameMap = new Map(nodes.map((n) => [n.id, n.name]));
        const rows = nodes.map((n) =>
          [
            `"${n.name}"`,
            n.node_type,
            n.parent_id ? `"${parentNameMap.get(n.parent_id) ?? ""}"` : "",
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

  // Filtered persons for tree creation decision maker
  const treeCreationFilteredPersons = useMemo(() => {
    if (!newTreePersonSearch) return persons;
    const q = newTreePersonSearch.toLowerCase();
    return persons.filter(
      (p) =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q),
    );
  }, [persons, newTreePersonSearch]);

  // Breadcrumb for focus mode
  const focusBreadcrumb = useMemo(() => {
    if (!selectedNode) return [];
    const ancestors = getAncestorNames(selectedNode.id, nodes);
    return [...ancestors, selectedNode.name];
  }, [selectedNode, nodes]);

  // Nav tab icons
  const navTabs: Array<{
    key: "tree" | "groups" | "sites";
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      key: "tree",
      label: "Arbre",
      icon: <FolderTree className="h-3.5 w-3.5" />,
    },
    {
      key: "groups",
      label: "Groupes",
      icon: <Network className="h-3.5 w-3.5" />,
    },
    { key: "sites", label: "Sites", icon: <MapPin className="h-3.5 w-3.5" /> },
  ];

  return (
    <AppLayout>
      <div
        className={cn(
          "flex flex-col -m-4 md:-m-6 overflow-hidden",
          "h-[calc(100vh-5rem)]",
        )}
      >
        {/* ================================================================ */}
        {/* Header */}
        {/* ================================================================ */}
        {!focusMode && (
          <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <PageHeader
              title="Structure organisationnelle"
              description="Gerez la hierarchie interne, les clients et les fournisseurs"
              icon={<Building2 className="h-5 w-5" />}
              actions={
                <div className="flex items-center gap-2">
                  {currentTree && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleDeleteTree}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Supprimer l&apos;arbre
                    </Button>
                  )}
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
                  const treeCfg = TREE_TYPE_CONFIG[tree.tree_type as TreeType];
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
                      <span className={treeCfg?.color}>{treeCfg?.icon}</span>
                      <span>{tree.name}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1 py-0 ml-1"
                      >
                        {treeCfg?.label ?? tree.tree_type}
                      </Badge>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* Focus mode breadcrumb bar */}
        {/* ================================================================ */}
        {focusMode && freshSelectedNode && (
          <div className="px-4 py-2.5 border-b border-border bg-card shrink-0 flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 h-8"
              onClick={handleExitFocusMode}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour
            </Button>
            <div className="flex items-center gap-1 text-sm text-muted-foreground overflow-hidden">
              {focusBreadcrumb.map((name, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                  <span
                    className={cn(
                      "truncate",
                      idx === focusBreadcrumb.length - 1 &&
                        "text-foreground font-semibold",
                    )}
                  >
                    {name}
                  </span>
                </React.Fragment>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 h-8 ml-auto"
              onClick={handleExitFocusMode}
            >
              <Minimize2 className="h-4 w-4 mr-1" />
              Quitter le focus
            </Button>
          </div>
        )}

        {/* ================================================================ */}
        {/* Main content area */}
        {/* ================================================================ */}
        {currentTree ? (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* == Center panel: view content == */}
            {!focusMode && (
              <div className="flex-1 flex flex-col min-w-0">
                {/* Stats bar */}
                <StatsBar
                  nodeCount={nodes.length}
                  personCount={persons.length}
                  policyCount={policies.length}
                  siteCount={sites.length}
                />

                {/* Toolbar */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card shrink-0 flex-wrap">
                  {/* Nav tabs: Arbre / Groupes / Sites */}
                  <div className="flex items-center bg-muted rounded-lg p-0.5">
                    {navTabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveNavTab(tab.key)}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                          activeNavTab === tab.key
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* View mode tabs — only when on tree tab */}
                  {activeNavTab === "tree" && (
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
                  )}

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
                      {Object.entries(nodeTypesByTree).map(
                        ([type, typeCfg]) => (
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
                              className={cn(
                                "text-xs font-medium mr-2",
                                typeCfg.color,
                              )}
                            >
                              {typeCfg.label}
                            </span>
                          </DropdownMenuItem>
                        ),
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Focus mode button */}
                  {selectedNode && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => {
                        setFocusMode(true);
                        setDetailOpen(true);
                      }}
                    >
                      <Maximize2 className="h-4 w-4 mr-1" />
                      Focus
                    </Button>
                  )}

                  {/* Export / Print */}
                  <div className="ml-auto flex items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                        >
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
                  {activeNavTab === "groups" ? (
                    <GroupsNav
                      groups={groups}
                      loading={groupsLoading}
                      selectedGroupId={selectedGroupId}
                      onSelectGroup={(g) => setSelectedGroupId(g.id)}
                    />
                  ) : activeNavTab === "sites" ? (
                    <SitesNav
                      sites={sites}
                      loading={sitesLoading}
                      selectedSiteId={selectedSiteId}
                      onSelectSite={(s) => setSelectedSiteId(s.id)}
                    />
                  ) : nodesLoading ? (
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
                    /* Tree view */
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
                          onDoubleClick={handleDoubleClickNode}
                          boardMap={boardMap}
                        />
                      ))}
                    </div>
                  ) : viewMode === "orgchart" ? (
                    /* Org chart view */
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
                            boardMap={boardMap}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* List view */
                    <ListView
                      nodes={nodes}
                      selectedId={selectedNode?.id ?? null}
                      onSelect={handleSelectNode}
                      searchQuery={searchQuery}
                    />
                  )}
                </div>
              </div>
            )}

            {/* == Detail panel (right, or full-width in focus mode) == */}
            {focusMode ? (
              <div className="flex-1 bg-card overflow-hidden">
                <DetailPanel
                  node={freshSelectedNode}
                  allNodes={nodes}
                  tree={currentTree}
                  onClose={handleCloseDetail}
                  onNodeUpdated={reloadTree}
                  onAddChild={openAddNodeDialog}
                  onDeleteNode={openDeleteDialog}
                  onMoveNode={openMoveDialog}
                  focusMode={true}
                  allPolicies={policies}
                  persons={persons}
                />
              </div>
            ) : detailOpen ? (
              <div
                className={cn(
                  "w-full lg:w-[40%] border-t lg:border-t-0 border-border bg-card shrink-0 overflow-hidden",
                  rightPanelOpen ? "lg:max-w-[360px]" : "lg:max-w-[480px]",
                )}
              >
                <DetailPanel
                  node={freshSelectedNode}
                  allNodes={nodes}
                  tree={currentTree}
                  onClose={handleCloseDetail}
                  onNodeUpdated={reloadTree}
                  onAddChild={openAddNodeDialog}
                  onDeleteNode={openDeleteDialog}
                  onMoveNode={openMoveDialog}
                  focusMode={false}
                  allPolicies={policies}
                  persons={persons}
                />
              </div>
            ) : (
              !focusMode && (
                <div className="hidden lg:flex w-[320px] shrink-0 items-center justify-center text-muted-foreground text-sm p-8 text-center">
                  <div>
                    <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Selectionnez un noeud</p>
                    <p className="text-xs mt-1">
                      pour voir et modifier ses details
                    </p>
                  </div>
                </div>
              )
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

      {/* ================================================================ */}
      {/* Dialogs */}
      {/* ================================================================ */}

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
                ).map(([type, treeCfg]) => (
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
                    <span className={treeCfg.color}>{treeCfg.icon}</span>
                    <span>{treeCfg.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                <Star className="h-3.5 w-3.5 inline mr-1 text-amber-500" />
                Directeur General / Decideur *
              </Label>
              <Input
                value={newTreePersonSearch}
                onChange={(e) => setNewTreePersonSearch(e.target.value)}
                placeholder="Rechercher par nom, prenom ou email..."
              />
              <Select
                value={newTreeDecisionMakerId}
                onValueChange={setNewTreeDecisionMakerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir le decideur..." />
                </SelectTrigger>
                <SelectContent>
                  {treeCreationFilteredPersons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                      {p.email ? ` (${p.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Cette personne sera ajoutee comme president et decideur final du
                board de gouvernance.
              </p>
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
              disabled={
                creatingTree || !newTreeName.trim() || !newTreeDecisionMakerId
              }
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
                  {Object.entries(nodeTypesByTree).map(([type, typeCfg]) => (
                    <SelectItem key={type} value={type}>
                      <span className={cn("font-medium", typeCfg.color)}>
                        {typeCfg.label}
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
