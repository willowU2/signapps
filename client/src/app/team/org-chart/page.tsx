'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { usePageTitle } from '@/hooks/use-page-title';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { orgApi } from '@/lib/api/org';
import type { OrgTree, OrgChartNode, TreeType } from '@/types/org';
import {
  ChevronRight,
  ChevronDown,
  Users,
  Building2,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Node type colors ──────────────────────────────────────────────────────────

const NODE_TYPE_COLORS: Record<string, string> = {
  group: 'border-purple-400 bg-purple-50 dark:bg-purple-950/20',
  subsidiary: 'border-blue-400 bg-blue-50 dark:bg-blue-950/20',
  bu: 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/20',
  department: 'border-green-400 bg-green-50 dark:bg-green-950/20',
  service: 'border-teal-400 bg-teal-50 dark:bg-teal-950/20',
  team: 'border-amber-400 bg-amber-50 dark:bg-amber-950/20',
  position: 'border-orange-400 bg-orange-50 dark:bg-orange-950/20',
  client_group: 'border-slate-400 bg-slate-50 dark:bg-slate-950/20',
  client_company: 'border-cyan-400 bg-cyan-50 dark:bg-cyan-950/20',
  supplier_group: 'border-rose-400 bg-rose-50 dark:bg-rose-950/20',
  supplier_company: 'border-pink-400 bg-pink-50 dark:bg-pink-950/20',
};

const NODE_TYPE_LABELS: Record<string, string> = {
  group: 'Groupe', subsidiary: 'Filiale', bu: 'BU',
  department: 'Département', service: 'Service', team: 'Équipe',
  position: 'Poste', client_group: 'Groupe client', client_company: 'Client',
  supplier_group: 'Groupe fournisseur', supplier_company: 'Fournisseur',
};

const TREE_TYPE_LABELS: Record<TreeType, string> = {
  internal: 'Interne',
  clients: 'Clients',
  suppliers: 'Fournisseurs',
};

// ── OrgChart node card ────────────────────────────────────────────────────────

interface OrgCardProps {
  chartNode: OrgChartNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}

function OrgCard({ chartNode, depth, expanded, onToggle }: OrgCardProps) {
  const { node, assignments, children } = chartNode;
  const isExpanded = expanded.has(node.id);
  const hasChildren = children.length > 0;
  const colorClass = NODE_TYPE_COLORS[node.node_type] ?? 'border-border bg-card';
  const isPosition = node.node_type === 'position';

  // Separate filled vs vacant slots (only relevant for position nodes)
  const filledAssignments = assignments.filter((a) => a.person);
  const isVacant = isPosition && filledAssignments.length === 0;

  return (
    <div className={cn('flex flex-col items-center', depth > 0 && 'mt-4')}>
      {/* Card */}
      <div
        className={cn(
          'relative rounded-xl border-2 p-3 min-w-[180px] max-w-[220px] shadow-sm transition-all',
          colorClass,
          hasChildren && 'cursor-pointer hover:shadow-md',
          isVacant && 'border-dashed opacity-70'
        )}
        onClick={() => hasChildren && onToggle(node.id)}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 mb-1 font-medium"
            >
              {NODE_TYPE_LABELS[node.node_type] ?? node.node_type}
            </Badge>
            <p className="text-xs font-semibold leading-tight truncate">
              {node.name}
            </p>
            {node.code && (
              <p className="text-[10px] text-muted-foreground font-mono">{node.code}</p>
            )}
          </div>
          {hasChildren && (
            <span className="text-muted-foreground shrink-0 mt-0.5">
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
          )}
        </div>

        {/* Persons / Vacant */}
        {isPosition ? (
          isVacant ? (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground italic">Poste vacant</span>
            </div>
          ) : (
            <div className="space-y-1">
              {filledAssignments.slice(0, 3).map((a) => (
                <div key={a.id} className="flex items-center gap-1.5">
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarFallback className="text-[8px] font-semibold">
                      {a.person
                        ? `${a.person.first_name[0] ?? ''}${a.person.last_name[0] ?? ''}`.toUpperCase()
                        : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] truncate">
                    {a.person ? `${a.person.first_name} ${a.person.last_name}` : '—'}
                  </span>
                </div>
              ))}
              {filledAssignments.length > 3 && (
                <p className="text-[9px] text-muted-foreground pl-6">
                  +{filledAssignments.length - 3} autres
                </p>
              )}
            </div>
          )
        ) : assignments.length > 0 ? (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{assignments.length} personne(s)</span>
          </div>
        ) : null}

        {/* Child count badge */}
        {hasChildren && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold shadow">
            {children.length}
          </div>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="mt-4 pt-4 border-t border-dashed border-border/60 flex flex-wrap gap-4 justify-center">
          {children.map((child) => (
            <OrgCard
              key={child.node.id}
              chartNode={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrgChartPage() {
  usePageTitle('Organigramme');

  const [trees, setTrees] = useState<OrgTree[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState<string>('');
  const [chartNodes, setChartNodes] = useState<OrgChartNode[]>([]);
  const [currentTree, setCurrentTree] = useState<OrgTree | null>(null);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Load trees
  useEffect(() => {
    orgApi.trees.list()
      .then((res) => {
        const t = res.data ?? [];
        setTrees(t);
        if (t.length > 0) setSelectedTreeId(t[0].id);
      })
      .catch(() => {});
  }, []);

  // Load orgchart when tree or date changes
  const loadChart = useCallback(async () => {
    if (!selectedTreeId) return;
    setLoading(true);
    try {
      const params: { tree_id?: string; date?: string } = { tree_id: selectedTreeId };
      if (date) params.date = date;
      const res = await orgApi.orgchart(params);
      setChartNodes(res.data?.nodes ?? []);
      setCurrentTree(res.data?.tree ?? null);

      // Auto-expand root nodes
      const rootIds = (res.data?.nodes ?? []).map((n) => n.node.id);
      setExpanded(new Set(rootIds.slice(0, 5)));
    } catch {
      setChartNodes([]);
    } finally {
      setLoading(false);
    }
  }, [selectedTreeId, date]);

  useEffect(() => {
    loadChart();
  }, [loadChart]);

  const handleToggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const expandAll = () => {
    const allIds: string[] = [];
    const collect = (nodes: OrgChartNode[]) => {
      nodes.forEach((n) => {
        allIds.push(n.node.id);
        collect(n.children);
      });
    };
    collect(chartNodes);
    setExpanded(new Set(allIds));
  };

  const collapseAll = () => setExpanded(new Set());

  const treeTypeLabel = currentTree ? (TREE_TYPE_LABELS[currentTree.tree_type as TreeType] ?? currentTree.tree_type) : '';

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border shrink-0 bg-background">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Organigramme</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Vue hiérarchique de la structure organisationnelle
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Tree switcher */}
              {trees.length > 0 && (
                <Select value={selectedTreeId} onValueChange={setSelectedTreeId}>
                  <SelectTrigger className="w-48">
                    <Building2 className="h-4 w-4 mr-1 text-muted-foreground" />
                    <SelectValue placeholder="Sélectionner un arbre" />
                  </SelectTrigger>
                  <SelectContent>
                    {trees.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {' '}
                        <span className="text-muted-foreground text-xs">
                          ({TREE_TYPE_LABELS[t.tree_type as TreeType] ?? t.tree_type})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Historical date picker */}
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-40 text-sm"
                  title="Vue historique — laissez vide pour la vue actuelle"
                />
                {date && (
                  <Button size="sm" variant="ghost" onClick={() => setDate('')} className="text-xs px-2">
                    Aujourd'hui
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={expandAll}>Tout déplier</Button>
                <Button size="sm" variant="outline" onClick={collapseAll}>Tout replier</Button>
              </div>
            </div>
          </div>

          {currentTree && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">{treeTypeLabel}</Badge>
              <span className="text-sm text-muted-foreground">{currentTree.name}</span>
              {date && (
                <Badge variant="outline" className="text-xs text-amber-600">
                  Vue au {new Date(date).toLocaleDateString('fr-FR')}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Chart canvas */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Chargement de l'organigramme...
            </div>
          ) : chartNodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
              <Building2 className="h-12 w-12 opacity-20" />
              <p className="text-base">Aucun noeud dans cet organigramme</p>
              {!selectedTreeId && (
                <p className="text-sm">Sélectionnez un arbre organisationnel</p>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-6 justify-center">
              {chartNodes.map((chartNode) => (
                <OrgCard
                  key={chartNode.node.id}
                  chartNode={chartNode}
                  depth={0}
                  expanded={expanded}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
