"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { History, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { orgApi } from "@/lib/api/org";
import type { OrgAuditEntry } from "@/types/org";

// =============================================================================
// Local constants
// =============================================================================

const AUDIT_ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: "Creation", color: "text-green-600" },
  update: { label: "Modification", color: "text-blue-600" },
  delete: { label: "Suppression", color: "text-red-600" },
  move: { label: "Deplacement", color: "text-orange-600" },
  assign: { label: "Affectation", color: "text-purple-600" },
  unassign: { label: "Desaffectation", color: "text-pink-600" },
};

// =============================================================================
// AuditTab
// =============================================================================

export interface AuditTabProps {
  entityType: string;
  entityId: string;
}

export function AuditTab({ entityType, entityId }: AuditTabProps) {
  const [entries, setEntries] = useState<OrgAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    orgApi.audit
      .entityHistory(entityType, entityId)
      .then((res) => {
        if (!cancelled) setEntries(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Chargement de l&apos;historique...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-4">
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucun historique</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      <p className="text-sm text-muted-foreground mb-3">
        {entries.length} evenement(s)
      </p>
      <div className="space-y-2">
        {entries.map((entry) => {
          const actionInfo = AUDIT_ACTION_LABELS[entry.action] ?? {
            label: entry.action,
            color: "text-muted-foreground",
          };
          const date = new Date(entry.created_at);
          return (
            <div
              key={entry.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/30"
            >
              <div className="flex flex-col items-center mt-0.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px] px-1.5 py-0", actionInfo.color)}
                  >
                    {actionInfo.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {entry.entity_type}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0">
                    {entry.actor_type}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {date.toLocaleDateString("fr-FR")}{" "}
                  {date.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {entry.actor_id && ` — ${entry.actor_id.slice(0, 8)}...`}
                </p>
                {Object.keys(entry.changes).length > 0 && (
                  <p className="text-xs font-mono mt-1 text-foreground/60 truncate">
                    {JSON.stringify(entry.changes).slice(0, 120)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
