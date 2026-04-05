"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Building2, Users, Briefcase, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TreeType, Person } from "@/types/org";

// =============================================================================
// TREE_TYPE_CONFIG (local copy — avoids importing from page.tsx)
// =============================================================================

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

// =============================================================================
// CreateTreeDialog
// =============================================================================

export interface CreateTreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newTreeName: string;
  onNewTreeNameChange: (v: string) => void;
  newTreeType: TreeType;
  onNewTreeTypeChange: (v: TreeType) => void;
  newTreePersonSearch: string;
  onNewTreePersonSearchChange: (v: string) => void;
  newTreeDecisionMakerId: string;
  onNewTreeDecisionMakerIdChange: (v: string) => void;
  filteredPersons: Person[];
  creatingTree: boolean;
  onConfirm: () => void;
}

export function CreateTreeDialog({
  open,
  onOpenChange,
  newTreeName,
  onNewTreeNameChange,
  newTreeType,
  onNewTreeTypeChange,
  newTreePersonSearch,
  onNewTreePersonSearchChange,
  newTreeDecisionMakerId,
  onNewTreeDecisionMakerIdChange,
  filteredPersons,
  creatingTree,
  onConfirm,
}: CreateTreeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onChange={(e) => onNewTreeNameChange(e.target.value)}
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
                  onClick={() => onNewTreeTypeChange(type)}
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
              onChange={(e) => onNewTreePersonSearchChange(e.target.value)}
              placeholder="Rechercher par nom, prenom ou email..."
            />
            <Select
              value={newTreeDecisionMakerId}
              onValueChange={onNewTreeDecisionMakerIdChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir le decideur..." />
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
            <p className="text-xs text-muted-foreground">
              Cette personne sera ajoutee comme president et decideur final du
              board de gouvernance.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={onConfirm}
            disabled={
              creatingTree || !newTreeName.trim() || !newTreeDecisionMakerId
            }
          >
            {creatingTree ? "Creation..." : "Creer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
