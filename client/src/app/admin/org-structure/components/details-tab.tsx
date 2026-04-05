"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Move, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgNode } from "@/types/org";
import { getNodeTypeConfig } from "./tab-config";

// =============================================================================
// DetailsTab
// =============================================================================

export interface DetailsTabProps {
  node: OrgNode;
  allNodes: OrgNode[];
  name: string;
  code: string;
  description: string;
  saving: boolean;
  onNameChange: (v: string) => void;
  onCodeChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onSave: () => void;
  onAddChild: (node: OrgNode) => void;
  onDeleteNode: (node: OrgNode) => void;
  onMoveNode: (node: OrgNode) => void;
}

export function DetailsTab({
  node,
  allNodes,
  name,
  code,
  description,
  saving,
  onNameChange,
  onCodeChange,
  onDescriptionChange,
  onSave,
  onAddChild,
  onDeleteNode,
  onMoveNode,
}: DetailsTabProps) {
  const childNodes = allNodes
    .filter((n) => n.parent_id === node.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="p-4 space-y-4 mt-0">
      <div className="space-y-2">
        <Label htmlFor="detail-name">Nom</Label>
        <Input
          id="detail-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Nom du noeud"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="detail-code">Code</Label>
        <Input
          id="detail-code"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          placeholder="Ex: DRH, IT, SALES"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="detail-desc">Description</Label>
        <Textarea
          id="detail-desc"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Description optionnelle..."
          rows={3}
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving} size="sm">
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
          <Button variant="outline" size="sm" onClick={() => onMoveNode(node)}>
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

      {/* Child nodes */}
      <div className="border-t border-border pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Sous-noeuds ({childNodes.length})
          </p>
          <Button size="sm" variant="outline" onClick={() => onAddChild(node)}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>
        {childNodes.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm border border-dashed rounded-lg">
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
      </div>
    </div>
  );
}
