"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { OrgNode } from "@/types/org";

// =============================================================================
// DeleteNodeDialog
// =============================================================================

export interface DeleteNodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeToDelete: OrgNode | null;
  deleting: boolean;
  onConfirm: () => void;
}

export function DeleteNodeDialog({
  open,
  onOpenChange,
  nodeToDelete,
  deleting,
  onConfirm,
}: DeleteNodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting ? "Suppression..." : "Supprimer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
