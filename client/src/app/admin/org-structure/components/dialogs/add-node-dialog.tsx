"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { OrgNode } from "@/types/org";
import type { NodeTypeConfig } from "../tab-config";

// =============================================================================
// AddNodeDialog
// =============================================================================

export interface AddNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addNodeParent: OrgNode | null;
  newNodeName: string;
  onNewNodeNameChange: (v: string) => void;
  newNodeType: string;
  onNewNodeTypeChange: (v: string) => void;
  newNodeCode: string;
  onNewNodeCodeChange: (v: string) => void;
  newNodeDescription: string;
  onNewNodeDescriptionChange: (v: string) => void;
  nodeTypesByTree: Record<string, NodeTypeConfig>;
  addingNode: boolean;
  onConfirm: () => void;
}

export function AddNodeDialog({
  open,
  onOpenChange,
  addNodeParent,
  newNodeName,
  onNewNodeNameChange,
  newNodeType,
  onNewNodeTypeChange,
  newNodeCode,
  onNewNodeCodeChange,
  newNodeDescription,
  onNewNodeDescriptionChange,
  nodeTypesByTree,
  addingNode,
  onConfirm,
}: AddNodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onChange={(e) => onNewNodeNameChange(e.target.value)}
              placeholder="Nom du noeud"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select value={newNodeType} onValueChange={onNewNodeTypeChange}>
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
              onChange={(e) => onNewNodeCodeChange(e.target.value)}
              placeholder="Ex: DRH, IT, SALES"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-node-desc">Description</Label>
            <Textarea
              id="add-node-desc"
              value={newNodeDescription}
              onChange={(e) => onNewNodeDescriptionChange(e.target.value)}
              placeholder="Description optionnelle..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={onConfirm}
            disabled={addingNode || !newNodeName.trim() || !newNodeType}
          >
            {addingNode ? "Creation..." : "Creer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
