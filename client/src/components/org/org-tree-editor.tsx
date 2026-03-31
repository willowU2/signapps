'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { orgApi } from '@/lib/api/org';
import { useOrgStore } from '@/stores/org-store';
import { NodeDetailSheet } from './node-detail-sheet';
import type { OrgNode, OrgTree } from '@/types/org';
import {
  Plus,
  ChevronRight,
  ChevronDown,
  Trash2,
  Users,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Node type configuration ──────────────────────────────────────────────────

interface NodeTypeConfig {
  label: string;
  color: string;
  bg: string;
}

const INTERNAL_NODE_TYPES: Record<string, NodeTypeConfig> = {
  group: { label: 'Groupe', color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  subsidiary: { label: 'Filiale', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  bu: { label: 'BU', color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  department: { label: 'Département', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
  service: { label: 'Service', color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-900/30' },
  team: { label: 'Équipe', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  position: { label: 'Poste', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
};

const CLIENT_NODE_TYPES: Record<string, NodeTypeConfig> = {
  client_group: { label: 'Groupe client', color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-900/30' },
  client_company: { label: 'Société cliente', color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
  client_department: { label: 'Département client', color: 'text-sky-600', bg: 'bg-sky-100 dark:bg-sky-900/30' },
};

const SUPPLIER_NODE_TYPES: Record<string, NodeTypeConfig> = {
  supplier_group: { label: 'Groupe fournisseur', color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/30' },
  supplier_company: { label: 'Société fournisseur', color: 'text-pink-600', bg: 'bg-pink-100 dark:bg-pink-900/30' },
  supplier_department: { label: 'Département fournisseur', color: 'text-fuchsia-600', bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30' },
};

function getNodeTypeConfig(type: string): NodeTypeConfig {
  return (
    INTERNAL_NODE_TYPES[type] ??
    CLIENT_NODE_TYPES[type] ??
    SUPPLIER_NODE_TYPES[type] ?? {
      label: type,
      color: 'text-muted-foreground',
      bg: 'bg-muted',
    }
  );
}

function getNodeTypesByTreeType(treeType: string): Record<string, NodeTypeConfig> {
  if (treeType === 'clients') return CLIENT_NODE_TYPES;
  if (treeType === 'suppliers') return SUPPLIER_NODE_TYPES;
  return INTERNAL_NODE_TYPES;
}

// ── Tree node component ──────────────────────────────────────────────────────

interface TreeNodeProps {
  node: OrgNode;
  allNodes: OrgNode[];
  depth: number;
  selectedId: string | null;
  onSelect: (node: OrgNode) => void;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
}

function TreeNodeItem({
  node,
  allNodes,
  depth,
  selectedId,
  onSelect,
  expanded,
  onToggleExpand,
}: TreeNodeProps) {
  const children = allNodes.filter((n) => n.parent_id === node.id);
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const cfg = getNodeTypeConfig(node.node_type);

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group',
          isSelected
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-muted/60'
        )}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => onSelect(node)}
      >
        {/* Expand/collapse toggle */}
        <button
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            children.length === 0 && 'invisible'
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
          className={cn('text-[10px] px-1.5 py-0 shrink-0 font-medium', cfg.color, cfg.bg)}
        >
          {cfg.label}
        </Badge>

        {/* Name */}
        <span className="text-sm font-medium flex-1 truncate">{node.name}</span>

        {/* Code */}
        {node.code && (
          <span className="text-xs text-muted-foreground font-mono shrink-0">{node.code}</span>
        )}

        {/* Person count indicator (placeholder) */}
        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Users className="h-3 w-3" />
          0
        </span>
      </div>

      {isExpanded && children.length > 0 && (
        <div>
          {children
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((child) => (
              <TreeNodeItem
                key={child.id}
                node={child}
                allNodes={allNodes}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                expanded={expanded}
                onToggleExpand={onToggleExpand}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// ── Main OrgTreeEditor ────────────────────────────────────────────────────────

interface OrgTreeEditorProps {
  tree: OrgTree;
}

export function OrgTreeEditor({ tree }: OrgTreeEditorProps) {
  const { nodes, nodesLoading, selectedNode, fetchNodes, selectNode } = useOrgStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [detailOpen, setDetailOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newNodeType, setNewNodeType] = useState('');
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeCode, setNewNodeCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchNodes(tree.id);
  }, [tree.id, fetchNodes]);

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

  const handleToggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
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
    [selectNode]
  );

  const handleAddNode = async () => {
    if (!newNodeName.trim() || !newNodeType) return;
    setAdding(true);
    try {
      await orgApi.nodes.create({
        tree_id: tree.id,
        parent_id: selectedNode?.id,
        node_type: newNodeType,
        name: newNodeName.trim(),
        code: newNodeCode.trim() || undefined,
        sort_order: 0,
        is_active: true,
        config: {},
      });
      toast.success('Noeud créé');
      setAddDialogOpen(false);
      setNewNodeName('');
      setNewNodeCode('');
      setNewNodeType('');
      fetchNodes(tree.id);
    } catch {
      toast.error('Erreur lors de la création');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteNode = async () => {
    if (!selectedNode) return;
    setDeleting(true);
    try {
      await orgApi.nodes.delete(selectedNode.id);
      toast.success('Noeud supprimé');
      selectNode(null);
      setDeleteConfirm(false);
      setDetailOpen(false);
      fetchNodes(tree.id);
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  const nodeTypesByTree = getNodeTypesByTreeType(tree.tree_type);
  const rootNodes = nodes.filter((n) => !n.parent_id).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="flex gap-0 h-full">
      {/* ── Left: Tree ── */}
      <div className="flex-1 flex flex-col border-r border-border">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Ajouter un noeud
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {selectedNode ? `Sous: ${selectedNode.name}` : 'Noeud racine'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.entries(nodeTypesByTree).map(([type, cfg]) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => {
                    setNewNodeType(type);
                    setAddDialogOpen(true);
                  }}
                >
                  <span className={cn('text-xs font-medium mr-2', cfg.color)}>
                    {cfg.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {selectedNode && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Supprimer
            </Button>
          )}

          {selectedNode && (
            <span className="ml-auto text-sm text-muted-foreground truncate max-w-[200px]">
              Sélectionné: {selectedNode.name}
            </span>
          )}
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto p-2">
          {nodesLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Chargement de la structure...
            </div>
          ) : rootNodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
              <Building2 className="h-10 w-10 opacity-30" />
              <p>Aucun noeud dans cet arbre</p>
              <p className="text-xs">Cliquez sur «Ajouter un noeud» pour commencer</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {rootNodes.map((node) => (
                <TreeNodeItem
                  key={node.id}
                  node={node}
                  allNodes={nodes}
                  depth={0}
                  selectedId={selectedNode?.id ?? null}
                  onSelect={handleSelectNode}
                  expanded={expanded}
                  onToggleExpand={handleToggleExpand}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Detail panel (inline when not sheet) ── */}
      {!detailOpen && (
        <div className="w-96 shrink-0 flex items-center justify-center text-muted-foreground text-sm p-8 text-center">
          <div>
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>Sélectionnez un noeud</p>
            <p className="text-xs mt-1">pour voir et modifier ses détails</p>
          </div>
        </div>
      )}

      {/* ── Node detail sheet ── */}
      <NodeDetailSheet
        node={selectedNode}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) selectNode(null);
        }}
        onNodeUpdated={(updated) => {
          selectNode(updated);
          fetchNodes(tree.id);
        }}
      />

      {/* ── Add node dialog ── */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Ajouter {nodeTypesByTree[newNodeType]?.label ?? 'un noeud'}
              {selectedNode ? ` sous "${selectedNode.name}"` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-node-name">Nom *</Label>
              <Input
                id="new-node-name"
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                placeholder="Nom du noeud"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-node-code">Code</Label>
              <Input
                id="new-node-code"
                value={newNodeCode}
                onChange={(e) => setNewNodeCode(e.target.value)}
                placeholder="Ex: DRH, IT, SALES"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddNode} disabled={adding || !newNodeName.trim()}>
              {adding ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm dialog ── */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer «{selectedNode?.name}»?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Cette action supprimera le noeud et tous ses sous-noeuds. Les affectations associées seront également supprimées.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteNode}
              disabled={deleting}
            >
              {deleting ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
