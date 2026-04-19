/**
 * SO3 — Headcount tab for a node card.
 *
 * Shows filled / positions_sum / target / gap rollup + list of plans
 * with inline edit (target_head_count + target_date + notes).
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  orgApi,
  type OrgHeadcountPlan,
  type OrgHeadcountRollup,
} from "@/lib/api/org";

export interface HeadcountTabProps {
  nodeId: string;
  readOnly?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  on_track: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  understaffed: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  over_plan: "bg-red-500/10 text-red-700 dark:text-red-400",
  no_plan: "bg-muted text-muted-foreground",
};

export function HeadcountTab({ nodeId, readOnly = false }: HeadcountTabProps) {
  const [plans, setPlans] = useState<OrgHeadcountPlan[]>([]);
  const [rollup, setRollup] = useState<OrgHeadcountRollup | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrgHeadcountPlan | null>(null);
  const [target, setTarget] = useState("0");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, rollupRes] = await Promise.all([
        orgApi.headcount.list({ node_id: nodeId }),
        orgApi.headcount.rollup(nodeId),
      ]);
      setPlans(listRes.data?.plans ?? []);
      setRollup(rollupRes.data);
    } catch (err) {
      toast.error(`Chargement headcount: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setTarget("0");
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    setDate(d.toISOString().slice(0, 10));
    setNotes("");
    setDialogOpen(true);
  };

  const openEdit = (p: OrgHeadcountPlan) => {
    setEditing(p);
    setTarget(String(p.target_head_count));
    setDate(p.target_date.slice(0, 10));
    setNotes(p.notes ?? "");
    setDialogOpen(true);
  };

  const onSave = useCallback(async () => {
    const targetHc = Number(target);
    if (!Number.isFinite(targetHc) || targetHc < 0) {
      toast.error("Target doit être un nombre >= 0");
      return;
    }
    if (!date) {
      toast.error("Date requise");
      return;
    }
    try {
      if (editing) {
        await orgApi.headcount.update(editing.id, {
          target_head_count: targetHc,
          target_date: date,
          notes,
        });
        toast.success("Plan mis à jour");
      } else {
        await orgApi.headcount.create({
          node_id: nodeId,
          target_head_count: targetHc,
          target_date: date,
          notes,
        });
        toast.success("Plan créé");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(`Erreur: ${(err as Error).message}`);
    }
  }, [editing, target, date, notes, nodeId, load]);

  const onDelete = useCallback(
    async (id: string) => {
      try {
        await orgApi.headcount.delete(id);
        toast.success("Plan supprimé");
        await load();
      } catch (err) {
        toast.error(`Erreur: ${(err as Error).message}`);
      }
    },
    [load],
  );

  return (
    <div className="space-y-4">
      {/* Rollup summary */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="text-sm font-medium mb-3">Synthèse effectifs</h4>
        {loading && !rollup ? (
          <p className="text-xs text-muted-foreground">Chargement…</p>
        ) : rollup ? (
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Occupés</div>
              <div className="text-2xl font-bold">{rollup.filled}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Sièges</div>
              <div className="text-2xl font-bold">{rollup.positions_sum}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Cible</div>
              <div className="text-2xl font-bold">{rollup.target ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Écart</div>
              <div className="text-2xl font-bold">
                {rollup.gap === null
                  ? "—"
                  : rollup.gap > 0
                    ? `+${rollup.gap}`
                    : rollup.gap}
              </div>
              <Badge
                className={STATUS_COLORS[rollup.status] ?? ""}
                variant="secondary"
              >
                {rollup.status}
              </Badge>
            </div>
          </div>
        ) : null}
      </div>

      {/* Plans list */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">
            Plans d&apos;effectifs ({plans.length})
          </h4>
          {!readOnly ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openNew}>
                  <Plus className="mr-1 size-4" /> Nouveau plan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editing ? "Éditer le plan" : "Nouveau plan"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="target">Effectif cible</Label>
                    <Input
                      id="target"
                      type="number"
                      min={0}
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="date">Date d&apos;atteinte visée</Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button onClick={onSave}>
                    {editing ? "Enregistrer" : "Créer"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>

        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Aucun plan défini.
          </p>
        ) : (
          <ul className="space-y-2">
            {plans.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-background p-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {p.target_head_count} postes
                    </span>
                    <span className="text-xs text-muted-foreground">
                      d&apos;ici le {p.target_date}
                    </span>
                  </div>
                  {p.notes ? (
                    <div className="text-xs text-muted-foreground mt-1">
                      {p.notes}
                    </div>
                  ) : null}
                </div>
                {!readOnly ? (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => openEdit(p)}
                      aria-label="Éditer"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => onDelete(p.id)}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
