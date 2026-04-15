"use client";

/**
 * Calendar Meeting Heatmap (AQ-HEAT)
 *
 * GitHub-style contribution heatmap showing meeting hours per day
 * for the last 90 days. Pure CSS/div grid — no external charting library.
 *
 * Color scale (hours of meetings per day):
 *   0h  → gray   (#e5e7eb)
 *   1-2h → light green (#86efac)
 *   3-4h → yellow (#fde047)
 *   5+h  → red    (#f87171)
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  subDays,
  format,
  startOfDay,
  differenceInMinutes,
  parseISO,
  getDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import { calendarApi } from "@/lib/api/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/use-page-title";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DayData {
  date: Date;
  dateKey: string; // "yyyy-MM-dd"
  hours: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map meeting hours to a CSS background color */
function hoursToColor(hours: number): string {
  if (hours === 0) return "#e5e7eb"; // gray-200
  if (hours <= 2) return "#86efac"; // green-300
  if (hours <= 4) return "#fde047"; // yellow-300
  return "#f87171"; // red-400
}

/** Map meeting hours to a human-readable label */
function hoursToLabel(hours: number): string {
  if (hours === 0) return "Aucune réunion";
  if (hours <= 2) return `${hours.toFixed(1)}h (faible)`;
  if (hours <= 4) return `${hours.toFixed(1)}h (modéré)`;
  return `${hours.toFixed(1)}h (chargé)`;
}

/** Build the 90-day date range — newest day last */
function buildDateRange(endDate: Date, days: number): DayData[] {
  const result: DayData[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = startOfDay(subDays(endDate, i));
    result.push({ date, dateKey: format(date, "yyyy-MM-dd"), hours: 0 });
  }
  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalHeatmapPage() {
  usePageTitle("Carte thermique");
  const DAYS = 90;
  const today = startOfDay(new Date());

  const {
    data: heatmapData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cal-heatmap"],
    queryFn: async (): Promise<DayData[]> => {
      const startDate = subDays(today, DAYS - 1);
      const endDate = today;

      // Build date range skeleton
      const dayMap = new Map<string, DayData>();
      buildDateRange(endDate, DAYS).forEach((d) => dayMap.set(d.dateKey, d));

      // Fetch all user calendars
      const calendarsResponse = await calendarApi.listCalendars();
      const calendars = calendarsResponse.data || [];

      // Collect events across all calendars in the 90-day window
      for (const cal of calendars) {
        try {
          const eventsResponse = await calendarApi.listEvents(
            cal.id,
            startDate,
            endDate,
          );
          const events = eventsResponse.data || [];
          for (const ev of events) {
            if (!ev.start_time || !ev.end_time) continue;
            const start = parseISO(ev.start_time);
            const end = parseISO(ev.end_time);
            const durationMinutes = Math.max(
              0,
              differenceInMinutes(end, start),
            );
            const dateKey = format(startOfDay(start), "yyyy-MM-dd");
            const day = dayMap.get(dateKey);
            if (day) {
              day.hours += durationMinutes / 60;
            }
          }
        } catch {
          // Skip calendars that fail to load
        }
      }

      return Array.from(dayMap.values());
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── Build grid columns (weeks) ──────────────────────────────────────────
  // Each column = one week (Sun–Sat). The first column may be partial.
  const weeks = React.useMemo<DayData[][]>(() => {
    if (!heatmapData) return [];
    const result: DayData[][] = [];
    let week: DayData[] = [];

    // Pad the first week: getDay() returns 0=Sun … 6=Sat
    const firstDay = heatmapData[0];
    const startDow = getDay(firstDay.date); // day-of-week offset
    for (let i = 0; i < startDow; i++) {
      week.push({ date: new Date(0), dateKey: "", hours: -1 }); // placeholder
    }

    for (const day of heatmapData) {
      week.push(day);
      if (week.length === 7) {
        result.push(week);
        week = [];
      }
    }
    if (week.length > 0) result.push(week);
    return result;
  }, [heatmapData]);

  // ── Month labels ────────────────────────────────────────────────────────
  const monthLabels = React.useMemo<{ label: string; col: number }[]>(() => {
    if (!heatmapData) return [];
    const seen = new Set<string>();
    const labels: { label: string; col: number }[] = [];

    // rebuild the column index per day
    let currentDow = heatmapData[0] ? getDay(heatmapData[0].date) : 0;
    let col = 0;
    let inWeek = currentDow;

    for (let i = 0; i < heatmapData.length; i++) {
      const d = heatmapData[i];
      const monthKey = format(d.date, "yyyy-MM");
      if (!seen.has(monthKey)) {
        seen.add(monthKey);
        labels.push({ label: format(d.date, "MMM", { locale: fr }), col });
      }
      inWeek++;
      if (inWeek === 7) {
        col++;
        inWeek = 0;
      }
    }
    return labels;
  }, [heatmapData]);

  // ── Stats ───────────────────────────────────────────────────────────────
  const stats = React.useMemo(() => {
    if (!heatmapData) return null;
    const nonZero = heatmapData.filter((d) => d.hours > 0);
    const totalHours = heatmapData.reduce((s, d) => s + d.hours, 0);
    const busiest = heatmapData.reduce(
      (max, d) => (d.hours > max.hours ? d : max),
      heatmapData[0]!,
    );
    return {
      totalHours: totalHours.toFixed(1),
      meetingDays: nonZero.length,
      avgHoursPerDay:
        nonZero.length > 0 ? (totalHours / nonZero.length).toFixed(1) : "0",
      busiestDay: busiest.hours > 0 ? busiest : null,
    };
  }, [heatmapData]);

  // ── Tooltip state ───────────────────────────────────────────────────────
  const [tooltip, setTooltip] = React.useState<{
    day: DayData;
    x: number;
    y: number;
  } | null>(null);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Charge de réunions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Heures de réunion par jour — 90 derniers jours
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/cal">
            <ArrowLeft className="h-4 w-4" />
            Retour au calendrier
          </Link>
        </Button>
      </div>

      {/* Stats cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.totalHours}h</div>
              <div className="text-xs text-muted-foreground mt-1">
                Total réunions (90j)
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.meetingDays}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Jours avec réunions
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.avgHoursPerDay}h</div>
              <div className="text-xs text-muted-foreground mt-1">
                Moy. par jour actif
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {stats.busiestDay
                  ? format(stats.busiestDay.date, "d MMM", { locale: fr })
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Journée la plus chargée
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Heatmap grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Heatmap — heures de réunion
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : error ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              Impossible de charger les données du calendrier.
            </div>
          ) : (
            <div className="relative overflow-x-auto pb-2">
              {/* Month labels row */}
              <div
                className="flex mb-1"
                style={{ gap: "3px", paddingLeft: "24px" }}
              >
                {monthLabels.map(({ label, col }, i) => (
                  <div
                    key={i}
                    className="text-[10px] text-muted-foreground"
                    style={{
                      position: "absolute",
                      left: `${24 + col * 15}px`,
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Day-of-week labels + grid */}
              <div
                className="flex items-start gap-1"
                style={{ marginTop: "16px" }}
              >
                {/* Day-of-week labels */}
                <div
                  className="flex flex-col"
                  style={{ gap: "3px", width: "20px", marginRight: "4px" }}
                >
                  {["D", "L", "M", "Me", "J", "V", "S"].map((dow, i) => (
                    <div
                      key={dow}
                      className="text-[9px] text-muted-foreground flex items-center justify-end"
                      style={{ height: "12px" }}
                    >
                      {/* Show only Mon, Wed, Fri */}
                      {[1, 3, 5].includes(i) ? dow : ""}
                    </div>
                  ))}
                </div>

                {/* Columns (weeks) */}
                <div
                  className="flex"
                  style={{ gap: "3px" }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {weeks.map((week, wIdx) => (
                    <div
                      key={wIdx}
                      className="flex flex-col"
                      style={{ gap: "3px" }}
                    >
                      {week.map((day, dIdx) => {
                        if (day.hours === -1) {
                          // placeholder cell
                          return (
                            <div
                              key={dIdx}
                              style={{ width: "12px", height: "12px" }}
                            />
                          );
                        }
                        return (
                          <div
                            key={dIdx}
                            style={{
                              width: "12px",
                              height: "12px",
                              borderRadius: "2px",
                              backgroundColor: hoursToColor(day.hours),
                              cursor: day.hours > 0 ? "pointer" : "default",
                              transition: "opacity 0.1s",
                            }}
                            onMouseEnter={(e) => {
                              const rect = (
                                e.target as HTMLDivElement
                              ).getBoundingClientRect();
                              setTooltip({
                                day,
                                x: rect.left,
                                y: rect.top,
                              });
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
                <span>Moins</span>
                {[
                  { color: "#e5e7eb", label: "0h" },
                  { color: "#86efac", label: "1–2h" },
                  { color: "#fde047", label: "3–4h" },
                  { color: "#f87171", label: "5+h" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1">
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "2px",
                        backgroundColor: color,
                      }}
                    />
                    <span>{label}</span>
                  </div>
                ))}
                <span>Plus</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fixed tooltip rendered via a portal-like approach at document level */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none px-2 py-1 rounded bg-popover text-popover-foreground text-xs shadow-md border border-border"
          style={{ top: tooltip.y - 36, left: tooltip.x + 4 }}
        >
          <div className="font-semibold">
            {format(tooltip.day.date, "EEEE d MMMM yyyy", { locale: fr })}
          </div>
          <div className="text-muted-foreground">
            {hoursToLabel(tooltip.day.hours)}
          </div>
        </div>
      )}
    </div>
  );
}
