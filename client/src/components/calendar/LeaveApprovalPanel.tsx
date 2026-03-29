"use client";

import React, { useState, useEffect, useCallback } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Calendar,
  Users,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Building2,
  Clock,
  TrendingDown,
  UserX,
  Shield,
} from "lucide-react";
import { leaveApi, presenceApi } from "@/lib/api/calendar";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingLeaveEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  leave_type?: string;
  employee_id?: string;
  employee_name?: string;
  employee_avatar?: string;
  department?: string;
  status?: string;
}

interface LeaveBalance {
  leave_type: string;
  label: string;
  days_remaining: number;
  days_taken: number;
  days_total: number;
}

interface LeaveBalancePrediction {
  days_remaining_after: number;
  days_requested: number;
  leave_type: string;
  is_sufficient: boolean;
}

interface TeamConflict {
  user_id: string;
  user_name: string;
  department?: string;
  leave_start: string;
  leave_end: string;
  leave_type: string;
}

interface CoverageCheck {
  min_coverage_required: number;
  current_coverage: number;
  would_violate: boolean;
  team_size: number;
  available_after_approval: number;
}

interface LeaveApprovalPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: PendingLeaveEvent | null;
  onApproved?: (eventId: string) => void;
  onRejected?: (eventId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

function formatDateRange(start: string, end: string): string {
  const s = parseISO(start);
  const e = parseISO(end);
  if (format(s, "MM/yyyy") === format(e, "MM/yyyy")) {
    return `${format(s, "d")} – ${format(e, "d MMMM yyyy", { locale: fr })}`;
  }
  return `${format(s, "d MMM", { locale: fr })} – ${format(e, "d MMM yyyy", { locale: fr })}`;
}

function computeDays(start: string, end: string): number {
  const diff = differenceInDays(parseISO(end), parseISO(start));
  return Math.max(1, diff);
}

const LEAVE_TYPE_COLORS: Record<string, string> = {
  CP: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  RTT: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  Maladie: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  "Sans solde": "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  Autre: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function LeaveApprovalPanel({
  open,
  onOpenChange,
  event,
  onApproved,
  onRejected,
}: LeaveApprovalPanelProps) {
  const [comment, setComment] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Remote data
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [prediction, setPrediction] = useState<LeaveBalancePrediction | null>(null);
  const [teamConflicts, setTeamConflicts] = useState<TeamConflict[]>([]);
  const [coverage, setCoverage] = useState<CoverageCheck | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  // ── Load data when event changes ─────────────────────────────────────────
  const loadLeaveData = useCallback(async (ev: PendingLeaveEvent) => {
    setLoadingData(true);
    setBalances([]);
    setPrediction(null);
    setTeamConflicts([]);
    setCoverage(null);

    const days = computeDays(ev.start_time, ev.end_time);
    const leaveType = ev.leave_type ?? "CP";

    try {
      const [balancesRes, predRes, conflictsRes, coverageRes] =
        await Promise.allSettled([
          leaveApi.balances(),
          leaveApi.predict(days, leaveType),
          leaveApi.teamConflicts(ev.start_time, ev.end_time),
          presenceApi.headcount(ev.start_time.slice(0, 10)),
        ]);

      if (balancesRes.status === "fulfilled") {
        const data = (balancesRes.value as any)?.data ?? balancesRes.value;
        setBalances(Array.isArray(data) ? data : []);
      }
      if (predRes.status === "fulfilled") {
        const data = (predRes.value as any)?.data ?? predRes.value;
        setPrediction(data ?? null);
      }
      if (conflictsRes.status === "fulfilled") {
        const data = (conflictsRes.value as any)?.data ?? conflictsRes.value;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.conflicts)
          ? data.conflicts
          : [];
        setTeamConflicts(list);
      }
      if (coverageRes.status === "fulfilled") {
        const data = (coverageRes.value as any)?.data ?? coverageRes.value;
        // Map headcount response to coverage check
        if (data && typeof data === "object") {
          const teamSize: number = data.team_size ?? data.total ?? 0;
          const available: number = data.available ?? data.present ?? 0;
          const minRequired: number = data.min_required ?? Math.ceil(teamSize * 0.3);
          const availableAfter = Math.max(0, available - 1);
          setCoverage({
            team_size: teamSize,
            min_coverage_required: minRequired,
            current_coverage: available,
            available_after_approval: availableAfter,
            would_violate: availableAfter < minRequired,
          });
        }
      }
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (open && event) {
      setComment("");
      loadLeaveData(event);
    }
  }, [open, event, loadLeaveData]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!event) return;
    setIsApproving(true);
    try {
      await leaveApi.approve(event.id, comment || undefined);
      toast.success(`Congé de ${event.employee_name ?? "l'employé"} approuvé.`);
      onApproved?.(event.id);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors de l'approbation."
      );
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!event) return;
    if (!comment.trim()) {
      toast.warning("Veuillez indiquer un motif de refus.");
      return;
    }
    setIsRejecting(true);
    try {
      await leaveApi.reject(event.id, comment);
      toast.success(`Congé de ${event.employee_name ?? "l'employé"} refusé.`);
      onRejected?.(event.id);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur lors du refus."
      );
    } finally {
      setIsRejecting(false);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────
  if (!event) return null;

  const days = computeDays(event.start_time, event.end_time);
  const leaveType = event.leave_type ?? "CP";
  const badgeClass =
    LEAVE_TYPE_COLORS[leaveType] ??
    "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";

  const currentBalance = balances.find(
    (b) => b.leave_type === leaveType || b.label === leaveType
  );

  const isBusy = isApproving || isRejecting;
  const hasCoverageIssue = coverage?.would_violate === true;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] overflow-y-auto p-0"
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b bg-card sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <SheetTitle className="text-base">Demande de congé</SheetTitle>
              <SheetDescription className="text-xs">
                En attente d'approbation
              </SheetDescription>
            </div>
            <Badge className={`ml-auto text-xs px-2 py-0.5 rounded-full ${badgeClass}`}>
              {leaveType}
            </Badge>
          </div>
        </SheetHeader>

        <div className="px-6 py-5 space-y-6">
          {/* ── Employee info ─────────────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Demandeur
            </h3>
            <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
              <Avatar className="h-12 w-12 shrink-0">
                {event.employee_avatar && (
                  <AvatarImage
                    src={event.employee_avatar}
                    alt={event.employee_name}
                  />
                )}
                <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
                  {getInitials(event.employee_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {event.employee_name ?? "Employé inconnu"}
                </p>
                {event.department && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground truncate">
                      {event.department}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Leave details ─────────────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Détails du congé
            </h3>
            <div className="rounded-lg border bg-card divide-y">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>Période</span>
                </div>
                <span className="text-sm font-medium text-right">
                  {formatDateRange(event.start_time, event.end_time)}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>Durée</span>
                </div>
                <span className="text-sm font-semibold">
                  {days} jour{days > 1 ? "s" : ""}
                </span>
              </div>
              {event.title && event.title !== `Congé — ${leaveType}` && (
                <div className="flex items-start justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground">Motif</span>
                  <span className="text-sm font-medium text-right max-w-[60%]">
                    {event.title}
                  </span>
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* ── Balance info ──────────────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Solde de congés
            </h3>
            {loadingData ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement des données…
              </div>
            ) : currentBalance ? (
              <div className="rounded-lg border bg-card space-y-0 divide-y">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground">Solde actuel</span>
                  <Badge
                    variant={
                      currentBalance.days_remaining >= days
                        ? "default"
                        : "destructive"
                    }
                  >
                    {currentBalance.days_remaining}j disponibles
                  </Badge>
                </div>
                <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
                  <span>Congés posés (total)</span>
                  <span>
                    {currentBalance.days_taken}j / {currentBalance.days_total}j
                    acquis
                  </span>
                </div>
                {prediction && (
                  <div className="px-4 py-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <TrendingDown
                        className={`h-4 w-4 ${
                          prediction.is_sufficient
                            ? "text-green-600"
                            : "text-destructive"
                        }`}
                      />
                      <span className="text-sm">
                        Après approbation :{" "}
                        <span
                          className={`font-semibold ${
                            prediction.is_sufficient
                              ? "text-green-700 dark:text-green-400"
                              : "text-destructive"
                          }`}
                        >
                          {prediction.days_remaining_after}j restants
                        </span>
                      </span>
                    </div>
                    {!prediction.is_sufficient && (
                      <p className="text-xs text-destructive pl-6">
                        Le solde est insuffisant pour couvrir cette demande.
                      </p>
                    )}
                  </div>
                )}
                {/* Balance progress bar */}
                <div className="px-4 pb-3 pt-1">
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          (currentBalance.days_remaining /
                            currentBalance.days_total) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                    <span>0j</span>
                    <span>{currentBalance.days_total}j</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-1">
                Solde non disponible pour ce type de congé.
              </p>
            )}
          </section>

          <Separator />

          {/* ── Mini team calendar ────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Absences simultanées
              </h3>
              {!loadingData && (
                <Badge variant="outline" className="text-xs">
                  {teamConflicts.length} collègue{teamConflicts.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            {loadingData ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                Vérification de l'équipe…
              </div>
            ) : teamConflicts.length > 0 ? (
              <div className="rounded-lg border bg-card divide-y">
                {teamConflicts.map((conflict, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <UserX className="h-3.5 w-3.5 text-orange-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {conflict.user_name}
                        </p>
                        {conflict.department && (
                          <p className="text-xs text-muted-foreground truncate">
                            {conflict.department}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <Badge
                        variant="outline"
                        className={`text-xs mb-0.5 ${
                          LEAVE_TYPE_COLORS[conflict.leave_type] ?? ""
                        }`}
                      >
                        {conflict.leave_type}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(conflict.leave_start), "dd/MM", {
                          locale: fr,
                        })}{" "}
                        –{" "}
                        {format(parseISO(conflict.leave_end), "dd/MM", {
                          locale: fr,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Aucun collègue absent sur cette période.</span>
              </div>
            )}
          </section>

          <Separator />

          {/* ── Coverage check ────────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Couverture minimale
              </h3>
            </div>
            {loadingData ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calcul de la couverture…
              </div>
            ) : coverage ? (
              <>
                <div className="rounded-lg border bg-card divide-y">
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Effectif total</span>
                    <span className="font-medium">{coverage.team_size} personnes</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-muted-foreground">
                      Présents actuellement
                    </span>
                    <span className="font-medium">
                      {coverage.current_coverage} personnes
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-muted-foreground">
                      Après approbation
                    </span>
                    <span
                      className={`font-semibold ${
                        coverage.would_violate
                          ? "text-destructive"
                          : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {coverage.available_after_approval} personnes
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-muted-foreground">
                      Minimum requis
                    </span>
                    <span className="font-medium">
                      {coverage.min_coverage_required} personnes
                    </span>
                  </div>
                </div>
                {hasCoverageIssue && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-sm">
                      Violation de couverture minimale
                    </AlertTitle>
                    <AlertDescription className="text-xs">
                      Approuver ce congé amènerait l'effectif en dessous du
                      minimum requis ({coverage.min_coverage_required} personnes).
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-1">
                Données de couverture non disponibles.
              </p>
            )}
          </section>

          <Separator />

          {/* ── Comment ───────────────────────────────────────────────────── */}
          <section className="space-y-3">
            <Label
              htmlFor="approval-comment"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              Commentaire{" "}
              <span className="text-muted-foreground font-normal normal-case">
                (obligatoire en cas de refus)
              </span>
            </Label>
            <Textarea
              id="approval-comment"
              placeholder="Ajouter un commentaire pour l'employé…"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="resize-none"
              disabled={isBusy}
            />
          </section>

          {/* ── Coverage warning (soft) ───────────────────────────────────── */}
          {!loadingData && hasCoverageIssue && (
            <Alert variant="default" className="border-yellow-400/60 bg-yellow-50 dark:bg-yellow-950/30">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800 dark:text-yellow-300 text-sm">
                Attention
              </AlertTitle>
              <AlertDescription className="text-yellow-700 dark:text-yellow-400 text-xs">
                L'approbation de ce congé risque de compromettre la couverture
                minimale de l'équipe. Assurez-vous qu'une solution de
                remplacement est prévue.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* ── Sticky footer with action buttons ───────────────────────────── */}
        <div className="sticky bottom-0 border-t bg-card px-6 py-4">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={isBusy}
            >
              Fermer
            </Button>
            <Button
              variant="destructive"
              className="flex-1 gap-2"
              onClick={handleReject}
              disabled={isBusy || !comment.trim()}
              title={
                !comment.trim()
                  ? "Un commentaire est requis pour refuser"
                  : undefined
              }
            >
              {isRejecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Refuser
            </Button>
            <Button
              variant="default"
              className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
              onClick={handleApprove}
              disabled={isBusy}
            >
              {isApproving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Approuver
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
