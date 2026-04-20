"use client";

/**
 * SO9 — Dashboard des renouvellements.
 *
 * Liste consolidée de tous les renouvellements (garanties, licences,
 * contrôles techniques, validités badges, …) avec filtres et actions
 * inline (renouveler, reporter, annuler).
 *
 * URL: `/admin/resources/renewals`
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePageTitle } from "@/hooks/use-page-title";
import { orgApi } from "@/lib/api/org";
import type { ResourceRenewal, RenewalKind, RenewalStatus } from "@/types/org";
import {
  Download,
  RefreshCcw,
  Clock,
  XCircle,
  CheckCircle2,
} from "lucide-react";

const KIND_LABELS: Record<RenewalKind, string> = {
  warranty_end: "Garantie",
  license_expiry: "Licence",
  badge_validity: "Badge",
  insurance_expiry: "Assurance",
  technical_inspection: "Contrôle technique",
  maintenance_due: "Maintenance",
  battery_replacement: "Batterie",
  key_rotation: "Rotation clés",
  custom: "Autre",
};

const STATUS_LABELS: Record<RenewalStatus, string> = {
  pending: "En attente",
  snoozed: "Reporté",
  renewed: "Renouvelé",
  escalated: "Escaladé",
  cancelled: "Annulé",
};

const STATUS_COLORS: Record<RenewalStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  snoozed: "bg-blue-500/10 text-blue-600 border border-blue-500/20",
  renewed: "bg-green-500/10 text-green-600 border border-green-500/20",
  escalated: "bg-red-500/10 text-red-600 border border-red-500/20",
  cancelled: "bg-muted text-muted-foreground",
};

function daysToDue(due: string): number {
  const today = new Date();
  const d = new Date(due);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyLabel(days: number, status: RenewalStatus): string {
  if (status === "renewed") return "Fait";
  if (status === "cancelled") return "Annulé";
  if (days < 0) return `${Math.abs(days)}j en retard`;
  if (days === 0) return "Aujourd'hui";
  return `J-${days}`;
}

function urgencyColor(days: number, status: RenewalStatus): string {
  if (status === "renewed" || status === "cancelled") return "";
  if (days < 0) return "text-red-600 font-semibold";
  if (days <= 7) return "text-orange-600 font-semibold";
  if (days <= 30) return "text-amber-600";
  return "text-muted-foreground";
}

export default function ResourceRenewalsPage() {
  usePageTitle("Renouvellements");
  const [rows, setRows] = useState<ResourceRenewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterKind, setFilterKind] = useState<RenewalKind | "all">("all");
  const [filterStatus, setFilterStatus] = useState<RenewalStatus | "all">(
    "all",
  );
  const [search, setSearch] = useState("");

  // Dialog state
  const [renewTarget, setRenewTarget] = useState<ResourceRenewal | null>(null);
  const [renewNotes, setRenewNotes] = useState("");
  const [snoozeTarget, setSnoozeTarget] = useState<ResourceRenewal | null>(
    null,
  );
  const [snoozeDate, setSnoozeDate] = useState("");

  const reload = async () => {
    try {
      setLoading(true);
      const res = await orgApi.renewals.list({
        kind: filterKind === "all" ? undefined : filterKind,
        status: filterStatus === "all" ? undefined : filterStatus,
      });
      setRows(res.data);
    } catch (e) {
      // API can return 404 if scheduler not mounted — fall back to empty list
      console.error("load renewals failed", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKind, filterStatus]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.kind.toLowerCase().includes(q) ||
        (r.renewal_notes ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const buckets = useMemo(() => {
    const bySeverity: Record<string, number> = {
      overdue: 0,
      j7: 0,
      j30: 0,
      j60: 0,
    };
    for (const r of filtered) {
      if (
        r.status !== "pending" &&
        r.status !== "snoozed" &&
        r.status !== "escalated"
      )
        continue;
      const d = daysToDue(r.due_date);
      if (d < 0) bySeverity.overdue += 1;
      else if (d <= 7) bySeverity.j7 += 1;
      else if (d <= 30) bySeverity.j30 += 1;
      else if (d <= 60) bySeverity.j60 += 1;
    }
    return bySeverity;
  }, [filtered]);

  const confirmRenew = async () => {
    if (!renewTarget) return;
    try {
      await orgApi.renewals.renew(renewTarget.id, {
        renewal_notes: renewNotes || undefined,
      });
      toast.success("Renouvellement enregistré");
      setRenewTarget(null);
      setRenewNotes("");
      reload();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const confirmSnooze = async () => {
    if (!snoozeTarget || !snoozeDate) return;
    try {
      await orgApi.renewals.snooze(snoozeTarget.id, snoozeDate);
      toast.success("Renouvellement reporté");
      setSnoozeTarget(null);
      setSnoozeDate("");
      reload();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du report");
    }
  };

  const cancelOne = async (row: ResourceRenewal) => {
    try {
      await orgApi.renewals.cancel(row.id);
      toast.success("Annulé");
      reload();
    } catch (e) {
      console.error(e);
      toast.error("Erreur");
    }
  };

  const downloadIcs = () => {
    const url = orgApi.renewals.exportIcsUrl({
      kind: filterKind === "all" ? undefined : filterKind,
      status: filterStatus === "all" ? undefined : filterStatus,
    });
    window.open(url, "_blank");
  };

  return (
    <AppLayout>
      <PageHeader
        title="Renouvellements"
        description="Suivi des garanties, licences, contrôles et validités des ressources"
        actions={
          <Button variant="outline" onClick={downloadIcs}>
            <Download className="mr-2 h-4 w-4" /> Export ICS
          </Button>
        }
      />

      {/* KPI row */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-red-600">
            {buckets.overdue}
          </div>
          <div className="text-xs text-muted-foreground mt-1">En retard</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-orange-600">{buckets.j7}</div>
          <div className="text-xs text-muted-foreground mt-1">J-7</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-amber-600">{buckets.j30}</div>
          <div className="text-xs text-muted-foreground mt-1">J-30</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold">{buckets.j60}</div>
          <div className="text-xs text-muted-foreground mt-1">J-60</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <Label htmlFor="search-renewals" className="text-xs">
            Recherche
          </Label>
          <Input
            id="search-renewals"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Notes, type…"
          />
        </div>
        <div className="w-full md:w-44">
          <Label htmlFor="filter-kind" className="text-xs">
            Type
          </Label>
          <Select
            value={filterKind}
            onValueChange={(v) => setFilterKind(v as RenewalKind | "all")}
          >
            <SelectTrigger id="filter-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {(Object.keys(KIND_LABELS) as RenewalKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-44">
          <Label htmlFor="filter-status" className="text-xs">
            Statut
          </Label>
          <Select
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v as RenewalStatus | "all")}
          >
            <SelectTrigger id="filter-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {(Object.keys(STATUS_LABELS) as RenewalStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead>Urgence</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[200px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  Aucun renouvellement
                </TableCell>
              </TableRow>
            )}
            {filtered.map((row) => {
              const d = daysToDue(row.due_date);
              const urgent = urgencyLabel(d, row.status);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <Badge variant="outline">{KIND_LABELS[row.kind]}</Badge>
                  </TableCell>
                  <TableCell>
                    <time dateTime={row.due_date}>{row.due_date}</time>
                  </TableCell>
                  <TableCell>
                    <span className={urgencyColor(d, row.status)}>
                      {urgent}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ${STATUS_COLORS[row.status]}`}
                    >
                      {STATUS_LABELS[row.status]}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {row.renewal_notes ?? "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {row.status !== "renewed" && row.status !== "cancelled" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRenewTarget(row)}
                          title="Renouveler"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSnoozeTarget(row)}
                          title="Reporter"
                        >
                          <Clock className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelOne(row)}
                          title="Annuler"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {(row.status === "renewed" ||
                      row.status === "cancelled") && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Renew Dialog */}
      <Dialog
        open={!!renewTarget}
        onOpenChange={(open) => !open && setRenewTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marquer comme renouvelé</DialogTitle>
            <DialogDescription>
              {renewTarget ? KIND_LABELS[renewTarget.kind] : ""} — échéance{" "}
              {renewTarget?.due_date}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="renew-notes">Notes (optionnel)</Label>
            <Textarea
              id="renew-notes"
              value={renewNotes}
              onChange={(e) => setRenewNotes(e.target.value)}
              placeholder="Référence nouvelle licence, numéro de dossier, …"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewTarget(null)}>
              Annuler
            </Button>
            <Button onClick={confirmRenew}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Snooze Dialog */}
      <Dialog
        open={!!snoozeTarget}
        onOpenChange={(open) => !open && setSnoozeTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reporter l'échéance</DialogTitle>
            <DialogDescription>
              {snoozeTarget ? KIND_LABELS[snoozeTarget.kind] : ""} — échéance
              actuelle {snoozeTarget?.due_date}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="snooze-date">Nouvelle date</Label>
            <Input
              id="snooze-date"
              type="date"
              value={snoozeDate}
              onChange={(e) => setSnoozeDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnoozeTarget(null)}>
              Annuler
            </Button>
            <Button onClick={confirmSnooze} disabled={!snoozeDate}>
              <Clock className="mr-2 h-4 w-4" /> Reporter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
