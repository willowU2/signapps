"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { getNodeTypeConfig } from "../tab-config";

// =============================================================================
// MoveNodeDialog
// =============================================================================

export interface MoveNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeToMove: OrgNode | null;
  moveTargetId: string;
  onMoveTargetIdChange: (v: string) => void;
  moveTargets: OrgNode[];
  moving: boolean;
  onConfirm: () => void;
}

export function MoveNodeDialog({
  open,
  onOpenChange,
  nodeToMove,
  moveTargetId,
  onMoveTargetIdChange,
  moveTargets,
  moving,
  onConfirm,
}: MoveNodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deplacer &laquo;{nodeToMove?.name}&raquo;</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nouveau parent</Label>
            <Select value={moveTargetId} onValueChange={onMoveTargetIdChange}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={onConfirm} disabled={moving || !moveTargetId}>
            {moving ? "Deplacement..." : "Deplacer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
