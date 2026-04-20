"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { orgApi } from "@/lib/api/org";
import type { OrgGroupRecord, Person } from "@/types/org";
import { avatarTint, personFullName, personInitials } from "../avatar-helpers";

export interface AddGroupMemberDialogProps {
  group: OrgGroupRecord | null;
  persons: Person[];
  onClose: () => void;
  onAdded: () => void;
}

export function AddGroupMemberDialog({
  group,
  persons,
  onClose,
  onAdded,
}: AddGroupMemberDialogProps) {
  const [search, setSearch] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [kind, setKind] = useState<"include" | "exclude">("include");
  const [saving, setSaving] = useState(false);
  const open = group !== null;

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
    if (!group || !pickedId) return;
    setSaving(true);
    try {
      await orgApi.orgGroups.addMember(group.id, {
        person_id: pickedId,
        kind,
      });
      toast.success(
        kind === "include" ? "Membre ajouté" : "Exclusion enregistrée",
      );
      setSearch("");
      setPickedId(null);
      setKind("include");
      onClose();
      onAdded();
    } catch (err) {
      toast.error(`Erreur : ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const kindHelp =
    group?.kind === "dynamic"
      ? "Un groupe dynamique est 100% piloté par sa règle — ajouter un membre ici est sans effet."
      : group?.kind === "derived"
        ? "Un groupe dérivé reflète automatiquement un noeud — ajouter un membre ici est sans effet."
        : group?.kind === "hybrid"
          ? "Hybride : choisissez 'Inclure' pour forcer l'appartenance ou 'Exclure' pour retirer une personne qui match la règle."
          : "Statique : la personne sera ajoutée à la liste.";

  const disableWrite = group?.kind === "dynamic" || group?.kind === "derived";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setSearch("");
          setPickedId(null);
          setKind("include");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Ajouter un membre — {group?.name ?? "groupe"}
          </DialogTitle>
          <DialogDescription>{kindHelp}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {group?.kind === "hybrid" && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={kind === "include" ? "default" : "outline"}
                size="sm"
                onClick={() => setKind("include")}
              >
                Inclure
              </Button>
              <Button
                type="button"
                variant={kind === "exclude" ? "default" : "outline"}
                size="sm"
                onClick={() => setKind("exclude")}
              >
                Exclure
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="add-member-search">Chercher une personne</Label>
            <Input
              id="add-member-search"
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
            disabled={!pickedId || saving || disableWrite}
          >
            {saving ? "Enregistrement..." : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
