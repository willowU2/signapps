"use client";

import { SpinnerInfinity } from "spinners-react";

/**
 * Validation Dashboard Component
 *
 * Displays coverage gaps, conflicts, and validation results.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Calendar,
  Users,
  Clock,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { validationApi } from "@/lib/api/workforce";
import type {
  OrgNodeWithStats,
  CoverageGap,
  GapSeverity,
  ValidateCoverageResponse,
} from "@/types/workforce";

// Severity configurations
const SEVERITY_CONFIG: Record<
  GapSeverity,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    label: string;
  }
> = {
  critical: { icon: AlertCircle, color: "text-destructive", label: "Critique" },
  high: { icon: AlertTriangle, color: "text-orange-500", label: "Élevé" },
  medium: { icon: Info, color: "text-yellow-500", label: "Moyen" },
  low: { icon: Info, color: "text-blue-500", label: "Faible" },
};

// Day names
const DAYS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

interface ValidationDashboardProps {
  orgNodeId?: string;
  onSelectNode?: (node: OrgNodeWithStats) => void;
  className?: string;
}

export function ValidationDashboard({
  orgNodeId,
  onSelectNode,
  className,
}: ValidationDashboardProps) {
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

  // Validation query
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      "workforce",
      "validation",
      orgNodeId,
      format(weekStart, "yyyy-MM-dd"),
    ],
    queryFn: () =>
      validationApi.validateCoverage({
        org_node_id: orgNodeId || "",
        date_from: format(weekStart, "yyyy-MM-dd"),
        date_to: format(weekEnd, "yyyy-MM-dd"),
        include_descendants: true,
      }),
    enabled: !!orgNodeId,
  });

  const validation = data?.data;

  // Navigate weeks
  const goToPreviousWeek = () => setSelectedDate(addDays(selectedDate, -7));
  const goToNextWeek = () => setSelectedDate(addDays(selectedDate, 7));
  const goToToday = () => setSelectedDate(new Date());

  // Group gaps by day
  const gapsByDay = React.useMemo(() => {
    if (!validation?.gaps) return {};

    return validation.gaps.reduce(
      (acc, gap) => {
        const day = gap.day_of_week;
        if (!acc[day]) acc[day] = [];
        acc[day].push(gap);
        return acc;
      },
      {} as Record<number, CoverageGap[]>,
    );
  }, [validation?.gaps]);

  if (!orgNodeId) {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Sélectionnez une unité</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Choisissez une unité organisationnelle pour voir la validation de
            couverture
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Validation de Couverture</h2>
          <p className="text-sm text-muted-foreground">
            Semaine du {format(weekStart, "d MMMM", { locale: fr })} au{" "}
            {format(weekEnd, "d MMMM yyyy", { locale: fr })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Aujourd'hui
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("h-4 w-4", isFetching && "animate-spin")}
            />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      ) : validation ? (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Couverture
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(validation.summary.coverage_percentage)}%
                </div>
                <Progress
                  value={validation.summary.coverage_percentage}
                  className="mt-2 h-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Créneaux</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {validation.summary.covered_slots}/
                  {validation.summary.total_slots}
                </div>
                <p className="text-xs text-muted-foreground">
                  Créneaux couverts
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gaps</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {validation.summary.gap_count}
                </div>
                <p className="text-xs text-muted-foreground">
                  {validation.summary.critical_gaps} critiques,{" "}
                  {validation.summary.high_gaps} élevés
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Sur-effectif
                </CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-500">
                  {validation.summary.overstaffed_count}
                </div>
                <p className="text-xs text-muted-foreground">
                  Créneaux en sureffectif
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gap Details by Day */}
          <Card>
            <CardHeader>
              <CardTitle>Détail des Gaps</CardTitle>
              <CardDescription>
                Vue par jour des créneaux non couverts ou insuffisants
              </CardDescription>
            </CardHeader>
            <CardContent>
              {validation.gaps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <p className="mt-4 text-lg font-medium">
                    Couverture complète
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tous les créneaux sont couverts pour cette semaine
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
                      const dayGaps = gapsByDay[dayOfWeek];
                      if (!dayGaps || dayGaps.length === 0) return null;

                      return (
                        <div key={dayOfWeek} className="space-y-2">
                          <h4 className="text-sm font-medium">
                            {DAYS[dayOfWeek]}
                          </h4>
                          <div className="space-y-2 pl-4">
                            {dayGaps.map((gap, idx) => {
                              const config = SEVERITY_CONFIG[gap.severity];
                              const Icon = config.icon;

                              return (
                                <div
                                  key={idx}
                                  className="flex items-start gap-3 rounded-lg border p-3"
                                >
                                  <Icon
                                    className={cn(
                                      "mt-0.5 h-4 w-4",
                                      config.color,
                                    )}
                                  />
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium">
                                        {gap.slot_label ||
                                          `${gap.start_time} - ${gap.end_time}`}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={cn("text-xs", config.color)}
                                      >
                                        {config.label}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {gap.start_time} - {gap.end_time}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        {gap.assigned_employees}/
                                        {gap.required_employees} assignés
                                      </span>
                                    </div>
                                    {gap.missing_functions.length > 0 && (
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {gap.missing_functions.map((fn) => (
                                          <Badge
                                            key={fn}
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            {fn}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <SpinnerInfinity
              size={24}
              secondaryColor="rgba(128,128,128,0.2)"
              color="currentColor"
              speed={120}
              className="mx-auto h-8 w-8  text-muted-foreground"
            />
            <p className="mt-2 text-sm text-muted-foreground">Chargement...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export type { ValidationDashboardProps };
