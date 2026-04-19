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
import { orgApi } from "@/lib/api/org";
import type { OrgPositionWithOccupancy, Person } from "@/types/org";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { personFullName, avatarTint, personInitials } from "../avatar-helpers";

export interface FillPositionDialogProps {
  position: OrgPositionWithOccupancy | null;
  onClose: () => void;
  persons: Person[];
  onFilled: () => void;
}

export function FillPositionDialog({
  position,
  onClose,
  persons,
  onFilled,
}: FillPositionDialogProps) {
  const [search, setSearch] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);

  const open = position !== null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return persons.slice(0, 50);
    return persons
      .filter((p) => {
        const name = personFullName(p).toLowerCase();
        const email = (p.email ?? "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 50);
  }, [persons, search]);

  const handleSubmit = async () => {
    if (!position || !pickedId) return;
    setSaving(true);
    try {
      await orgApi.positions.addIncumbent(position.id, {
        person_id: pickedId,
        start_date: startDate,
      });
      toast.success("Poste pourvu");
      setSearch("");
      setPickedId(null);
      onClose();
      onFilled();
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
          setSearch("");
          setPickedId(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pourvoir un poste</DialogTitle>
          <DialogDescription>
            {position
              ? `${position.title} — ${position.vacant} siège${position.vacant > 1 ? "s" : ""} ouvert${position.vacant > 1 ? "s" : ""}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fill-search">Chercher une personne</Label>
            <Input
              id="fill-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, prénom ou email"
            />
          </div>

          <div className="max-h-56 overflow-y-auto border border-border rounded-lg divide-y divide-border">
            {filtered.length === 0 && (
              <div className="p-3 text-xs text-muted-foreground">
                Aucune personne trouvée.
              </div>
            )}
            {filtered.map((p) => {
              const picked = pickedId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPickedId(p.id)}
                  className={cn(
                    "w-full flex items-center gap-2 p-2 text-left hover:bg-muted transition-colors",
                    picked && "bg-muted",
                  )}
                >
                  <div
                    className={cn(
                      "size-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                      avatarTint(p.id),
                    )}
                  >
                    {personInitials(p)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
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
            <Label htmlFor="fill-start-date">Date de début</Label>
            <Input
              id="fill-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
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
            disabled={!pickedId || saving}
          >
            {saving ? "Création..." : "Pourvoir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
