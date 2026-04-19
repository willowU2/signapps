"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, X } from "lucide-react";
import { orgApi } from "@/lib/api/org";
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
  }, [groupId]);

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
          <p className="text-xs font-medium text-muted-foreground mb-3">
            {resolvedIds.length} membre{resolvedIds.length > 1 ? "s" : ""}{" "}
            résolu{resolvedIds.length > 1 ? "s" : ""}
          </p>
          <div className="space-y-2">
            {resolvedIds.map((id: string) => {
              const p = personsById.get(id);
              return (
                <div
                  key={id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted/50"
                >
                  <span
                    className={`text-[10px] rounded-full w-7 h-7 flex items-center justify-center font-semibold ${avatarTint(id)}`}
                  >
                    {personInitials(p)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">
                      {p ? `${p.first_name} ${p.last_name}` : id.slice(0, 8)}
                    </p>
                    {p?.email && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {p.email}
                      </p>
                    )}
                  </div>
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
    </div>
  );
}
