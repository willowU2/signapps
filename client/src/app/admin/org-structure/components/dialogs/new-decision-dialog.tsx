"use client";

/**
 * Dialog to create a new board decision (SO2 G3.4).
 */

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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/org";

export interface NewDecisionDialogProps {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void | Promise<void>;
}

export function NewDecisionDialog({
  boardId,
  open,
  onOpenChange,
  onCreated,
}: NewDecisionDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Le titre est requis");
      return;
    }
    setSaving(true);
    try {
      await orgApi.decisions.create(boardId, {
        title: title.trim(),
        description: description.trim() || undefined,
      });
      toast.success("Décision créée");
      reset();
      onOpenChange(false);
      await onCreated();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(`Erreur: ${err.message ?? "unknown"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nouvelle décision</DialogTitle>
            <DialogDescription>
              Créer une décision en statut <em>proposée</em>. Les votes pourront
              être cast depuis le timeline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="dec-title">Titre *</Label>
              <Input
                id="dec-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Approuver le plan de recrutement Q2"
                maxLength={255}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dec-description">Description</Label>
              <Textarea
                id="dec-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Motion n°42 — approuver le recrutement de 3 SRE…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
