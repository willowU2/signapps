"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, X, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/org";
import { AddGroupMemberDialog } from "./dialogs/add-group-member-dialog";
import type {
  OrgGroupRecord,
  OrgGroupMembersResponse,
  Person,
} from "@/types/org";
import { avatarTint, personInitials } from "./avatar-helpers";

export interface GroupDetailCardProps {
  groupId: string;
  persons: Person[];
  onClose: () => void;
}

const KIND_LABELS: Record<string, string> = {
  static: "Statique",
  dynamic: "Dynamique",
  hybrid: "Hybride",
  derived: "Dérivé",
};

const KIND_COLORS: Record<string, string> = {
  static: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  dynamic: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  hybrid: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  derived: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

export function GroupDetailCard({
  groupId,
  persons,
  onClose,
}: GroupDetailCardProps) {
  const [group, setGroup] = useState<OrgGroupRecord | null>(null);
  const [members, setMembers] = useState<OrgGroupMembersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = () => setReloadTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      orgApi.orgGroups.get(groupId),
      orgApi.orgGroups.members(groupId),
    ])
      .then(([g, m]) => {
        if (cancelled) return;
        setGroup(g.data);
        setMembers(m.data);
      })
      .catch(() => {
        if (cancelled) return;
        setGroup(null);
        setMembers(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, reloadTick]);

  const handleRemove = async (personId: string) => {
    if (!group) return;
    setRemoving(personId);
    try {
      await orgApi.orgGroups.removeMember(group.id, personId);
      toast.success("Membre retiré");
      reload();
    } catch (err) {
      toast.error(`Erreur : ${(err as Error).message}`);
    } finally {
      setRemoving(null);
    }
  };

  const canEditMembers = group
    ? group.kind === "static" || group.kind === "hybrid"
    : false;

  // Prefer personsById built from resolved members first (freshest data),
  // fall back on the broader persons prop.
  const resolvedPersons = members?.persons ?? [];
  const personsById = new Map<string, Person>();
  for (const p of persons) personsById.set(p.id, p);
  for (const p of resolvedPersons) personsById.set(p.id, p);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Chargement...
      </div>
    );
  }

  if (!group) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Groupe introuvable.
      </div>
    );
  }

  const kindLabel = KIND_LABELS[group.kind] ?? group.kind;
  const kindColor = KIND_COLORS[group.kind] ?? "bg-muted";
  const resolvedIds = resolvedPersons.map((p) => p.id);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between p-4 border-b border-border">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            <h2 className="text-base font-semibold truncate">{group.name}</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-[10px] ${kindColor} border-0`}>
              {kindLabel}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              {group.slug}
            </span>
          </div>
          {group.description && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
              {group.description}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {group.rule_json && (
        <div className="p-3 border-b border-border bg-muted/30">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
            Règle
          </p>
          <pre className="text-[11px] overflow-x-auto">
            {JSON.stringify(group.rule_json, null, 2)}
          </pre>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-muted-foreground">
              {resolvedIds.length} membre{resolvedIds.length > 1 ? "s" : ""}{" "}
              résolu{resolvedIds.length > 1 ? "s" : ""}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setAddOpen(true)}
              title={
                canEditMembers
                  ? "Ajouter un membre"
                  : "Groupe dynamic/derived — membership auto"
              }
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Ajouter
            </Button>
          </div>
          <div className="space-y-2">
            {resolvedIds.map((id: string) => {
              const p = personsById.get(id);
              return (
                <div
                  key={id}
                  className="group flex items-center gap-2 p-2 rounded hover:bg-muted/50"
                >
                  <span
                    className={`text-[10px] rounded-full w-7 h-7 flex items-center justify-center font-semibold ${avatarTint(id)}`}
                  >
                    {personInitials(p)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate font-medium">
                      {p ? `${p.first_name} ${p.last_name}` : `Membre inconnu`}
                    </p>
                    {p?.email && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {p.email}
                      </p>
                    )}
                  </div>
                  {canEditMembers && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(id)}
                      disabled={removing === id}
                      title="Retirer du groupe"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
            {resolvedIds.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Aucun membre résolu pour ce groupe.
              </p>
            )}
          </div>
        </div>
      </div>

      <AddGroupMemberDialog
        group={addOpen ? group : null}
        persons={persons}
        onClose={() => setAddOpen(false)}
        onAdded={reload}
      />
    </div>
  );
}
