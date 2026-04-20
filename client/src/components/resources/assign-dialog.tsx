"use client";

/**
 * SO9 — Dialog pour ajouter un assignment à une ressource.
 *
 * Usage :
 * ```tsx
 * <AssignDialog
 *   resourceId={resource.id}
 *   onClose={() => setOpen(false)}
 *   onCreated={(a) => refresh()}
 * />
 * ```
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { orgApi } from "@/lib/api/org";
import type {
  AssignmentRole,
  AssignmentSubjectType,
  ResourceAssignment,
} from "@/types/org";

const SUBJECT_LABELS: Record<AssignmentSubjectType, string> = {
  person: "Personne",
  node: "Noeud organisationnel",
  group: "Groupe",
  site: "Site",
};

const ROLE_LABELS: Record<AssignmentRole, string> = {
  owner: "Owner (responsable)",
  primary_user: "Primary user (utilisateur principal)",
  secondary_user: "Secondary user",
  caretaker: "Caretaker (maintenance/logistique)",
  maintainer: "Maintainer (mises à jour techniques)",
};

interface AssignDialogProps {
  resourceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (a: ResourceAssignment) => void;
}

export function AssignDialog({
  resourceId,
  open,
  onOpenChange,
  onCreated,
}: AssignDialogProps) {
  const [subjectType, setSubjectType] =
    useState<AssignmentSubjectType>("person");
  const [subjectId, setSubjectId] = useState("");
  const [role, setRole] = useState<AssignmentRole>("owner");
  const [isPrimary, setIsPrimary] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setSubjectType("person");
    setSubjectId("");
    setRole("owner");
    setIsPrimary(false);
    setStartAt("");
    setEndAt("");
    setReason("");
  };

  const submit = async () => {
    if (!subjectId.trim()) {
      toast.error("UUID du sujet requis");
      return;
    }
    try {
      setSaving(true);
      const res = await orgApi.resources.assignments.create(resourceId, {
        subject_type: subjectType,
        subject_id: subjectId.trim(),
        role,
        is_primary: isPrimary,
        start_at: startAt ? new Date(startAt).toISOString() : undefined,
        end_at: endAt ? new Date(endAt).toISOString() : undefined,
        reason: reason.trim() || undefined,
      });
      toast.success("Assignment créé");
      onCreated?.(res.data);
      reset();
      onOpenChange(false);
    } catch (e) {
      const err = e as {
        response?: { data?: { detail?: string } };
        message?: string;
      };
      toast.error(
        err.response?.data?.detail ?? err.message ?? "Erreur création",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assigner la ressource</DialogTitle>
          <DialogDescription>
            Ajoute un rôle pour un sujet (personne, noeud, groupe ou site).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type de sujet</Label>
              <Select
                value={subjectType}
                onValueChange={(v) =>
                  setSubjectType(v as AssignmentSubjectType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SUBJECT_LABELS) as AssignmentSubjectType[]).map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {SUBJECT_LABELS[s]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rôle</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as AssignmentRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as AssignmentRole[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>UUID du sujet</Label>
            <Input
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="is-primary"
              checked={isPrimary}
              onCheckedChange={setIsPrimary}
            />
            <Label htmlFor="is-primary">
              Marquer comme primaire (1 seul par ressource)
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Début</Label>
              <Input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div>
              <Label>Fin (optionnel)</Label>
              <Input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Raison</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Transfert, remplacement, congé, …"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Création…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
