"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Building2, Plus, Trash2, Users, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgTree, TreeType } from "@/types/org";

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

export interface OrgTreeHeaderProps {
  trees: OrgTree[];
  treesLoading: boolean;
  currentTree: OrgTree | null;
  onSelectTree: (tree: OrgTree) => void;
  onCreateTree: () => void;
  onDeleteTree: () => void;
}

export function OrgTreeHeader({
  trees,
  treesLoading,
  currentTree,
  onSelectTree,
  onCreateTree,
  onDeleteTree,
}: OrgTreeHeaderProps) {
  return (
    <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
      <PageHeader
        title="Structure organisationnelle"
        description="Gerez la hierarchie interne, les clients et les fournisseurs"
        icon={<Building2 className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            {currentTree && (
              <Button size="sm" variant="destructive" onClick={onDeleteTree}>
                <Trash2 className="h-4 w-4 mr-1" />
                Supprimer l&apos;arbre
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onCreateTree}>
              <Plus className="h-4 w-4 mr-1" />
              Nouvel arbre
            </Button>
          </div>
        }
      />

      {/* Tree type switcher */}
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        {treesLoading ? (
          <span className="text-sm text-muted-foreground">Chargement...</span>
        ) : trees.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            Aucun arbre — cliquez sur &laquo;Nouvel arbre&raquo; pour commencer
          </span>
        ) : (
          trees.map((tree) => {
            const treeCfg = TREE_TYPE_CONFIG[tree.tree_type as TreeType];
            const isActive = currentTree?.id === tree.id;
            return (
              <button
                key={tree.id}
                onClick={() => onSelectTree(tree)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                  isActive
                    ? "bg-accent text-accent-foreground border-accent-foreground/20"
                    : "bg-card hover:bg-muted border-border text-muted-foreground",
                )}
              >
                <span className={treeCfg?.color}>{treeCfg?.icon}</span>
                <span>{tree.name}</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">
                  {treeCfg?.label ?? tree.tree_type}
                </Badge>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
