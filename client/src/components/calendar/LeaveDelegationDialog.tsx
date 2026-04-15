"use client";

import React, { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  User,
  Calendar,
  ListTodo,
  Info,
  RefreshCw,
} from "lucide-react";
import { leaveApi } from "@/lib/api/calendar";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DelegationTask {
  id: string;
  title: string;
  type?: "task" | "event" | "shift";
  start_date: string;
  end_date?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  suggested_assignee_id?: string;
  suggested_assignee_name?: string;
}

export interface DelegationColleague {
  id: string;
  name: string;
  department?: string;
  workload?: number; // 0-100 percentage
  avatar?: string;
}

interface TaskAssignment {
  task_id: string;
  assign_to: string;
}

export interface LeaveDelegationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  employeeName?: string;
  leaveStart?: string;
  leaveEnd?: string;
  /** Pre-loaded tasks during leave period */
  tasks?: DelegationTask[];
  /** Available colleagues for reassignment */
  colleagues?: DelegationColleague[];
  onDelegated?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<string, string> = {
  low: "Faible",
  medium: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

const PRIORITY_COLORS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  low: "secondary",
  medium: "default",
  high: "outline",
  urgent: "destructive",
};

const TYPE_LABELS: Record<string, string> = {
  task: "Tâche",
  event: "Événement",
  shift: "Horaire",
};

function WorkloadBar({ value }: { value?: number }) {
  if (value === undefined) return null;
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct < 50 ? "bg-green-500" : pct < 75 ? "bg-yellow-500" : "bg-destructive";

  return (
    <div className="flex items-center gap-1.5 min-w-[80px]">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// (removed mock generator)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function LeaveDelegationDialog({
  open,
  onOpenChange,
  eventId,
  employeeName,
  leaveStart,
  leaveEnd,
  tasks: initialTasks,
  colleagues: initialColleagues,
  onDelegated,
}: LeaveDelegationDialogProps) {
  const [tasks, setTasks] = useState<DelegationTask[]>([]);
  const [colleagues, setColleagues] = useState<DelegationColleague[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasDelegated, setHasDelegated] = useState(false);

  // ── Initialize data ───────────────────────────────────────────────────────
  const initData = useCallback(
    async (
      taskList: DelegationTask[],
      colleagueList: DelegationColleague[],
    ) => {
      setTasks(taskList);
      setColleagues(colleagueList);

      // Pre-fill assignments with suggested assignees
      const initial: Record<string, string> = {};
      taskList.forEach((t) => {
        if (t.suggested_assignee_id) {
          initial[t.id] = t.suggested_assignee_id;
        } else if (colleagueList.length > 0) {
          // Pick colleague with lowest workload as default
          const sorted = [...colleagueList].sort(
            (a, b) => (a.workload ?? 100) - (b.workload ?? 100),
          );
          initial[t.id] = sorted[0].id;
        }
      });
      setAssignments(initial);
    },
    [],
  );

  useEffect(() => {
    if (!open) {
      setHasDelegated(false);
      return;
    }

    if (initialTasks && initialColleagues) {
      initData(initialTasks, initialColleagues);
      return;
    }

    // If no tasks provided, use empty list — API would normally provide them
    const taskList = initialTasks ?? [];
    const colleagueList = initialColleagues ?? [];
    initData(taskList, colleagueList);
  }, [open, initialTasks, initialColleagues, initData]);

  // ── Update a single assignment ────────────────────────────────────────────
  const handleAssignmentChange = (taskId: string, colleagueId: string) => {
    setAssignments((prev) => ({ ...prev, [taskId]: colleagueId }));
  };

  // ── Confirm all delegations ───────────────────────────────────────────────
  const handleConfirm = async () => {
    const delegationList: TaskAssignment[] = Object.entries(assignments)
      .filter(([, assignTo]) => !!assignTo)
      .map(([taskId, assignTo]) => ({ task_id: taskId, assign_to: assignTo }));

    if (delegationList.length === 0) {
      toast.warning(
        "Aucune délégation configurée. Veuillez assigner au moins une tâche.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await leaveApi.delegate(eventId, delegationList);
      setHasDelegated(true);
      toast.success(
        `${delegationList.length} délégation${delegationList.length > 1 ? "s" : ""} confirmée${delegationList.length > 1 ? "s" : ""} avec succès.`,
      );
      onDelegated?.();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Erreur lors de la confirmation des délégations.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Computed stats ────────────────────────────────────────────────────────
  const assignedCount = Object.values(assignments).filter(Boolean).length;
  const totalTasks = tasks.length;
  const unassignedCount = totalTasks - assignedCount;

  const getColleague = (id: string) => colleagues.find((c) => c.id === id);

  // ── Format date range header ──────────────────────────────────────────────
  const periodLabel =
    leaveStart && leaveEnd
      ? `${format(parseISO(leaveStart), "d MMM", { locale: fr })} – ${format(
          parseISO(leaveEnd),
          "d MMM yyyy",
          { locale: fr },
        )}`
      : "période de congé";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-muted-foreground" />
            Délégation des tâches
          </DialogTitle>
          <DialogDescription>
            {employeeName ? (
              <>
                <span className="font-medium text-foreground">
                  {employeeName}
                </span>{" "}
                sera absent(e) du{" "}
                <span className="font-medium text-foreground">
                  {periodLabel}
                </span>
                .
              </>
            ) : (
              <>Réassignez les tâches et événements pour la {periodLabel}.</>
            )}{" "}
            Choisissez un remplaçant pour chaque élément ou confirmez les
            suggestions automatiques.
          </DialogDescription>
        </DialogHeader>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span>Chargement des tâches à déléguer…</span>
            </div>
          ) : hasDelegated ? (
            /* ── Success state ──────────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  Délégations confirmées
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {assignedCount} tâche{assignedCount > 1 ? "s" : ""} ont été
                  réassignée{assignedCount > 1 ? "s" : ""} avec succès.
                </p>
              </div>
            </div>
          ) : totalTasks === 0 ? (
            /* ── Empty state ────────────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center text-muted-foreground">
              <Calendar className="h-10 w-10 opacity-40" />
              <div>
                <p className="font-medium">Aucune tâche à déléguer</p>
                <p className="text-sm mt-1">
                  Aucune tâche ou événement n'est planifié pendant la période
                  d'absence.
                </p>
              </div>
            </div>
          ) : (
            /* ── Tasks table ────────────────────────────────────────────── */
            <div className="space-y-4">
              {/* Summary banner */}
              <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-3">
                <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {totalTasks} élément{totalTasks > 1 ? "s" : ""}
                  </span>{" "}
                  à déléguer
                  {unassignedCount > 0 && (
                    <>
                      {" "}
                      —{" "}
                      <span className="text-destructive font-medium">
                        {unassignedCount} non assigné
                        {unassignedCount > 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                  {unassignedCount === 0 && (
                    <>
                      {" "}
                      —{" "}
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        tous assignés
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Coverage warning if any task unassigned */}
              {unassignedCount > 0 && (
                <Alert
                  variant="default"
                  className="border-yellow-400/60 bg-yellow-50 dark:bg-yellow-950/30"
                >
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800 dark:text-yellow-300 text-sm">
                    Tâches non assignées
                  </AlertTitle>
                  <AlertDescription className="text-yellow-700 dark:text-yellow-400 text-xs">
                    {unassignedCount} tâche{unassignedCount > 1 ? "s" : ""}{" "}
                    n&apos;ont pas de remplaçant désigné. Veuillez les assigner
                    avant de confirmer.
                  </AlertDescription>
                </Alert>
              )}

              {/* Table */}
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[35%] text-xs">
                        Tâche / Événement
                      </TableHead>
                      <TableHead className="w-[15%] text-xs">Type</TableHead>
                      <TableHead className="w-[15%] text-xs">Dates</TableHead>
                      <TableHead className="w-[35%] text-xs">
                        Remplaçant
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => {
                      const currentAssigneeId = assignments[task.id] ?? "";
                      const currentAssignee = getColleague(currentAssigneeId);
                      const suggestedColleague = task.suggested_assignee_id
                        ? getColleague(task.suggested_assignee_id)
                        : null;
                      const isSuggestionOverridden =
                        currentAssigneeId !== task.suggested_assignee_id &&
                        task.suggested_assignee_id !== undefined;

                      return (
                        <TableRow key={task.id} className="group">
                          {/* Task title + priority */}
                          <TableCell className="py-3 align-top">
                            <div className="space-y-1">
                              <p className="text-sm font-medium leading-tight">
                                {task.title}
                              </p>
                              {task.priority && (
                                <Badge
                                  variant={
                                    PRIORITY_COLORS[task.priority] ?? "default"
                                  }
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {PRIORITY_LABELS[task.priority] ??
                                    task.priority}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Type */}
                          <TableCell className="py-3 align-top">
                            <span className="text-xs text-muted-foreground">
                              {TYPE_LABELS[task.type ?? "task"] ?? task.type}
                            </span>
                          </TableCell>

                          {/* Dates */}
                          <TableCell className="py-3 align-top">
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 shrink-0" />
                                {format(parseISO(task.start_date), "dd/MM", {
                                  locale: fr,
                                })}
                              </div>
                              {task.end_date &&
                                task.end_date !== task.start_date && (
                                  <div className="flex items-center gap-1 pl-4">
                                    <ArrowRight className="h-3 w-3 shrink-0" />
                                    {format(parseISO(task.end_date), "dd/MM", {
                                      locale: fr,
                                    })}
                                  </div>
                                )}
                            </div>
                          </TableCell>

                          {/* Colleague selector */}
                          <TableCell className="py-3 align-top">
                            <div className="space-y-1.5">
                              <Select
                                value={currentAssigneeId}
                                onValueChange={(v) =>
                                  handleAssignmentChange(task.id, v)
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Choisir un remplaçant…">
                                    {currentAssignee && (
                                      <div className="flex items-center gap-1.5 truncate">
                                        <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                                        <span className="truncate">
                                          {currentAssignee.name}
                                        </span>
                                      </div>
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {colleagues
                                    .slice()
                                    .sort(
                                      (a, b) =>
                                        (a.workload ?? 100) -
                                        (b.workload ?? 100),
                                    )
                                    .map((c) => (
                                      <SelectItem key={c.id} value={c.id}>
                                        <div className="flex items-center justify-between w-full gap-3">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            <div className="min-w-0">
                                              <p className="text-sm truncate">
                                                {c.name}
                                              </p>
                                              {c.department && (
                                                <p className="text-xs text-muted-foreground truncate">
                                                  {c.department}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                          {c.workload !== undefined && (
                                            <WorkloadBar value={c.workload} />
                                          )}
                                        </div>
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>

                              {/* Suggestion hint */}
                              {suggestedColleague &&
                                !isSuggestionOverridden && (
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground pl-0.5">
                                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                    Suggestion automatique
                                  </div>
                                )}
                              {isSuggestionOverridden && suggestedColleague && (
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground pl-0.5">
                                  <RefreshCw className="h-3 w-3 text-blue-500 shrink-0" />
                                  Modifié (suggéré : {suggestedColleague.name})
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Workload summary per colleague */}
              {colleagues.length > 0 && (
                <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Charge de travail des remplaçants
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {colleagues
                      .filter((c) => Object.values(assignments).includes(c.id))
                      .map((c) => {
                        const taskCount = Object.values(assignments).filter(
                          (id) => id === c.id,
                        ).length;
                        return (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-2 text-sm"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate text-xs">{c.name}</span>
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0 shrink-0"
                              >
                                +{taskCount}
                              </Badge>
                            </div>
                            <WorkloadBar value={c.workload} />
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <DialogFooter className="border-t pt-4 gap-2">
          {hasDelegated ? (
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Fermer
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Passer cette étape
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={
                  isSubmitting ||
                  isLoading ||
                  totalTasks === 0 ||
                  unassignedCount > 0
                }
                className="gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirmation…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmer les délégations
                    {assignedCount > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-1 text-xs px-1.5 py-0"
                      >
                        {assignedCount}
                      </Badge>
                    )}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
