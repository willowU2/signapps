"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isToday,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Users,
  Filter,
  Calendar,
  Building2,
  Laptop,
  Plane,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCalendarStore } from "@/stores/calendar-store";
import { presenceApi } from "@/lib/api/calendar";
import HeadcountChart from "./HeadcountChart";

// ============================================================================
// Types
// ============================================================================

type PresenceStatus = "bureau" | "remote" | "absent" | "conge" | "unknown";

interface EmployeePresence {
  userId: string;
  displayName: string;
  role: string;
  team?: string;
  department?: string;
  presenceByDay: Record<string, PresenceStatus>; // ISO date -> status
  violationsByDay: Record<string, string[]>; // ISO date -> violation messages
}

interface HeadcountDataPoint {
  time: string;
  Bureau: number;
  Remote: number;
  [role: string]: number | string;
}

interface TeamOption {
  id: string;
  label: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG: Record<
  PresenceStatus,
  {
    label: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    icon: React.ReactNode;
  }
> = {
  bureau: {
    label: "Bureau",
    bgClass: "bg-emerald-100 dark:bg-emerald-950/60",
    textClass: "text-emerald-800 dark:text-emerald-300",
    borderClass: "border-emerald-200 dark:border-emerald-800",
    icon: <Building2 className="w-3 h-3" />,
  },
  remote: {
    label: "Remote",
    bgClass: "bg-blue-100 dark:bg-blue-950/60",
    textClass: "text-blue-800 dark:text-blue-300",
    borderClass: "border-blue-200 dark:border-blue-800",
    icon: <Laptop className="w-3 h-3" />,
  },
  conge: {
    label: "Congé",
    bgClass: "bg-orange-100 dark:bg-orange-950/60",
    textClass: "text-orange-800 dark:text-orange-300",
    borderClass: "border-orange-200 dark:border-orange-800",
    icon: <Plane className="w-3 h-3" />,
  },
  absent: {
    label: "Absent",
    bgClass: "bg-red-100 dark:bg-red-950/60",
    textClass: "text-red-800 dark:text-red-300",
    borderClass: "border-red-200 dark:border-red-800",
    icon: <X className="w-3 h-3" />,
  },
  unknown: {
    label: "-",
    bgClass: "bg-muted/30",
    textClass: "text-muted-foreground",
    borderClass: "border-border",
    icon: null,
  },
};

// ============================================================================
// Mock data generators
// ============================================================================

const MOCK_EMPLOYEES = [
  { id: "usr-001", name: "Alice Martin", role: "Développeur", team: "team-frontend", department: "Engineering" },
  { id: "usr-002", name: "Bob Dupont", role: "Développeur", team: "team-frontend", department: "Engineering" },
  { id: "usr-003", name: "Claire Leroy", role: "Manager", team: "team-frontend", department: "Engineering" },
  { id: "usr-004", name: "David Bernard", role: "Commercial", team: "team-sales", department: "Sales" },
  { id: "usr-005", name: "Emma Petit", role: "RH", team: "team-hr", department: "HR" },
  { id: "usr-006", name: "François Moreau", role: "Support", team: "team-support", department: "Support" },
  { id: "usr-007", name: "Gaëlle Simon", role: "Développeur", team: "team-backend", department: "Engineering" },
  { id: "usr-008", name: "Hugo Laurent", role: "Développeur", team: "team-backend", department: "Engineering" },
  { id: "usr-009", name: "Isabelle Roux", role: "Manager", team: "team-backend", department: "Engineering" },
  { id: "usr-010", name: "Jean Fournier", role: "Direction", team: "team-exec", department: "Direction" },
];

const MOCK_TEAMS: TeamOption[] = [
  { id: "all", label: "Toutes les équipes" },
  { id: "team-frontend", label: "Frontend" },
  { id: "team-backend", label: "Backend" },
  { id: "team-sales", label: "Commercial" },
  { id: "team-hr", label: "RH" },
  { id: "team-support", label: "Support" },
  { id: "team-exec", label: "Direction" },
];

function generateMockPresence(
  employeeId: string,
  days: Date[]
): {
  presenceByDay: Record<string, PresenceStatus>;
  violationsByDay: Record<string, string[]>;
} {
  const hash = employeeId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const presenceByDay: Record<string, PresenceStatus> = {};
  const violationsByDay: Record<string, string[]> = {};

  days.forEach((day, i) => {
    const dayOfWeek = day.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      presenceByDay[format(day, "yyyy-MM-dd")] = "unknown";
      return;
    }

    const idx = (hash + i * 3) % 10;
    let status: PresenceStatus;
    if (idx < 5) status = "bureau";
    else if (idx < 7) status = "remote";
    else if (idx === 7) status = "conge";
    else if (idx === 8) status = "absent";
    else status = "remote";

    const key = format(day, "yyyy-MM-dd");
    presenceByDay[key] = status;

    if (idx === 9) {
      violationsByDay[key] = ["Présence bureau requise (règle équipe)"];
    }
  });

  return { presenceByDay, violationsByDay };
}

function generateMockHeadcount(): HeadcountDataPoint[] {
  const hours = [
    "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
  ];

  return hours.map((time) => {
    const h = parseInt(time.split(":")[0] ?? "9", 10);
    const peak = (h >= 9 && h <= 11) || (h >= 14 && h <= 16);
    const bureauBase = peak ? 6 : 2;
    const remoteBase = peak ? 3 : 1;
    // Deterministic pseudo-random based on hour
    const bureauCount = bureauBase + ((h * 7) % 3);
    const remoteCount = remoteBase + ((h * 5) % 2);
    return { time, Bureau: bureauCount, Remote: remoteCount };
  });
}

// ============================================================================
// Presence Cell
// ============================================================================

interface PresenceCellProps {
  status: PresenceStatus;
  date: Date;
  employee: EmployeePresence;
  violations: string[];
  onStatusChange: (userId: string, date: Date, status: PresenceStatus) => void;
  isWeekend: boolean;
}

function PresenceCell({
  status,
  date,
  employee,
  violations,
  onStatusChange,
  isWeekend,
}: PresenceCellProps) {
  const cfg = STATUS_CONFIG[status];
  const hasViolation = violations.length > 0;
  const isCurrentDay = isToday(date);

  if (isWeekend) {
    return <td className="w-10 h-8 border border-border/30 bg-muted/10 align-middle" />;
  }

  const dropdownContent = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "w-full h-full min-h-[32px] flex items-center justify-center gap-0.5 text-[10px] font-medium transition-opacity hover:opacity-80 rounded-sm",
            cfg.bgClass,
            cfg.textClass,
            hasViolation && "ring-1 ring-inset ring-red-500",
            isCurrentDay && "ring-1 ring-inset ring-primary"
          )}
          title={`${employee.displayName} - ${format(date, "d MMM", { locale: fr })}`}
        >
          {cfg.icon}
          <span className="sr-only">{cfg.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="text-xs w-36">
        <div className="px-2 py-1 text-muted-foreground text-[10px] font-medium border-b border-border mb-1">
          {format(date, "d MMM", { locale: fr })}
        </div>
        {(["bureau", "remote", "conge", "absent", "unknown"] as PresenceStatus[]).map((s) => (
          <DropdownMenuItem
            key={s}
            className={cn("gap-2 cursor-pointer", s === status && "bg-muted")}
            onClick={() => onStatusChange(employee.userId, date, s)}
          >
            <span className={cn("flex items-center gap-1.5", STATUS_CONFIG[s].textClass)}>
              {STATUS_CONFIG[s].icon}
              {STATUS_CONFIG[s].label}
            </span>
            {s === status && <span className="ml-auto text-primary">&#10003;</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (hasViolation) {
    return (
      <td
        className={cn(
          "border border-border/50 p-0.5 align-middle",
          isCurrentDay && "bg-primary/5"
        )}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                {dropdownContent}
                <AlertTriangle className="absolute top-0 right-0 w-2.5 h-2.5 text-red-500 pointer-events-none" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-48">
              <p className="font-medium text-red-600 mb-1">Violations :</p>
              {violations.map((v, i) => (
                <p key={i} className="text-muted-foreground">
                  {v}
                </p>
              ))}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </td>
    );
  }

  return (
    <td
      className={cn(
        "border border-border/50 p-0.5 align-middle",
        isCurrentDay && "bg-primary/5"
      )}
    >
      {dropdownContent}
    </td>
  );
}

// ============================================================================
// Summary row
// ============================================================================

interface SummaryRowProps {
  days: Date[];
  employees: EmployeePresence[];
}

function SummaryRow({ days, employees }: SummaryRowProps) {
  const counts = useMemo(() => {
    return days.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const bureau = employees.filter((e) => e.presenceByDay[key] === "bureau").length;
      const remote = employees.filter((e) => e.presenceByDay[key] === "remote").length;
      const absent = employees.filter(
        (e) => e.presenceByDay[key] === "absent" || e.presenceByDay[key] === "conge"
      ).length;
      const total = bureau + remote;
      return { bureau, remote, absent, total };
    });
  }, [days, employees]);

  return (
    <tr className="bg-muted/40 sticky bottom-0 z-10">
      <td className="sticky left-0 bg-muted/40 z-20 px-3 py-1 text-xs font-semibold text-foreground whitespace-nowrap border-r border-border">
        Total présents
      </td>
      <td className="sticky left-40 bg-muted/40 z-20 px-2 py-1 text-xs text-muted-foreground border-r border-border" />
      {days.map((day, i) => {
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        return (
          <td
            key={i}
            className={cn(
              "text-center text-[10px] font-medium border border-border/50 py-0.5",
              isWeekend && "bg-muted/10 text-muted-foreground/50",
              !isWeekend && "text-foreground"
            )}
          >
            {!isWeekend && (
              <span className="text-emerald-600 dark:text-emerald-400">
                {counts[i]?.total ?? 0}
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

// ============================================================================
// Main PresenceTableView
// ============================================================================

export default function PresenceTableView() {
  const { currentDate, setCurrentDate } = useCalendarStore();

  const [employees, setEmployees] = useState<EmployeePresence[]>([]);
  const [headcountData, setHeadcountData] = useState<HeadcountDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [thresholds] = useState([{ role: "Bureau", min: 4 }]);

  // Compute date range
  const dateRange = useMemo(() => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    }
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate, viewMode]);

  // Filter employees by team
  const filteredEmployees = useMemo(() => {
    if (selectedTeam === "all") return employees;
    return employees.filter((e) => e.team === selectedTeam);
  }, [employees, selectedTeam]);

  // Fetch presence data
  const fetchData = useCallback(async () => {
    setLoading(true);
    const dateStr = format(currentDate, "yyyy-MM-dd");

    let teamStatusData: EmployeePresence[] | null = null;
    let headcountRaw: HeadcountDataPoint[] | null = null;

    try {
      const [statusRes, headRes] = await Promise.allSettled([
        presenceApi.teamStatus(dateStr),
        presenceApi.headcount(dateStr),
      ]);

      if (statusRes.status === "fulfilled" && statusRes.value?.data) {
        const apiData = statusRes.value.data as unknown[];
        if (Array.isArray(apiData) && apiData.length > 0) {
          teamStatusData = apiData.map((item: any) => ({
            userId: item.user_id,
            displayName: item.display_name ?? item.user_id,
            role: item.role ?? "N/A",
            team: item.team_id,
            department: item.department,
            presenceByDay: item.presence_by_day ?? {},
            violationsByDay: item.violations_by_day ?? {},
          }));
        }
      }

      if (headRes.status === "fulfilled" && headRes.value?.data) {
        const hData = headRes.value.data as unknown[];
        if (Array.isArray(hData) && hData.length > 0) {
          headcountRaw = hData.map((p: any) => ({
            time: p.time,
            Bureau: p.bureau ?? 0,
            Remote: p.remote ?? 0,
          }));
        }
      }
    } catch {
      // Fall through to mock
    }

    // Use mock data if API returned nothing
    if (!teamStatusData) {
      teamStatusData = MOCK_EMPLOYEES.map((emp) => {
        const { presenceByDay, violationsByDay } = generateMockPresence(emp.id, dateRange);
        return {
          userId: emp.id,
          displayName: emp.name,
          role: emp.role,
          team: emp.team,
          department: emp.department,
          presenceByDay,
          violationsByDay,
        };
      });
    }

    if (!headcountRaw) {
      headcountRaw = generateMockHeadcount();
    }

    setEmployees(teamStatusData);
    setHeadcountData(headcountRaw);
    setLoading(false);
  }, [currentDate, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Navigation
  const goPrev = () => {
    if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() - 1);
      setCurrentDate(d);
    }
  };

  const goNext = () => {
    if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() + 1);
      setCurrentDate(d);
    }
  };

  const goToday = () => setCurrentDate(new Date());

  // Status change
  const handleStatusChange = useCallback(
    (userId: string, date: Date, status: PresenceStatus) => {
      const key = format(date, "yyyy-MM-dd");
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.userId === userId
            ? { ...emp, presenceByDay: { ...emp.presenceByDay, [key]: status } }
            : emp
        )
      );
    },
    []
  );

  // Compute today's status counts for legend
  const statusCounts = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const counts: Record<PresenceStatus, number> = {
      bureau: 0, remote: 0, conge: 0, absent: 0, unknown: 0,
    };
    for (const emp of filteredEmployees) {
      const s = emp.presenceByDay[today] ?? "unknown";
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [filteredEmployees]);

  // Date range label
  const rangeLabel = useMemo(() => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `Semaine du ${format(start, "d MMM", { locale: fr })} au ${format(end, "d MMM yyyy", { locale: fr })}`;
    }
    return format(currentDate, "MMMM yyyy", { locale: fr });
  }, [currentDate, viewMode]);

  const headcountRoles = ["Bureau", "Remote"];

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* ================================================================
          TOOLBAR
      ================================================================ */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Aujourd&apos;hui
          </Button>
          <Button variant="outline" size="sm" onClick={goNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium capitalize ml-1">{rangeLabel}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status legend (desktop only) */}
          <div className="hidden md:flex items-center gap-2 mr-2">
            {(
              Object.entries(STATUS_CONFIG) as Array<
                [PresenceStatus, (typeof STATUS_CONFIG)[PresenceStatus]]
              >
            )
              .filter(([k]) => k !== "unknown")
              .map(([status, cfg]) => (
                <div key={status} className="flex items-center gap-1 text-xs">
                  <div
                    className={cn(
                      "w-3 h-3 rounded-sm border",
                      cfg.bgClass,
                      cfg.borderClass
                    )}
                  />
                  <span className="text-muted-foreground">{cfg.label}</span>
                  <span className="font-medium text-foreground">
                    {statusCounts[status] ?? 0}
                  </span>
                </div>
              ))}
          </div>

          {/* Team filter */}
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="h-7 text-xs w-36">
              <Filter className="w-3 h-3 mr-1 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MOCK_TEAMS.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View mode toggle */}
          <div className="flex rounded-md border border-border overflow-hidden h-7">
            {(["week", "month"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-2 text-xs font-medium transition-colors",
                  viewMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-muted"
                )}
              >
                {mode === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={cn("w-3 h-3 mr-1", loading && "animate-spin")} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* ================================================================
          TOP PANEL (40%): Headcount step-chart
      ================================================================ */}
      <div className="shrink-0 border-b border-border bg-card" style={{ height: "40%" }}>
        <div className="px-4 pt-2 pb-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Users className="w-4 h-4 text-muted-foreground" />
              Headcount par mode de présence
            </h3>
            <span className="text-xs text-muted-foreground">
              {loading ? "Chargement..." : `${filteredEmployees.length} personnes`}
            </span>
          </div>
        </div>
        <HeadcountChart
          data={headcountData}
          roles={headcountRoles}
          thresholds={thresholds}
          height={160}
          className="px-2"
        />
      </div>

      {/* ================================================================
          BOTTOM PANEL (60%): Presence grid
      ================================================================ */}
      <div className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1">
          <div className="min-w-max">
            <table className="w-full border-collapse text-xs">
              {/* Column headers */}
              <thead className="sticky top-0 z-20">
                <tr className="bg-card border-b border-border">
                  <th className="sticky left-0 z-30 bg-card text-left px-3 py-2 font-semibold text-foreground whitespace-nowrap min-w-40 border-r border-border">
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      Collaborateur
                    </div>
                  </th>
                  <th className="sticky left-40 z-30 bg-card text-left px-2 py-2 font-semibold text-foreground whitespace-nowrap w-24 border-r border-border">
                    Rôle
                  </th>
                  {dateRange.map((day) => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isCurDay = isToday(day);
                    return (
                      <th
                        key={day.toISOString()}
                        className={cn(
                          "text-center py-1 px-0.5 font-medium whitespace-nowrap w-10 border border-border/30",
                          isWeekend && "bg-muted/20 text-muted-foreground/60",
                          isCurDay && "bg-primary/10 text-primary"
                        )}
                      >
                        <div className="text-[10px] leading-tight">
                          {format(day, "EEE", { locale: fr }).slice(0, 3)}
                        </div>
                        <div
                          className={cn(
                            "font-bold",
                            isCurDay ? "text-primary" : "text-foreground"
                          )}
                        >
                          {format(day, "d")}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={dateRange.length + 2}
                      className="text-center py-12 text-muted-foreground"
                    >
                      {loading
                        ? "Chargement des données..."
                        : "Aucun collaborateur à afficher"}
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredEmployees.map((emp) => (
                      <tr
                        key={emp.userId}
                        className="hover:bg-muted/30 transition-colors group"
                      >
                        {/* Name */}
                        <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/30 px-3 py-1 whitespace-nowrap border-r border-border font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                              style={{
                                backgroundColor: `hsl(${
                                  emp.userId
                                    .split("")
                                    .reduce((a, c) => a + c.charCodeAt(0), 0) % 360
                                }, 55%, 48%)`,
                              }}
                            >
                              {emp.displayName
                                .split(" ")
                                .map((w) => w[0])
                                .join("")
                                .slice(0, 2)}
                            </div>
                            <span className="truncate max-w-28">{emp.displayName}</span>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="sticky left-40 z-10 bg-card group-hover:bg-muted/30 px-2 py-1 border-r border-border">
                          <Badge
                            variant="outline"
                            className="text-[10px] h-4 px-1 whitespace-nowrap"
                          >
                            {emp.role}
                          </Badge>
                        </td>

                        {/* Presence cells */}
                        {dateRange.map((day) => {
                          const key = format(day, "yyyy-MM-dd");
                          const status = emp.presenceByDay[key] ?? "unknown";
                          const violations = emp.violationsByDay[key] ?? [];
                          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                          return (
                            <PresenceCell
                              key={key}
                              status={status}
                              date={day}
                              employee={emp}
                              violations={violations}
                              onStatusChange={handleStatusChange}
                              isWeekend={isWeekend}
                            />
                          );
                        })}
                      </tr>
                    ))}

                    {/* Summary row */}
                    <SummaryRow days={dateRange} employees={filteredEmployees} />
                  </>
                )}
              </tbody>
            </table>
          </div>
        </ScrollArea>

        {/* Footer legend */}
        <div className="flex items-center gap-4 px-4 py-1.5 border-t border-border bg-muted/20 shrink-0 flex-wrap">
          {(
            Object.entries(STATUS_CONFIG) as Array<
              [PresenceStatus, (typeof STATUS_CONFIG)[PresenceStatus]]
            >
          )
            .filter(([k]) => k !== "unknown")
            .map(([status, cfg]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs">
                <div
                  className={cn(
                    "w-4 h-4 rounded-sm border flex items-center justify-center",
                    cfg.bgClass,
                    cfg.borderClass,
                    cfg.textClass
                  )}
                >
                  {cfg.icon}
                </div>
                <span className="text-muted-foreground">{cfg.label}</span>
              </div>
            ))}
          <div className="flex items-center gap-1.5 text-xs ml-auto">
            <div className="w-3 h-3 rounded-sm ring-1 ring-red-500" />
            <span className="text-muted-foreground">Violation de règle</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar className="w-3 h-3 text-primary" />
            <span className="text-muted-foreground">Aujourd&apos;hui</span>
          </div>
        </div>
      </div>
    </div>
  );
}
