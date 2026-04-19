"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { orgApi } from "@/lib/api/org";
import type {
  OrgPositionWithOccupancy,
  OrgPositionIncumbent,
  Person,
} from "@/types/org";
import { toast } from "sonner";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { personFullName, avatarTint, personInitials } from "./avatar-helpers";
import { CreatePositionDialog } from "./dialogs/create-position-dialog";
import { FillPositionDialog } from "./dialogs/fill-position-dialog";

export interface PositionsTabProps {
  nodeId: string;
  personsById: Record<string, Person>;
  readOnly?: boolean;
}

/** Panel "Postes" d'un node — liste positions + incumbents + flux CRUD. */
export function PositionsTab({
  nodeId,
  personsById,
  readOnly = false,
}: PositionsTabProps) {
  const [positions, setPositions] = useState<OrgPositionWithOccupancy[]>([]);
  const [incumbentsByPos, setIncumbentsByPos] = useState<
    Record<string, OrgPositionIncumbent[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [fillDialogPos, setFillDialogPos] =
    useState<OrgPositionWithOccupancy | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orgApi.positions.list({ node_id: nodeId });
      const list = Array.isArray(res.data) ? res.data : [];
      setPositions(list);
      // Load incumbents in parallel.
      const pairs = await Promise.all(
        list.map(async (p) => {
          try {
            const r = await orgApi.positions.listIncumbents(p.id);
            return { id: p.id, incumbents: r.data ?? [] };
          } catch {
            return { id: p.id, incumbents: [] as OrgPositionIncumbent[] };
          }
        }),
      );
      const map: Record<string, OrgPositionIncumbent[]> = {};
      for (const pair of pairs) map[pair.id] = pair.incumbents;
      setIncumbentsByPos(map);
    } catch (err) {
      toast.error(
        `Impossible de charger les postes: ${(err as Error).message}`,
      );
      setPositions([]);
      setIncumbentsByPos({});
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    fetchAll().catch(() => {});
  }, [fetchAll]);

  const totalFilled = useMemo(
    () => positions.reduce((s, p) => s + p.filled, 0),
    [positions],
  );
  const totalVacant = useMemo(
    () => positions.reduce((s, p) => s + p.vacant, 0),
    [positions],
  );

  const handleDeletePosition = useCallback(
    async (id: string) => {
      if (readOnly) return;
      if (!confirm("Supprimer ce poste et tous ses incumbents ?")) return;
      try {
        await orgApi.positions.delete(id);
        toast.success("Poste supprimé");
        await fetchAll();
      } catch (err) {
        toast.error(`Erreur: ${(err as Error).message}`);
      }
    },
    [readOnly, fetchAll],
  );

  const handleRevokeIncumbent = useCallback(
    async (positionId: string, incumbentId: string) => {
      if (readOnly) return;
      if (!confirm("Retirer cette personne du poste ?")) return;
      try {
        await orgApi.positions.revokeIncumbent(positionId, incumbentId);
        toast.success("Incumbent retiré");
        await fetchAll();
      } catch (err) {
        toast.error(`Erreur: ${(err as Error).message}`);
      }
    },
    [readOnly, fetchAll],
  );

  return (
    <div className="space-y-3" data-testid="positions-tab">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {positions.length} poste{positions.length > 1 ? "s" : ""} ·{" "}
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            {totalFilled} pourvu{totalFilled > 1 ? "s" : ""}
          </span>{" "}
          ·{" "}
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {totalVacant} vacant{totalVacant > 1 ? "s" : ""}
          </span>
        </div>
        <Button
          size="sm"
          disabled={readOnly}
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Nouveau poste
        </Button>
      </div>

      {loading && (
        <div className="text-xs text-muted-foreground">
          Chargement des postes...
        </div>
      )}

      {!loading && positions.length === 0 && (
        <div className="text-sm text-muted-foreground italic py-6 text-center">
          Aucun poste défini sur ce noeud.
        </div>
      )}

      {positions.map((p) => {
        const activeIncumbents = (incumbentsByPos[p.id] ?? []).filter(
          (i) => i.active,
        );
        return (
          <div
            key={p.id}
            className="border border-border rounded-lg p-3 bg-card"
            data-testid="position-card"
            data-position-id={p.id}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{p.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {p.filled}/{p.head_count}
                  </span>{" "}
                  pourvu{p.filled > 1 ? "s" : ""}
                  {p.vacant > 0 && (
                    <>
                      {" · "}
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400 ml-1"
                      >
                        {p.vacant} ouvert{p.vacant > 1 ? "s" : ""}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {p.vacant > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={readOnly}
                    onClick={() => setFillDialogPos(p)}
                    title="Pourvoir le poste"
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Pourvoir
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={readOnly}
                  onClick={() => handleDeletePosition(p.id)}
                  title="Supprimer le poste"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {activeIncumbents.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-2">
                {activeIncumbents.map((inc) => {
                  const person = personsById[inc.person_id];
                  return (
                    <div
                      key={inc.id}
                      className="flex items-center gap-2 bg-muted rounded-full pr-2 py-0.5"
                    >
                      <div
                        className={cn(
                          "size-6 rounded-full flex items-center justify-center text-[10px] font-semibold",
                          avatarTint(inc.person_id),
                        )}
                      >
                        {personInitials(person)}
                      </div>
                      <span className="text-xs">{personFullName(person)}</span>
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => handleRevokeIncumbent(p.id, inc.id)}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                        title="Retirer du poste"
                        aria-label="Retirer du poste"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <CreatePositionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        nodeId={nodeId}
        onCreated={() => {
          void fetchAll();
        }}
      />

      <FillPositionDialog
        position={fillDialogPos}
        onClose={() => setFillDialogPos(null)}
        persons={Object.values(personsById)}
        onFilled={() => {
          void fetchAll();
        }}
      />
    </div>
  );
}
