"use client";

/**
 * Decisions timeline — visible on nodes that carry a board.
 *
 * Affiche un timeline vertical des décisions (proposed/approved/
 * rejected/deferred) avec mini-panneau de votes et bouton "Nouvelle
 * décision". Chaque vote est cast inline depuis la ligne décision.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orgApi } from "@/lib/api/org";
import type {
  OrgBoardDecision,
  OrgBoardVote,
  OrgDecisionStatus,
  OrgVoteKind,
} from "@/lib/api/org";
import type { Person } from "@/types/org";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Gavel,
  MinusCircle,
  Plus,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { NewDecisionDialog } from "./dialogs/new-decision-dialog";
import { personFullName } from "./avatar-helpers";

const STATUS_STYLE: Record<OrgDecisionStatus, { label: string; cls: string }> =
  {
    proposed: {
      label: "Proposée",
      cls: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    },
    approved: {
      label: "Approuvée",
      cls: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    },
    rejected: {
      label: "Rejetée",
      cls: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
    },
    deferred: {
      label: "Reportée",
      cls: "bg-slate-500/20 text-slate-700 dark:text-slate-300",
    },
  };

export interface DecisionsTabProps {
  boardId: string;
  persons: Person[];
  /** Person id of the current user, used as default voter. */
  currentPersonId?: string;
}

export function DecisionsTab({
  boardId,
  persons,
  currentPersonId,
}: DecisionsTabProps) {
  const [decisions, setDecisions] = useState<OrgBoardDecision[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [votesByDecision, setVotesByDecision] = useState<
    Record<string, OrgBoardVote[]>
  >({});
  const [newOpen, setNewOpen] = useState(false);

  const personsById = useMemo(() => {
    const m = new Map<string, Person>();
    for (const p of persons) m.set(p.id, p);
    return m;
  }, [persons]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orgApi.decisions.list(boardId);
      setDecisions(res.data ?? []);
    } catch (e) {
      console.error("decisions list failed", e);
      setDecisions([]);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadVotes = async (decisionId: string) => {
    try {
      const res = await orgApi.decisions.listVotes(decisionId);
      setVotesByDecision((v) => ({ ...v, [decisionId]: res.data ?? [] }));
    } catch (e) {
      console.error("votes load failed", e);
    }
  };

  const toggleOpen = (id: string) => {
    setOpen((o) => {
      const next = { ...o, [id]: !o[id] };
      if (next[id] && !votesByDecision[id]) {
        void loadVotes(id);
      }
      return next;
    });
  };

  const onVote = async (
    decisionId: string,
    vote: OrgVoteKind,
    personId: string,
  ) => {
    try {
      await orgApi.decisions.upsertVote(decisionId, {
        person_id: personId,
        vote,
      });
      await loadVotes(decisionId);
    } catch (e) {
      const err = e as { message?: string };
      toast.error(`Vote failed: ${err.message ?? "unknown"}`);
    }
  };

  const onStatusChange = async (
    decisionId: string,
    status: OrgDecisionStatus,
  ) => {
    try {
      await orgApi.decisions.updateStatus(boardId, decisionId, {
        status,
        decided_by_person_id: currentPersonId,
      });
      await load();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(`Status change failed: ${err.message ?? "unknown"}`);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Décisions</h3>
          <Badge variant="outline" className="text-[10px]">
            {decisions.length}
          </Badge>
        </div>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={() => setNewOpen(true)}
          data-testid="decisions-new-button"
        >
          <Plus className="h-3 w-3 mr-1" />
          Nouvelle décision
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : decisions.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Aucune décision pour ce board.
        </p>
      ) : (
        <ul className="space-y-2">
          {decisions.map((d) => {
            const style = STATUS_STYLE[d.status];
            const votes = votesByDecision[d.id] ?? [];
            const decidedBy = d.decided_by_person_id
              ? personsById.get(d.decided_by_person_id)
              : null;
            const isOpen = open[d.id] ?? false;
            const counts = {
              for: votes.filter((v) => v.vote === "for").length,
              against: votes.filter((v) => v.vote === "against").length,
              abstain: votes.filter((v) => v.vote === "abstain").length,
            };
            return (
              <li
                key={d.id}
                className="border border-border rounded-md bg-card"
                data-testid={`decision-${d.id}`}
              >
                <button
                  type="button"
                  className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-muted/40"
                  onClick={() => toggleOpen(d.id)}
                >
                  <Badge
                    className={cn("text-[10px] mt-0.5 shrink-0", style.cls)}
                  >
                    {style.label}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{d.title}</p>
                    {d.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {d.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(d.created_at).toLocaleDateString()}
                      </span>
                      {d.decided_at && (
                        <span>
                          Décidée le{" "}
                          {new Date(d.decided_at).toLocaleDateString()}
                          {decidedBy && ` par ${personFullName(decidedBy)}`}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3 text-emerald-500" />
                        {counts.for}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsDown className="h-3 w-3 text-rose-500" />
                        {counts.against}
                      </span>
                      <span className="flex items-center gap-1">
                        <MinusCircle className="h-3 w-3 text-slate-400" />
                        {counts.abstain}
                      </span>
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-border px-3 py-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Votes</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">
                          Statut
                        </span>
                        <Select
                          value={d.status}
                          onValueChange={(v) =>
                            onStatusChange(d.id, v as OrgDecisionStatus)
                          }
                        >
                          <SelectTrigger className="h-6 text-xs w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              [
                                "proposed",
                                "approved",
                                "rejected",
                                "deferred",
                              ] as const
                            ).map((s) => (
                              <SelectItem key={s} value={s}>
                                {STATUS_STYLE[s].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {votes.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        Aucun vote pour le moment.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {votes.map((v) => {
                          const voter = personsById.get(v.person_id);
                          const label =
                            v.vote === "for"
                              ? "Pour"
                              : v.vote === "against"
                                ? "Contre"
                                : "Abstention";
                          return (
                            <li
                              key={v.id}
                              className="flex items-center gap-2 text-[11px]"
                            >
                              <span className="font-medium min-w-[110px]">
                                {voter ? personFullName(voter) : v.person_id}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {label}
                              </Badge>
                              {v.rationale && (
                                <span className="text-muted-foreground italic">
                                  "{v.rationale}"
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {currentPersonId && (
                      <div className="flex items-center gap-2 pt-1 border-t border-border">
                        <span className="text-[10px] text-muted-foreground">
                          Votre vote&nbsp;:
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-6 text-[10px]"
                          onClick={() => onVote(d.id, "for", currentPersonId)}
                          data-testid={`vote-for-${d.id}`}
                        >
                          <Check className="h-3 w-3 mr-0.5" />
                          Pour
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-6 text-[10px]"
                          onClick={() =>
                            onVote(d.id, "against", currentPersonId)
                          }
                          data-testid={`vote-against-${d.id}`}
                        >
                          <X className="h-3 w-3 mr-0.5" />
                          Contre
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-6 text-[10px]"
                          onClick={() =>
                            onVote(d.id, "abstain", currentPersonId)
                          }
                          data-testid={`vote-abstain-${d.id}`}
                        >
                          <MinusCircle className="h-3 w-3 mr-0.5" />
                          Abstention
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <NewDecisionDialog
        boardId={boardId}
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={load}
      />
    </div>
  );
}
