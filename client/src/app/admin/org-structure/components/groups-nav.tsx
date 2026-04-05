"use client";

import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgGroup } from "@/types/org";

const GROUP_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  static: { label: "Statique", color: "text-blue-600 dark:text-blue-400" },
  dynamic: { label: "Dynamique", color: "text-green-600 dark:text-green-400" },
  derived: { label: "Derive", color: "text-orange-600 dark:text-orange-400" },
  hybrid: { label: "Hybride", color: "text-purple-600 dark:text-purple-400" },
};

export interface GroupsNavProps {
  groups: OrgGroup[];
  loading: boolean;
  selectedGroupId: string | null;
  onSelectGroup: (group: OrgGroup) => void;
}

export function GroupsNav({
  groups,
  loading,
  selectedGroupId,
  onSelectGroup,
}: GroupsNavProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.description?.toLowerCase().includes(q) ||
        g.group_type.toLowerCase().includes(q),
    );
  }, [groups, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Chargement des groupes...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un groupe..."
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Aucun groupe</p>
          </div>
        ) : (
          filtered.map((group) => {
            const typeInfo = GROUP_TYPE_LABELS[group.group_type] ?? {
              label: group.group_type,
              color: "text-muted-foreground",
            };
            return (
              <div
                key={group.id}
                onClick={() => onSelectGroup(group)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
                  selectedGroupId === group.id
                    ? "bg-primary/10 ring-1 ring-primary/30"
                    : "hover:bg-muted/60",
                )}
              >
                <Network className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{group.name}</p>
                  {group.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {group.description}
                    </p>
                  )}
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] px-1.5 py-0 shrink-0",
                    typeInfo.color,
                  )}
                >
                  {typeInfo.label}
                </Badge>
                {!group.is_active && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1 py-0 shrink-0 text-muted-foreground"
                  >
                    Inactif
                  </Badge>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
