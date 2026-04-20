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
import type { OrgSiteRecord, Person } from "@/types/org";
import { avatarTint, personFullName, personInitials } from "../avatar-helpers";

export interface AddSitePersonDialogProps {
  site: OrgSiteRecord | null;
  persons: Person[];
  onClose: () => void;
  onAdded: () => void;
}

export function AddSitePersonDialog({
  site,
  persons,
  onClose,
  onAdded,
}: AddSitePersonDialogProps) {
  const [search, setSearch] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [role, setRole] = useState<"primary" | "secondary">("secondary");
  const [saving, setSaving] = useState(false);
  const open = site !== null;

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
    if (!site || !pickedId) return;
    setSaving(true);
    try {
      await orgApi.orgSites.attachPerson(site.id, {
        person_id: pickedId,
        role,
      });
      toast.success(
        role === "primary" ? "Site principal défini" : "Rattachement ajouté",
      );
      setSearch("");
      setPickedId(null);
      setRole("secondary");
      onClose();
      onAdded();
    } catch (err) {
      toast.error(`Erreur : ${(err as Error).message}`);
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
          setRole("secondary");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Rattacher une personne — {site?.name ?? "site"}
          </DialogTitle>
          <DialogDescription>
            Choisissez &laquo;Principal&raquo; pour le site de travail habituel
            (un seul par personne) ou &laquo;Secondaire&raquo; pour un site
            additionnel (ex: déplacements).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={role === "primary" ? "default" : "outline"}
              size="sm"
              onClick={() => setRole("primary")}
            >
              Principal
            </Button>
            <Button
              type="button"
              variant={role === "secondary" ? "default" : "outline"}
              size="sm"
              onClick={() => setRole("secondary")}
            >
              Secondaire
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-site-search">Chercher une personne</Label>
            <Input
              id="add-site-search"
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
            disabled={!pickedId || saving}
          >
            {saving ? "Enregistrement..." : "Rattacher"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
