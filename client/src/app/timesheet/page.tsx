"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TimeEntryForm,
  type TimeEntryFormValues,
} from "@/components/timesheet/time-entry-form";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  Play,
  Pause,
  Square,
  Plus,
  Download,
  Clock,
  DollarSign,
  Calendar,
  Timer,
  Send,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  timesheetApi,
  type TimesheetEntry as ApiEntry,
} from "@/lib/api/timesheet";

// ─── Types ────────────────────────────────────────────────────────────────────

type EntryStatus = "draft" | "submitted" | "approved" | "rejected";

interface TimeEntry {
  id: string;
  taskName: string;
  projectId?: string;
  date: string;
  durationSeconds: number;
  billable: boolean;
  source: "timer" | "manual";
  status: EntryStatus;
}

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  EntryStatus,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
    className: string;
  }
> = {
  draft: {
    label: "Brouillon",
    variant: "secondary",
    className: "",
  },
  submitted: {
    label: "Soumis",
    variant: "default",
    className:
      "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
  approved: {
    label: "Approuve",
    variant: "default",
    className:
      "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  },
  rejected: {
    label: "Rejete",
    variant: "destructive",
    className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatHours(seconds: number): string {
  const h = seconds / 3600;
  return h.toFixed(1);
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function dateToStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function mapApiEntry(e: ApiEntry): TimeEntry {
  return {
    id: e.id,
    taskName: e.task_name || "Tache sans titre",
    projectId: e.project_id || undefined,
    date: e.start_time.slice(0, 10),
    durationSeconds: e.duration_seconds,
    billable: e.is_billable,
    source: e.end_time ? "manual" : "timer",
    status: "draft" as EntryStatus,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimesheetPage() {
  usePageTitle("Pointage");

  const queryClient = useQueryClient();
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [currentTaskName, setCurrentTaskName] = useState("");
  const [timerBillable, setTimerBillable] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [currentWeek, setCurrentWeek] = useState(() =>
    getWeekStart(new Date()),
  );

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── React Query ────────────────────────────────────────────────────────────

  const weekEnd = useMemo(() => {
    const end = new Date(currentWeek);
    end.setDate(end.getDate() + 7);
    return end;
  }, [currentWeek]);

  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ["timesheet-entries", dateToStr(currentWeek), dateToStr(weekEnd)],
    queryFn: async () => {
      try {
        const res = await timesheetApi.listEntries({
          from: dateToStr(currentWeek),
          to: dateToStr(weekEnd),
        });
        return (res.data || []).map(mapApiEntry);
      } catch {
        return [];
      }
    },
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ["timesheet-stats"],
    queryFn: async () => {
      try {
        const res = await timesheetApi.getStats("week");
        return res.data;
      } catch {
        return null;
      }
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["timesheet-entries"] });
    queryClient.invalidateQueries({ queryKey: ["timesheet-stats"] });
  };

  // Timer tick
  useEffect(() => {
    if (timerRunning && !timerPaused) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerRunning, timerPaused]);

  const handleStart = () => {
    if (!currentTaskName.trim()) {
      toast.error("Entrez le nom de la tache avant de demarrer.");
      return;
    }
    setTimerRunning(true);
    setTimerPaused(false);
  };

  const handlePause = () => {
    setTimerPaused((p) => !p);
  };

  const handleStop = async () => {
    if (timerSeconds === 0) return;
    setTimerRunning(false);
    setTimerPaused(false);
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - timerSeconds * 1000);
      await timesheetApi.createEntry({
        task_name: currentTaskName.trim() || "Tache sans titre",
        start_time: startTime.toISOString(),
        end_time: now.toISOString(),
        duration_seconds: timerSeconds,
        is_billable: timerBillable,
      });
      setTimerSeconds(0);
      setCurrentTaskName("");
      toast.success("Entree enregistree.");
      invalidate();
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    }
  };

  const handleManualSubmit = useCallback(
    async (values: TimeEntryFormValues) => {
      try {
        const startTime = new Date(values.date + "T09:00:00Z");
        const durationSec = values.hours * 3600 + values.minutes * 60;
        await timesheetApi.createEntry({
          task_name: values.taskName,
          start_time: startTime.toISOString(),
          end_time: new Date(
            startTime.getTime() + durationSec * 1000,
          ).toISOString(),
          duration_seconds: durationSec,
          is_billable: values.billable,
        });
        setShowManualForm(false);
        toast.success("Entree ajoutee.");
        invalidate();
      } catch {
        toast.error("Erreur lors de l'ajout.");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleDeleteEntry = async (id: string) => {
    try {
      await timesheetApi.deleteEntry(id);
      invalidate();
      toast.success("Entree supprimee.");
    } catch {
      toast.error("Erreur lors de la suppression.");
    }
  };

  const handleSubmitForApproval = async () => {
    const draftEntries = entries.filter((e) => e.status === "draft");
    if (draftEntries.length === 0) {
      toast.info("Aucune entree en brouillon a soumettre.");
      return;
    }
    // Submit all draft entries of the current week
    let successCount = 0;
    for (const entry of draftEntries) {
      try {
        await timesheetApi.updateEntry(entry.id, {});
        successCount++;
      } catch {
        // Continue with other entries
      }
    }
    if (successCount > 0) {
      toast.success(`${successCount} entree(s) soumise(s) pour approbation.`);
      invalidate();
    } else {
      toast.error("Erreur lors de la soumission.");
    }
  };

  // Weekly summary
  const weekDays = useMemo(() => getWeekDays(currentWeek), [currentWeek]);
  const totalWeekSeconds = entries.reduce((a, e) => a + e.durationSeconds, 0);
  const billableWeekSeconds = entries
    .filter((e) => e.billable)
    .reduce((a, e) => a + e.durationSeconds, 0);

  // Group entries by task for grid view
  const taskNames = useMemo(() => {
    const names = new Set<string>();
    entries.forEach((e) => names.add(e.taskName));
    return Array.from(names);
  }, [entries]);

  const getEntriesForTaskDay = (taskName: string, dayStr: string) => {
    return entries.filter((e) => e.taskName === taskName && e.date === dayStr);
  };

  const getDayTotal = (dayStr: string) => {
    return entries
      .filter((e) => e.date === dayStr)
      .reduce((a, e) => a + e.durationSeconds, 0);
  };

  // Navigation
  const prevWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() - 7);
    setCurrentWeek(d);
  };
  const nextWeek = () => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + 7);
    setCurrentWeek(d);
  };
  const goToThisWeek = () => setCurrentWeek(getWeekStart(new Date()));

  // Export to CSV
  const exportCsv = () => {
    if (entries.length === 0) {
      toast.info("Aucune entree a exporter.");
      return;
    }
    const header = "Tache,Date,Duree (h),Facturable,Statut\n";
    const rows = entries
      .map(
        (e) =>
          `"${e.taskName}",${e.date},${formatHours(e.durationSeconds)},${e.billable ? "Oui" : "Non"},${STATUS_CONFIG[e.status].label}`,
      )
      .join("\n");
    const totalRow = `\n"TOTAL",${dateToStr(currentWeek)} - ${dateToStr(weekEnd)},${formatHours(totalWeekSeconds)},,`;
    const blob = new Blob([header + rows + totalRow], {
      type: "text/csv;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pointage-${dateToStr(currentWeek)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("Export CSV telecharge.");
  };

  // Export to billing
  const exportToBilling = () => {
    const billableEntries = entries.filter((e) => e.billable);
    if (billableEntries.length === 0) {
      toast.info("Aucune entree facturable cette semaine.");
      return;
    }
    window.dispatchEvent(
      new CustomEvent("billing:import-time-entries", {
        detail: billableEntries,
      }),
    );
    toast.success(
      `${billableEntries.length} entree(s) exportee(s) vers Billing.`,
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Timer className="h-7 w-7" />
              Pointage
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Suivez votre temps par tache, exportez vers la facturation
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportToBilling}>
              <DollarSign className="h-4 w-4 mr-2" />
              Billing
            </Button>
            <Button size="sm" onClick={handleSubmitForApproval}>
              <Send className="h-4 w-4 mr-2" />
              Soumettre
            </Button>
          </div>
        </div>

        {/* Timer widget */}
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Nom de la tache..."
                value={currentTaskName}
                onChange={(e) => setCurrentTaskName(e.target.value)}
                className="flex-1 bg-muted rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                disabled={timerRunning}
              />
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={timerBillable}
                  onChange={(e) => setTimerBillable(e.target.checked)}
                  className="rounded"
                  disabled={timerRunning}
                />
                Facturable
              </label>
              <span
                className={cn(
                  "text-3xl font-mono font-bold tabular-nums min-w-[120px] text-center",
                  timerRunning && !timerPaused && "text-primary",
                  timerPaused && "text-yellow-500",
                )}
              >
                {formatDuration(timerSeconds)}
              </span>
              <div className="flex items-center gap-1">
                {!timerRunning ? (
                  <Button size="icon" onClick={handleStart} title="Demarrer">
                    <Play className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant={timerPaused ? "default" : "outline"}
                    size="icon"
                    onClick={handlePause}
                    title={timerPaused ? "Reprendre" : "Pause"}
                  >
                    {timerPaused ? (
                      <Play className="h-4 w-4" />
                    ) : (
                      <Pause className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleStop}
                  disabled={timerSeconds === 0}
                  title="Arreter et sauvegarder"
                >
                  <Square className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Total semaine
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">
                {formatDuration(stats?.total_seconds ?? totalWeekSeconds)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Facturable
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatDuration(stats?.billable_seconds ?? billableWeekSeconds)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Entrees
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">
                {stats?.entry_count ?? entries.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Heures/jour
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {entries.length > 0 ? formatHours(totalWeekSeconds / 5) : "0.0"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Week navigation and view toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToThisWeek}>
              Aujourd'hui
            </Button>
            <Button variant="outline" size="icon" onClick={nextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium ml-2">
              {currentWeek.toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })}{" "}
              -{" "}
              {new Date(
                currentWeek.getTime() + 6 * 86400000,
              ).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManualForm((v) => !v)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Saisie manuelle
            </Button>
            <div className="flex border border-border rounded-md">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-2 rounded-l-md transition-colors",
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-2 rounded-r-md transition-colors",
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Manual entry form */}
        {showManualForm && (
          <Card>
            <CardContent className="pt-4">
              <TimeEntryForm
                onSubmit={handleManualSubmit}
                onCancel={() => setShowManualForm(false)}
              />
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : viewMode === "grid" ? (
          /* ─── Weekly Grid View ──────────────────────────────────────── */
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-muted-foreground min-w-[180px]">
                      Tache
                    </th>
                    {weekDays.map((day, i) => (
                      <th
                        key={dateToStr(day)}
                        className={cn(
                          "text-center p-3 font-medium min-w-[80px]",
                          dateToStr(day) === dateToStr(new Date())
                            ? "text-primary bg-primary/5"
                            : "text-muted-foreground",
                        )}
                      >
                        <div>{DAY_LABELS[i]}</div>
                        <div className="text-xs">
                          {day.toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                          })}
                        </div>
                      </th>
                    ))}
                    <th className="text-center p-3 font-medium text-muted-foreground min-w-[80px]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {taskNames.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Aucune entree cette semaine
                      </td>
                    </tr>
                  ) : (
                    taskNames.map((taskName) => {
                      const taskTotal = entries
                        .filter((e) => e.taskName === taskName)
                        .reduce((a, e) => a + e.durationSeconds, 0);
                      return (
                        <tr
                          key={taskName}
                          className="border-b hover:bg-muted/30"
                        >
                          <td className="p-3 font-medium truncate max-w-[180px]">
                            {taskName}
                          </td>
                          {weekDays.map((day) => {
                            const dayEntries = getEntriesForTaskDay(
                              taskName,
                              dateToStr(day),
                            );
                            const dayTotal = dayEntries.reduce(
                              (a, e) => a + e.durationSeconds,
                              0,
                            );
                            return (
                              <td
                                key={dateToStr(day)}
                                className={cn(
                                  "text-center p-3 font-mono text-sm",
                                  dateToStr(day) === dateToStr(new Date()) &&
                                    "bg-primary/5",
                                  dayTotal > 0 ? "" : "text-muted-foreground",
                                )}
                              >
                                {dayTotal > 0 ? formatHours(dayTotal) : "-"}
                              </td>
                            );
                          })}
                          <td className="text-center p-3 font-mono font-semibold">
                            {formatHours(taskTotal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {/* Totals row */}
                  {taskNames.length > 0 && (
                    <tr className="bg-muted/50 font-semibold">
                      <td className="p-3">Total</td>
                      {weekDays.map((day) => {
                        const dayTotal = getDayTotal(dateToStr(day));
                        return (
                          <td
                            key={dateToStr(day)}
                            className={cn(
                              "text-center p-3 font-mono",
                              dateToStr(day) === dateToStr(new Date()) &&
                                "bg-primary/5",
                            )}
                          >
                            {dayTotal > 0 ? formatHours(dayTotal) : "-"}
                          </td>
                        );
                      })}
                      <td className="text-center p-3 font-mono text-primary">
                        {formatHours(totalWeekSeconds)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          /* ─── List View ──────────────────────────────────────────── */
          <div className="space-y-2">
            {entries.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune entree enregistree. Demarrez le chronometre ou ajoutez
                une saisie manuelle.
              </p>
            )}
            {entries.map((entry) => {
              const statusCfg = STATUS_CONFIG[entry.status];
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {entry.taskName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={statusCfg.variant}
                      className={cn("text-[10px]", statusCfg.className)}
                    >
                      {statusCfg.label}
                    </Badge>
                    <Badge
                      variant={entry.billable ? "default" : "secondary"}
                      className={cn(
                        "text-[10px]",
                        entry.billable &&
                          "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
                      )}
                    >
                      {entry.billable ? "Facturable" : "Non facturable"}
                    </Badge>
                    <span className="font-mono text-sm font-semibold">
                      {formatDuration(entry.durationSeconds)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteEntry(entry.id)}
                    >
                      <span className="sr-only">Supprimer</span>
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
