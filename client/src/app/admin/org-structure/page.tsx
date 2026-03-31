'use client';

import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { usePageTitle } from '@/hooks/use-page-title';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OrgTreeEditor } from '@/components/org/org-tree-editor';
import { useOrgStore } from '@/stores/org-store';
import { orgApi } from '@/lib/api/org';
import type { TreeType } from '@/types/org';
import { Building2, Plus, Users, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const TREE_TYPE_CONFIG: Record<TreeType, { label: string; icon: React.ReactNode; color: string }> = {
  internal: {
    label: 'Interne',
    icon: <Building2 className="h-4 w-4" />,
    color: 'text-purple-600',
  },
  clients: {
    label: 'Clients',
    icon: <Users className="h-4 w-4" />,
    color: 'text-cyan-600',
  },
  suppliers: {
    label: 'Fournisseurs',
    icon: <Briefcase className="h-4 w-4" />,
    color: 'text-rose-600',
  },
};

export default function OrgStructurePage() {
  usePageTitle('Structure organisationnelle — Administration');

  const { trees, treesLoading, currentTree, fetchTrees, setCurrentTree } = useOrgStore();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTreeName, setNewTreeName] = useState('');
  const [newTreeType, setNewTreeType] = useState<TreeType>('internal');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchTrees();
  }, [fetchTrees]);

  // Auto-select first tree
  useEffect(() => {
    if (trees.length > 0 && !currentTree) {
      setCurrentTree(trees[0]);
    }
  }, [trees, currentTree, setCurrentTree]);

  const handleCreateTree = async () => {
    if (!newTreeName.trim()) return;
    setCreating(true);
    try {
      const res = await orgApi.trees.create({ tree_type: newTreeType, name: newTreeName.trim() });
      toast.success('Arbre créé');
      setCreateDialogOpen(false);
      setNewTreeName('');
      await fetchTrees();
      setCurrentTree(res.data!);
    } catch {
      toast.error('Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <PageHeader
            title="Structure organisationnelle"
            description="Gérez la hiérarchie interne, les clients et les fournisseurs"
            icon={<Building2 className="h-5 w-5" />}
            actions={
              <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Nouvel arbre
              </Button>
            }
          />

          {/* Tree type switcher */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {treesLoading ? (
              <span className="text-sm text-muted-foreground">Chargement...</span>
            ) : trees.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                Aucun arbre — cliquez sur «Nouvel arbre» pour commencer
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
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                      isActive
                        ? 'bg-accent text-accent-foreground border-accent-foreground/20'
                        : 'bg-card hover:bg-muted border-border text-muted-foreground'
                    )}
                  >
                    <span className={cfg?.color}>{cfg?.icon}</span>
                    <span>{tree.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">
                      {cfg?.label ?? tree.tree_type}
                    </Badge>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Main: tree editor ── */}
        <div className="flex-1 overflow-hidden">
          {currentTree ? (
            <OrgTreeEditor tree={currentTree} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <Building2 className="h-16 w-16 opacity-20" />
              <p className="text-lg font-medium">Sélectionnez un arbre organisationnel</p>
              <p className="text-sm">ou créez-en un nouveau</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Create tree dialog ── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un arbre organisationnel</DialogTitle>
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
              <Label>Type d'arbre</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(TREE_TYPE_CONFIG) as [TreeType, (typeof TREE_TYPE_CONFIG)[TreeType]][]).map(
                  ([type, cfg]) => (
                    <button
                      key={type}
                      onClick={() => setNewTreeType(type)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors',
                        newTreeType === type
                          ? 'bg-accent text-accent-foreground border-accent-foreground/30'
                          : 'bg-card border-border hover:bg-muted'
                      )}
                    >
                      <span className={cfg.color}>{cfg.icon}</span>
                      <span>{cfg.label}</span>
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateTree} disabled={creating || !newTreeName.trim()}>
              {creating ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
