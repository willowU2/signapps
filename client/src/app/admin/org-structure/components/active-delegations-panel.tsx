"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { orgApi } from "@/lib/api/org";
import type { OrgDelegationV2, Person } from "@/types/org";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, ShieldOff } from "lucide-react";
import { avatarTint, personFullName, personInitials } from "./avatar-helpers";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 60_000;

function hoursUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.round(diff / 3_600_000));
}

export interface ActiveDelegationsPanelProps {
  personsById: Record<string, Person>;
  onChanged?: () => void;
}

/** Sidebar panel listing active delegations across the tenant. */
export function ActiveDelegationsPanel({
  personsById,
  onChanged,
}: ActiveDelegationsPanelProps) {
  const [delegations, setDelegations] = useState<OrgDelegationV2[]>([]);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchActive = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orgApi.delegationsV2.list({ active_only: true });
      setDelegations(Array.isArray(res.data) ? res.data : []);
    } catch {
      setDelegations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActive().catch(() => {});
    const id = setInterval(() => {
      fetchActive().catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchActive]);

  const sorted = useMemo(
    () =>
      [...delegations].sort(
        (a, b) => new Date(a.end_at).getTime() - new Date(b.end_at).getTime(),
      ),
    [delegations],
  );

  const handleRevoke = useCallback(
    async (id: string) => {
      if (!confirm("Révoquer cette délégation ?")) return;
      setRevoking(id);
      try {
        await orgApi.delegationsV2.revoke(id);
        toast.success("Délégation révoquée");
        await fetchActive();
        onChanged?.();
      } catch (err) {
        toast.error(`Erreur: ${(err as Error).message}`);
      } finally {
        setRevoking(null);
      }
    },
    [fetchActive, onChanged],
  );

  return (
    <div
      className="rounded-lg border border-border bg-card p-3 space-y-2"
      data-testid="active-delegations-panel"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Délégations actives
        <Badge variant="outline" className="ml-auto text-[10px]">
          {delegations.length}
        </Badge>
      </div>

      {loading && (
        <div className="text-xs text-muted-foreground">Chargement...</div>
      )}

      {!loading && sorted.length === 0 && (
        <div className="text-xs italic text-muted-foreground py-2">
          Aucune délégation active.
        </div>
      )}

      {sorted.map((d) => {
        const delegator = personsById[d.delegator_person_id];
        const delegate = personsById[d.delegate_person_id];
        return (
          <div
            key={d.id}
            className="rounded-md border border-border/70 bg-muted/40 p-2 space-y-1.5"
            data-delegation-id={d.id}
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "size-6 rounded-full flex items-center justify-center text-[10px] font-semibold",
                  avatarTint(d.delegator_person_id),
                )}
              >
                {personInitials(delegator)}
              </div>
              <span className="text-xs font-medium truncate">
                {personFullName(delegator)}
              </span>
              <span className="text-xs text-muted-foreground">→</span>
              <div
                className={cn(
                  "size-6 rounded-full flex items-center justify-center text-[10px] font-semibold",
                  avatarTint(d.delegate_person_id),
                )}
              >
                {personInitials(delegate)}
              </div>
              <span className="text-xs font-medium truncate">
                {personFullName(delegate)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Badge variant="secondary" className="text-[10px] uppercase">
                {d.scope}
              </Badge>
              <span>Expire dans {hoursUntil(d.end_at)} h</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[10px] ml-auto text-muted-foreground hover:text-destructive"
                onClick={() => handleRevoke(d.id)}
                disabled={revoking === d.id}
                title="Révoquer"
              >
                <ShieldOff className="h-3 w-3 mr-0.5" />
                Révoquer
              </Button>
            </div>
            {d.reason && (
              <div className="text-[11px] italic text-muted-foreground truncate">
                {d.reason}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
