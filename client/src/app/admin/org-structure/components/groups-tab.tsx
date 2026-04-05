"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Network } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgGroup } from "@/types/org";

// =============================================================================
// Local constants
// =============================================================================

const GROUP_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  static: { label: "Statique", color: "text-blue-600 dark:text-blue-400" },
  dynamic: { label: "Dynamique", color: "text-green-600 dark:text-green-400" },
  derived: { label: "Derive", color: "text-orange-600 dark:text-orange-400" },
  hybrid: { label: "Hybride", color: "text-purple-600 dark:text-purple-400" },
};

// =============================================================================
// GroupsTab
// =============================================================================

export interface GroupsTabProps {
  groups: OrgGroup[];
}

export function GroupsTab({ groups }: GroupsTabProps) {
  return (
    <div className="p-4 space-y-2">
      <p className="text-sm text-muted-foreground mb-2">
        {groups.length} groupe(s)
      </p>
      {groups.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucun groupe</p>
        </div>
      ) : (
        <div className="space-y-1">
          {groups.map((g) => {
            const typeInfo = GROUP_TYPE_LABELS[g.group_type] ?? {
              label: g.group_type,
              color: "text-muted-foreground",
            };
            return (
              <div
                key={g.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30"
              >
                <Network className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium flex-1 truncate">
                  {g.name}
                </span>
                <Badge
                  variant="secondary"
                  className={cn("text-[10px] px-1.5 py-0", typeInfo.color)}
                >
                  {typeInfo.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
