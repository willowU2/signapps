'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useState, useCallback, useEffect } from 'react';
import { ChevronRight, ChevronDown, MoreHorizontal, Plus, Edit, Trash2, Users, Building2, MapPin, Briefcase, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { orgNodesApi } from '@/lib/api/workforce';
import type { OrgNodeWithStats } from '@/types/workforce';

// Icon mapping for node types
const NODE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  company: Building2,
  region: MapPin,
  department: Briefcase,
  team: Users,
  position: UserCircle,
};

interface OrgTreeListProps {
  selectedNodeId?: string;
  onSelectNode?: (node: OrgNodeWithStats) => void;
  onAddNode?: (parentId?: string) => void;
  onEditNode?: (node: OrgNodeWithStats) => void;
  onDeleteNode?: (node: OrgNodeWithStats) => void;
  showEmployeeCounts?: boolean;
  showInactive?: boolean;
  maxDepth?: number;
  className?: string;
}

interface TreeNodeState {
  node: OrgNodeWithStats;
  expanded: boolean;
  loading: boolean;
  children: TreeNodeState[];
}

export function OrgTreeList({
  selectedNodeId,
  onSelectNode,
  onAddNode,
  onEditNode,
  onDeleteNode,
  showEmployeeCounts = true,
  showInactive = false,
  maxDepth,
  className,
}: OrgTreeListProps) {
  const [tree, setTree] = useState<TreeNodeState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load root nodes
  const loadTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await orgNodesApi.getTree({
        include_inactive: showInactive,
        max_depth: maxDepth,
      });
      const nodes = response.data;
      setTree(
        nodes.map((node) => ({
          node,
          expanded: false,
          loading: false,
          children: (node.children || []).map((child) => ({
            node: child,
            expanded: false,
            loading: false,
            children: [],
          })),
        }))
      );
    } catch (err) {
      setError('Erreur lors du chargement de l\'arborescence');
      if ((err as any)?.response?.status !== 401 && (err as any)?.response?.status !== 403) {
        console.error('Failed to load org tree:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [showInactive, maxDepth]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // Load children for a node
  const loadChildren = useCallback(async (nodeId: string) => {
    try {
      const response = await orgNodesApi.getChildren(nodeId);
      return response.data;
    } catch (err) {
      console.error('Failed to load children:', err);
      return [];
    }
  }, []);

  // Toggle node expansion
  const toggleNode = useCallback(
    async (nodeId: string) => {
      const updateTree = async (
        nodes: TreeNodeState[]
      ): Promise<TreeNodeState[]> => {
        const result: TreeNodeState[] = [];
        for (const item of nodes) {
          if (item.node.id === nodeId) {
            if (!item.expanded && item.children.length === 0) {
              // Need to load children
              const children = await loadChildren(nodeId);
              result.push({
                ...item,
                expanded: true,
                children: children.map((child) => ({
                  node: child,
                  expanded: false,
                  loading: false,
                  children: [],
                })),
              });
            } else {
              result.push({ ...item, expanded: !item.expanded });
            }
          } else {
            result.push({
              ...item,
              children: await updateTree(item.children),
            });
          }
        }
        return result;
      };

      setTree(await updateTree(tree));
    },
    [tree, loadChildren]
  );

  // Get icon for node type
  const getNodeIcon = (nodeType: string) => {
    const Icon = NODE_TYPE_ICONS[nodeType] || Building2;
    return Icon;
  };

  // Render a single tree node
  const renderNode = (state: TreeNodeState, depth: number = 0) => {
    const { node, expanded, loading: nodeLoading, children } = state;
    const isSelected = selectedNodeId === node.id;
    const hasChildren =
      node.descendant_count > 0 || (node.children && node.children.length > 0);
    const Icon = getNodeIcon(node.node_type);

    return (
      <div key={node.id} className="group">
        <div
          className={cn(
            'flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors',
            'hover:bg-muted/50',
            isSelected && 'bg-primary/10 text-primary',
            !node.is_active && 'opacity-50'
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {/* Expand/collapse button */}
          <button
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted"
            onClick={() => hasChildren && toggleNode(node.id)}
            disabled={!hasChildren}
          >
            {nodeLoading ? (
              <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-3.5 w-3.5  text-muted-foreground" />
            ) : hasChildren ? (
              expanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )
            ) : (
              <span className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Node content (clickable) */}
          <button
            className="flex flex-1 items-center gap-2 overflow-hidden text-left"
            onClick={() => onSelectNode?.(node)}
          >
            <Icon
              className={cn(
                'h-4 w-4 shrink-0',
                node.is_active ? 'text-primary' : 'text-muted-foreground'
              )}
            />
            <span className="truncate text-sm font-medium">{node.name}</span>
            {node.code && (
              <span className="truncate text-xs text-muted-foreground">
                ({node.code})
              </span>
            )}
          </button>

          {/* Badges */}
          <div className="flex items-center gap-1.5">
            {showEmployeeCounts && node.employee_count > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      <Users className="mr-1 h-3 w-3" />
                      {node.employee_count}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {node.employee_count} employé(s) actif(s)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {!node.is_active && (
              <Badge variant="outline" className="h-5 px-1.5 text-xs">
                Inactif
              </Badge>
            )}
          </div>

          {/* Actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onAddNode?.(node.id)}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un enfant
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEditNode?.(node)}>
                <Edit className="mr-2 h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDeleteNode?.(node)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Children */}
        {expanded && children.length > 0 && (
          <div>
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-6 w-6  text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8', className)}>
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={loadTree}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8', className)}>
        <Building2 className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          Aucun noeud d'organisation
        </p>
        {onAddNode && (
          <Button variant="outline" size="sm" className="mt-4" onClick={() => onAddNode()}>
            <Plus className="mr-2 h-4 w-4" />
            Créer le premier noeud
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-0.5', className)}>
      {/* Header with add button */}
      {onAddNode && (
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-xs font-medium uppercase text-muted-foreground">
            Organisation
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAddNode()}>
            <Plus className="h-4 w-4" />
            <span className="sr-only">Ajouter un noeud racine</span>
          </Button>
        </div>
      )}

      {/* Tree */}
      {tree.map((state) => renderNode(state, 0))}
    </div>
  );
}

// Export sub-components and types for flexibility
export type { OrgTreeListProps, TreeNodeState };
