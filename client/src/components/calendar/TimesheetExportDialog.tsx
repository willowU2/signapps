"use client";

/**
 * TimesheetExportDialog Component
 *
 * Dialog for exporting validated timesheets to CSV or JSON.
 * Shows a preview summary before downloading.
 */

import React, { useState, useEffect, useCallback } from "react";
import { format, parseISO, isValid, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Download,
  FileText,
  FileJson,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { timesheetsApi } from "@/lib/api/calendar";

// ============================================================================
// Types
// ============================================================================

type ExportFormat = "csv" | "json";

interface TimesheetSummaryRow {
  employee: string;
  week: string;
  status: string;
  totalHours: number;
  byCategory: Record<string, number>;
  alreadyExported: boolean;
}

interface ExportPreview {
  entries: TimesheetSummaryRow[];
  totalEntries: number;
  alreadyExportedCount: number;
  pendingCount: number;
}

// ============================================================================
// Helpers
// ============================================================================

function formatHours(h: number): string {
  if (h === 0) return "0h";
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
}

function buildCsvContent(entries: TimesheetSummaryRow[]): string {
  if (entries.length === 0) return "";

  // Collect all category keys
  const allCategories = Array.from(
    new Set(entries.flatMap((e) => Object.keys(e.byCategory)))
  ).sort();

  const headers = [
    "Employé",
    "Semaine",
    "Statut",
    "Total heures",
    ...allCategories,
    "Déjà exporté",
  ];

  const rows = entries.map((e) => [
    `"${e.employee}"`,
    e.week,
    e.status,
    e.totalHours.toString(),
    ...allCategories.map((c) => (e.byCategory[c] ?? 0).toString()),
    e.alreadyExported ? "Oui" : "Non",
  ]);

  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
}

function buildJsonContent(entries: TimesheetSummaryRow[]): string {
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      total_entries: entries.length,
      timesheets: entries.map((e) => ({
        employee: e.employee,
        week: e.week,
        status: e.status,
        total_hours: e.totalHours,
        by_category: e.byCategory,
        already_exported: e.alreadyExported,
      })),
    },
    null,
    2
  );
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function parseRawToPreview(raw: any): TimesheetSummaryRow[] {
  if (!raw) return [];

  // Backend returns array of timesheet entries
  if (Array.isArray(raw)) {
    // Group by employee + week
    const grouped: Record<string, TimesheetSummaryRow> = {};
    raw.forEach((entry: any) => {
      const key = `${entry.user_id ?? entry.employee ?? "?"}_${entry.week ?? "?"}`;
      if (!grouped[key]) {
        grouped[key] = {
          employee:
            entry.employee_name ??
            entry.username ??
            entry.user_id ??
            "Inconnu",
          week: entry.week ?? entry.week_key ?? "?",
          status: entry.status ?? "pending",
          totalHours: 0,
          byCategory: {},
          alreadyExported: entry.status === "exported",
        };
      }
      const cat = entry.category ?? entry.category_name ?? "Autres";
      const hours = entry.hours ?? 0;
      grouped[key].totalHours += hours;
      grouped[key].byCategory[cat] =
        (grouped[key].byCategory[cat] ?? 0) + hours;
    });
    return Object.values(grouped);
  }

  // Single object with entries field
  if (raw.entries && Array.isArray(raw.entries)) {
    return parseRawToPreview(raw.entries);
  }

  return [];
}

// ============================================================================
// Props
// ============================================================================

interface TimesheetExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStartDate?: string; // YYYY-MM-DD
  defaultEndDate?: string;   // YYYY-MM-DD
}

// ============================================================================
// Component
// ============================================================================

export function TimesheetExportDialog({
  open,
  onOpenChange,
  defaultStartDate,
  defaultEndDate,
}: TimesheetExportDialogProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const firstOfMonth = format(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    "yyyy-MM-dd"
  );

  const [startDate, setStartDate] = useState(
    defaultStartDate ?? firstOfMonth
  );
  const [endDate, setEndDate] = useState(defaultEndDate ?? today);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState(false);

  // Sync props to state when dialog opens
  useEffect(() => {
    if (open) {
      if (defaultStartDate) setStartDate(defaultStartDate);
      if (defaultEndDate) setEndDate(defaultEndDate);
      setExportDone(false);
      setError(null);
      setPreview(null);
    }
  }, [open, defaultStartDate, defaultEndDate]);

  // Validate date range
  const isValidRange = useCallback(() => {
    if (!startDate || !endDate) return false;
    const s = parseISO(startDate);
    const e = parseISO(endDate);
    return isValid(s) && isValid(e) && s <= e;
  }, [startDate, endDate]);

  // Load preview data
  const loadPreview = useCallback(async () => {
    if (!isValidRange()) return;
    setIsLoadingPreview(true);
    setError(null);
    try {
      const res = await timesheetsApi.list({});
      const raw: any = res.data;
      const rows = parseRawToPreview(raw);

      // Filter by date range
      const s = parseISO(startDate);
      const e = parseISO(endDate);
      const filtered = rows.filter((r) => {
        // week format: "2026-W13"
        const match = r.week.match(/(\d{4})-W(\d{2})/);
        if (!match) return true;
        // approximate: monday of that week
        const year = parseInt(match[1]);
        const week = parseInt(match[2]);
        const jan4 = new Date(year, 0, 4);
        const weekStart = new Date(
          jan4.getTime() +
            (week - 1) * 7 * 24 * 60 * 60 * 1000 -
            ((jan4.getDay() || 7) - 1) * 24 * 60 * 60 * 1000
        );
        return weekStart >= s && weekStart <= e;
      });

      const exported = filtered.filter((r) => r.alreadyExported).length;
      setPreview({
        entries: filtered,
        totalEntries: filtered.length,
        alreadyExportedCount: exported,
        pendingCount: filtered.length - exported,
      });
    } catch (err: any) {
      // No data or error — show empty preview
      setPreview({
        entries: [],
        totalEntries: 0,
        alreadyExportedCount: 0,
        pendingCount: 0,
      });
    } finally {
      setIsLoadingPreview(false);
    }
  }, [startDate, endDate, isValidRange]);

  // Auto-load preview when range changes
  useEffect(() => {
    if (open && isValidRange()) {
      const timer = setTimeout(loadPreview, 500);
      return () => clearTimeout(timer);
    }
  }, [open, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Export handler
  const handleExport = async () => {
    if (!isValidRange()) return;
    setIsExporting(true);
    setError(null);

    try {
      // Call the export API endpoint
      const res = await timesheetsApi.export(startDate, endDate);
      const raw: any = res.data;

      let content: string;
      let filename: string;
      let mime: string;

      if (exportFormat === "csv") {
        const rows =
          typeof raw === "string" ? [] : parseRawToPreview(raw);
        if (typeof raw === "string") {
          // Backend returned raw CSV
          content = raw;
        } else {
          content = buildCsvContent(rows);
        }
        filename = `feuilles_temps_${startDate}_${endDate}.csv`;
        mime = "text/csv;charset=utf-8";
      } else {
        // JSON
        if (typeof raw === "object") {
          content = JSON.stringify(raw, null, 2);
        } else {
          const rows = parseRawToPreview(raw);
          content = buildJsonContent(rows);
        }
        filename = `feuilles_temps_${startDate}_${endDate}.json`;
        mime = "application/json";
      }

      triggerDownload(content, filename, mime);
      setExportDone(true);

      // Update preview to mark all as exported
      if (preview) {
        setPreview((prev) =>
          prev
            ? {
                ...prev,
                entries: prev.entries.map((e) => ({
                  ...e,
                  alreadyExported: true,
                  status: "exported",
                })),
                alreadyExportedCount: prev.totalEntries,
                pendingCount: 0,
              }
            : prev
        );
      }
    } catch (err: any) {
      // If API fails, build from preview data we have
      if (preview && preview.entries.length > 0) {
        let content: string;
        let filename: string;
        let mime: string;
        if (exportFormat === "csv") {
          content = buildCsvContent(preview.entries);
          filename = `feuilles_temps_${startDate}_${endDate}.csv`;
          mime = "text/csv;charset=utf-8";
        } else {
          content = buildJsonContent(preview.entries);
          filename = `feuilles_temps_${startDate}_${endDate}.json`;
          mime = "application/json";
        }
        triggerDownload(content, filename, mime);
        setExportDone(true);
      } else {
        setError(
          err?.response?.data?.message ??
            err?.message ??
            "Erreur lors de l'export."
        );
      }
    } finally {
      setIsExporting(false);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Exporter les feuilles de temps
          </DialogTitle>
          <DialogDescription>
            Exportez les feuilles de temps validées pour la paie ou les RH.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── Date range ──────────────────────────────────────────────── */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Période</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="ts-start"
                  className="text-xs text-muted-foreground"
                >
                  Date de début
                </Label>
                <Input
                  id="ts-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="ts-end"
                  className="text-xs text-muted-foreground"
                >
                  Date de fin
                </Label>
                <Input
                  id="ts-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            {isValidRange() && (
              <p className="text-xs text-muted-foreground">
                Période de{" "}
                <strong>
                  {differenceInDays(parseISO(endDate), parseISO(startDate)) +
                    1}{" "}
                  jours
                </strong>{" "}
                ({format(parseISO(startDate), "d MMMM yyyy", { locale: fr })}{" "}
                au{" "}
                {format(parseISO(endDate), "d MMMM yyyy", { locale: fr })})
              </p>
            )}

            {!isValidRange() && startDate && endDate && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                La date de début doit être antérieure à la date de fin.
              </p>
            )}
          </div>

          {/* ── Format selector ─────────────────────────────────────────── */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Format d'export</Label>
            <div className="grid grid-cols-2 gap-3">
              {/* CSV */}
              <button
                type="button"
                onClick={() => setExportFormat("csv")}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                  exportFormat === "csv"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:bg-muted/40"
                )}
              >
                <FileText
                  className={cn(
                    "h-5 w-5 mt-0.5 shrink-0",
                    exportFormat === "csv"
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                />
                <div>
                  <p className="font-medium text-sm">CSV</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Compatible Excel, LibreOffice, logiciels paie
                  </p>
                </div>
              </button>

              {/* JSON */}
              <button
                type="button"
                onClick={() => setExportFormat("json")}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                  exportFormat === "json"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border hover:bg-muted/40"
                )}
              >
                <FileJson
                  className={cn(
                    "h-5 w-5 mt-0.5 shrink-0",
                    exportFormat === "json"
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                />
                <div>
                  <p className="font-medium text-sm">JSON</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Format natif SignApps, API-compatible
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* ── Preview ─────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Aperçu</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadPreview}
                disabled={isLoadingPreview || !isValidRange()}
                className="h-7 gap-1.5 text-xs"
              >
                <RefreshCw
                  className={cn(
                    "h-3 w-3",
                    isLoadingPreview && "animate-spin"
                  )}
                />
                Rafraîchir
              </Button>
            </div>

            {/* Stats */}
            {preview && (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {preview.totalEntries}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Entrées au total
                  </p>
                </div>
                <div className="rounded-lg border bg-green-500/10 border-green-500/30 p-3 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {preview.pendingCount}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    À exporter
                  </p>
                </div>
                <div className="rounded-lg border bg-blue-500/10 border-blue-500/30 p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {preview.alreadyExportedCount}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Déjà exportés
                  </p>
                </div>
              </div>
            )}

            {/* Preview table */}
            {isLoadingPreview && (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Chargement de l'aperçu…
              </div>
            )}

            {!isLoadingPreview && preview && preview.entries.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="border-b">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">
                          Employé
                        </th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">
                          Semaine
                        </th>
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground text-xs">
                          Total
                        </th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">
                          Statut
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.entries.map((row, i) => (
                        <tr
                          key={i}
                          className={cn(
                            "border-b last:border-0 transition-colors hover:bg-muted/30",
                            row.alreadyExported && "opacity-60"
                          )}
                        >
                          <td className="px-3 py-2 font-medium text-sm">
                            {row.employee}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground text-sm">
                            {row.week}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold text-sm">
                            {formatHours(row.totalHours)}
                          </td>
                          <td className="px-3 py-2">
                            {row.alreadyExported ? (
                              <Badge className="gap-1 text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30">
                                <Download className="h-2.5 w-2.5" />
                                Exporté
                              </Badge>
                            ) : row.status === "validated" ? (
                              <Badge className="gap-1 text-xs bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                                <CheckCircle className="h-2.5 w-2.5" />
                                Validé
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="gap-1 text-xs text-muted-foreground"
                              >
                                En attente
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!isLoadingPreview && preview && preview.entries.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2 border rounded-lg bg-muted/20">
                <Info className="h-8 w-8 opacity-40" />
                <p className="text-sm font-medium">Aucune feuille de temps</p>
                <p className="text-xs">
                  Aucune donnée trouvée pour cette période.
                </p>
              </div>
            )}

            {!isLoadingPreview && !preview && isValidRange() && (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm border rounded-lg bg-muted/10">
                <Info className="h-4 w-4" />
                Cliquez sur Rafraîchir pour charger l'aperçu.
              </div>
            )}
          </div>

          {/* ── Error / Success messages ─────────────────────────────────── */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {exportDone && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Export terminé — le fichier a été téléchargé.
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <DialogFooter className="gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            {exportDone ? "Fermer" : "Annuler"}
          </Button>

          <Button
            onClick={handleExport}
            disabled={
              isExporting ||
              !isValidRange() ||
              (preview?.totalEntries === 0 ?? false)
            }
            className="gap-2"
          >
            {isExporting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Export en cours…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Télécharger en{" "}
                {exportFormat.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TimesheetExportDialog;
