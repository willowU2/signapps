"use client";

import React, { useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { orgApi } from "@/lib/api/org";
import type { Person, OrgDelegationScope } from "@/types/org";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { personFullName, avatarTint, personInitials } from "../avatar-helpers";

export interface DelegationDialogProps {
  delegator: Person | null;
  onClose: () => void;
  persons: Person[];
  onCreated: () => void;
}

const SCOPE_DEFS: Array<{
  value: OrgDelegationScope;
  label: string;
  description: string;
}> = [
  {
    value: "manager",
    label: "Manager",
    description: "Reprendre les responsabilités hiérarchiques.",
  },
  {
    value: "rbac",
    label: "RBAC",
    description: "Transférer les permissions applicatives.",
  },
  {
    value: "all",
    label: "Tout",
    description: "Manager + RBAC.",
  },
];

export function DelegationDialog({
  delegator,
  onClose,
  persons,
  onCreated,
}: DelegationDialogProps) {
  const open = delegator !== null;
  const [search, setSearch] = useState("");
  const [delegateId, setDelegateId] = useState<string | null>(null);
  const [scope, setScope] = useState<OrgDelegationScope>("manager");
  const [startAt, setStartAt] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );
  const [endAt, setEndAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = persons.filter((p) => p.id !== delegator?.id);
    if (!q) return filtered.slice(0, 40);
    return filtered
      .filter((p) => {
        const name = personFullName(p).toLowerCase();
        const email = (p.email ?? "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 40);
  }, [persons, search, delegator]);

  const reset = () => {
    setSearch("");
    setDelegateId(null);
    setScope("manager");
    setReason("");
  };

  const handleSubmit = async () => {
    if (!delegator || !delegateId) return;
    const startISO = new Date(startAt).toISOString();
    const endISO = new Date(endAt).toISOString();
    if (!(new Date(startAt).getTime() < new Date(endAt).getTime())) {
      toast.error(
        "La date de fin doit être strictement après la date de début",
      );
      return;
    }
    setSaving(true);
    try {
      await orgApi.delegationsV2.create({
        delegator_person_id: delegator.id,
        delegate_person_id: delegateId,
        scope,
        start_at: startISO,
        end_at: endISO,
        reason: reason.trim() || undefined,
      });
      toast.success("Délégation créée");
      reset();
      onClose();
      onCreated();
    } catch (err) {
      toast.error(`Erreur: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          reset();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Déléguer les responsabilités</DialogTitle>
          <DialogDescription>
            {delegator
              ? `${personFullName(delegator)} délègue à une autre personne pour une durée limitée.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="deleg-search">Délégataire</Label>
            <Input
              id="deleg-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom ou email"
            />
          </div>

          <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
            {candidates.map((p) => {
              const picked = delegateId === p.id;
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setDelegateId(p.id)}
                  className={cn(
                    "w-full flex items-center gap-2 p-2 text-left hover:bg-muted transition-colors",
                    picked && "bg-muted",
                  )}
                >
                  <div
                    className={cn(
                      "size-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                      avatarTint(p.id),
                    )}
                  >
                    {personInitials(p)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {personFullName(p)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.email}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label>Scope</Label>
            <div className="flex flex-wrap gap-2">
              {SCOPE_DEFS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setScope(s.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                    scope === s.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <div className="font-semibold">{s.label}</div>
                  <div className="text-muted-foreground">{s.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="deleg-start">Début</Label>
              <Input
                id="deleg-start"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deleg-end">Fin</Label>
              <Input
                id="deleg-end"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deleg-reason">Raison (optionnel)</Label>
            <Textarea
              id="deleg-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Congés, sabbat, ..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={saving}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!delegateId || saving}
          >
            {saving ? "Création..." : "Déléguer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
