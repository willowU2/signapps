"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { orgApi } from "@/lib/api/org";
import { toast } from "sonner";

export interface CreatePositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeId: string;
  onCreated: () => void;
}

export function CreatePositionDialog({
  open,
  onOpenChange,
  nodeId,
  onCreated,
}: CreatePositionDialogProps) {
  const [title, setTitle] = useState("");
  const [headCount, setHeadCount] = useState("1");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setHeadCount("1");
    setDescription("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hc = Number.parseInt(headCount, 10);
    if (!title.trim()) {
      toast.error("Le titre est obligatoire");
      return;
    }
    if (!Number.isFinite(hc) || hc < 0) {
      toast.error("Le nombre de sièges doit être >= 0");
      return;
    }
    setSaving(true);
    try {
      await orgApi.positions.create({
        node_id: nodeId,
        title: title.trim(),
        head_count: hc,
        attributes: description.trim()
          ? { description: description.trim() }
          : {},
      });
      toast.success("Poste créé");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(`Erreur: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau poste</DialogTitle>
          <DialogDescription>
            Crée un siège typé sur ce noeud. Le nombre de sièges (head_count)
            détermine combien de personnes peuvent occuper le poste.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pos-title">Titre</Label>
            <Input
              id="pos-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Senior Platform Engineer"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pos-head-count">Nombre de sièges</Label>
            <Input
              id="pos-head-count"
              type="number"
              min={0}
              value={headCount}
              onChange={(e) => setHeadCount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pos-description">Description (optionnel)</Label>
            <Input
              id="pos-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Responsabilités, prérequis, ..."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
