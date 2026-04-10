"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isToday,
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
  AlertCircle,
  Users,
  UserPlus,
  Filter,
  Calendar,
  Building2,
  Laptop,
  Plane,
  X,
  ShieldCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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

/** Shape returned by the backend team-status endpoint per user */
interface ApiUserPresenceStatus {
  user_id: string;
  display_name: string;
  presence_mode: string;
}

/** Shape returned by the backend headcount endpoint per slot */
interface ApiHeadcountSlot {
  time: string;
  role: string;
  count: number;
}

/** Shape returned by the backend presence rules endpoint */
interface ApiPresenceRule {
  id: string;
  org_id: string;
  team_id?: string;
  rule_type: string;
  rule_config: Record<string, unknown>;
  enforcement?: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
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
    label: "Conge",
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

/** Map backend presence_mode values to our UI status type */
function mapPresenceMode(mode: string): PresenceStatus {
  const normalized = mode.toLowerCase().trim();
  if (
    normalized === "onsite" ||
    normalized === "bureau" ||
    normalized === "office"
  )
    return "bureau";
  if (normalized === "remote" || normalized === "wfh") return "remote";
  if (normalized === "leave" || normalized === "conge") return "conge";
  if (normalized === "absent" || normalized === "off") return "absent";
  return "unknown";
}

// ============================================================================
// Data fetching helpers
// ============================================================================

/**
 * Fetch team status for each weekday in the date range, then aggregate
 * per-user across all days into EmployeePresence objects.
 */
async function fetchTeamStatusForRange(
  days: Date[],
): Promise<EmployeePresence[]> {
  const weekdays = days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
  if (weekdays.length === 0) return [];

  const results = await Promise.allSettled(
    weekdays.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      return presenceApi.teamStatus(dateStr).then((res) => ({
        date: dateStr,
        data: (res.data ?? []) as ApiUserPresenceStatus[],
      }));
    }),
  );

  // Aggregate per-user across all days
  const userMap = new Map<
    string,
    {
      displayName: string;
      presenceByDay: Record<string, PresenceStatus>;
      violationsByDay: Record<string, string[]>;
    }
  >();

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { date, data } = result.value;
    if (!Array.isArray(data)) continue;

    for (const item of data) {
      const userId = String(item.user_id);
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          displayName: item.display_name ?? userId,
          presenceByDay: {},
          violationsByDay: {},
        });
      }
      const entry = userMap.get(userId);
      if (entry) {
        entry.presenceByDay[date] = mapPresenceMode(item.presence_mode);
      }
    }
  }

  // Set weekends as "unknown" for all users
  const weekendDays = days.filter((d) => d.getDay() === 0 || d.getDay() === 6);
  for (const [, entry] of userMap) {
    for (const day of weekendDays) {
      entry.presenceByDay[format(day, "yyyy-MM-dd")] = "unknown";
    }
  }

  return Array.from(userMap.entries()).map(([userId, entry]) => ({
    userId,
    displayName: entry.displayName,
    role: "N/A",
    presenceByDay: entry.presenceByDay,
    violationsByDay: entry.violationsByDay,
  }));
}

/**
 * Fetch headcount for a given date and pivot the flat (time, role, count) rows
 * into the chart-friendly { time, Bureau, Remote } format.
 */
async function fetchHeadcountForDate(
  date: Date,
): Promise<HeadcountDataPoint[]> {
  const dateStr = format(date, "yyyy-MM-dd");
  const res = await presenceApi.headcount(dateStr);
  const slots = (res.data ?? []) as ApiHeadcountSlot[];

  if (!Array.isArray(slots) || slots.length === 0) return [];

  // Pivot: group by time, sum by mapped role
  const byTime = new Map<string, { Bureau: number; Remote: number }>();

  for (const slot of slots) {
    const time = slot.time;
    if (!byTime.has(time)) {
      byTime.set(time, { Bureau: 0, Remote: 0 });
    }
    const entry = byTime.get(time);
    if (!entry) continue;

    const roleLower = slot.role.toLowerCase();
    if (
      roleLower === "onsite" ||
      roleLower === "bureau" ||
      roleLower === "office"
    ) {
      entry.Bureau += slot.count;
    } else if (roleLower === "remote" || roleLower === "wfh") {
      entry.Remote += slot.count;
    } else {
      // Default other roles to Bureau
      entry.Bureau += slot.count;
    }
  }

  return Array.from(byTime.entries())
    .map(([time, counts]) => ({ time, ...counts }))
    .sort((a, b) => a.time.localeCompare(b.time));
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
    return (
      <td className="w-10 h-8 border border-border/30 bg-muted/10 align-middle" />
    );
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
            isCurrentDay && "ring-1 ring-inset ring-primary",
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
        {(
          ["bureau", "remote", "conge", "absent", "unknown"] as PresenceStatus[]
        ).map((s) => (
          <DropdownMenuItem
            key={s}
            className={cn("gap-2 cursor-pointer", s === status && "bg-muted")}
            onClick={() => onStatusChange(employee.userId, date, s)}
          >
            <span
              className={cn(
                "flex items-center gap-1.5",
                STATUS_CONFIG[s].textClass,
              )}
            >
              {STATUS_CONFIG[s].icon}
              {STATUS_CONFIG[s].label}
            </span>
            {s === status && (
              <span className="ml-auto text-primary">&#10003;</span>
            )}
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
          isCurrentDay && "bg-primary/5",
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
        isCurrentDay && "bg-primary/5",
      )}
    >
      {dropdownContent}
    </td>
  );
}

// ============================================================================
// Loading skeletons
// ============================================================================

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, row) => (
        <tr key={row} className="animate-pulse">
          <td className="sticky left-0 z-10 bg-card px-3 py-2 border-r border-border">
            <div className="flex items-center gap-2">
              <Skeleton className="w-6 h-6 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </td>
          <td className="sticky left-40 z-10 bg-card px-2 py-2 border-r border-border">
            <Skeleton className="h-4 w-16" />
          </td>
          {Array.from({ length: columns }).map((_, col) => (
            <td key={col} className="border border-border/50 p-0.5">
              <Skeleton className="w-full h-[32px] rounded-sm" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function HeadcountSkeleton() {
  return (
    <div className="px-4 py-4 space-y-3 animate-pulse">
      <div className="flex gap-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-[140px] w-full rounded" />
    </div>
  );
}

// ============================================================================
// Error state
// ============================================================================

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <AlertCircle className="w-8 h-8 text-destructive" />
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        Reessayer
      </Button>
    </div>
  );
}

// ============================================================================
// Empty state
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <UserPlus className="w-6 h-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">
          Aucun collaborateur configure
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Les donnees de presence apparaitront ici une fois que des membres
          d&apos;equipe auront des evenements de type shift ou leave dans le
          calendrier. Ajoutez des collaborateurs via l&apos;administration.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Rules badge
// ============================================================================

function RulesBadge({ rules }: { rules: ApiPresenceRule[] }) {
  const activeCount = rules.filter((r) => r.active !== false).length;
  if (activeCount === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="h-5 text-[10px] gap-1 cursor-help"
          >
            <ShieldCheck className="w-3 h-3" />
            {activeCount} regle{activeCount > 1 ? "s" : ""}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-64">
          <p className="font-medium mb-1">Regles de presence actives :</p>
          {rules
            .filter((r) => r.active !== false)
            .map((r) => (
              <p key={r.id} className="text-muted-foreground">
                {r.rule_type.replace(/_/g, " ")}{" "}
                {r.enforcement === "hard" ? "(bloquant)" : "(souple)"}
              </p>
            ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
      const bureau = employees.filter(
        (e) => e.presenceByDay[key] === "bureau",
      ).length;
      const remote = employees.filter(
        (e) => e.presenceByDay[key] === "remote",
      ).length;
      const total = bureau + remote;
      return { bureau, remote, total };
    });
  }, [days, employees]);

  return (
    <tr className="bg-muted/40 sticky bottom-0 z-10">
      <td className="sticky left-0 bg-muted/40 z-20 px-3 py-1 text-xs font-semibold text-foreground whitespace-nowrap border-r border-border">
        Total presents
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
              !isWeekend && "text-foreground",
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
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [thresholds] = useState([{ role: "Bureau", min: 4 }]);
  // Local overrides for status changes (optimistic UI before save)
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, Record<string, PresenceStatus>>
  >({});

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

  // Stable key for the date range (first..last date)
  const rangeKey = useMemo(() => {
    if (dateRange.length === 0) return "";
    const first = format(dateRange[0], "yyyy-MM-dd");
    const last = format(dateRange[dateRange.length - 1], "yyyy-MM-dd");
    return `${first}_${last}`;
  }, [dateRange]);

  // ---- React Query: team status ----
  const {
    data: employees = [],
    isLoading: isLoadingEmployees,
    isError: isErrorEmployees,
    refetch: refetchEmployees,
    isFetching: isFetchingEmployees,
  } = useQuery({
    queryKey: ["presence", "team-status", rangeKey],
    queryFn: () => fetchTeamStatusForRange(dateRange),
    staleTime: 2 * 60 * 1000,
    retry: 1,
    meta: { errorMessage: "Impossible de charger le statut de presence" },
  });

  // ---- React Query: headcount ----
  const todayStr = format(currentDate, "yyyy-MM-dd");
  const {
    data: headcountData = [],
    isLoading: isLoadingHeadcount,
    isError: isErrorHeadcount,
    refetch: refetchHeadcount,
  } = useQuery({
    queryKey: ["presence", "headcount", todayStr],
    queryFn: () => fetchHeadcountForDate(currentDate),
    staleTime: 2 * 60 * 1000,
    retry: 1,
    meta: { errorMessage: "Impossible de charger les donnees de headcount" },
  });

  // ---- React Query: presence rules ----
  const { data: presenceRules = [] } = useQuery({
    queryKey: ["presence", "rules"],
    queryFn: async () => {
      const res = await presenceApi.rules();
      return (res.data ?? []) as ApiPresenceRule[];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Merge local overrides into employee data
  const employeesWithOverrides = useMemo(() => {
    if (Object.keys(localOverrides).length === 0) return employees;
    return employees.map((emp) => {
      const overrides = localOverrides[emp.userId];
      if (!overrides) return emp;
      return {
        ...emp,
        presenceByDay: { ...emp.presenceByDay, ...overrides },
      };
    });
  }, [employees, localOverrides]);

  // Derive teams dynamically from fetched data
  const teamOptions: TeamOption[] = useMemo(() => {
    const teams = new Map<string, string>();
    for (const emp of employeesWithOverrides) {
      if (emp.team) {
        teams.set(emp.team, emp.team);
      }
    }
    const options: TeamOption[] = [{ id: "all", label: "Toutes les equipes" }];
    for (const [id] of teams) {
      options.push({ id, label: id.replace(/^team-/, "").replace(/-/g, " ") });
    }
    return options;
  }, [employeesWithOverrides]);

  // Filter employees by team
  const filteredEmployees = useMemo(() => {
    if (selectedTeam === "all") return employeesWithOverrides;
    return employeesWithOverrides.filter((e) => e.team === selectedTeam);
  }, [employeesWithOverrides, selectedTeam]);

  const loading = isLoadingEmployees || isFetchingEmployees;

  // Navigation
  const goPrev = () => {
    setLocalOverrides({});
    if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() - 1);
      setCurrentDate(d);
    }
  };

  const goNext = () => {
    setLocalOverrides({});
    if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() + 1);
      setCurrentDate(d);
    }
  };

  const goToday = () => {
    setLocalOverrides({});
    setCurrentDate(new Date());
  };

  // Refresh all data
  const handleRefresh = useCallback(() => {
    setLocalOverrides({});
    refetchEmployees();
    refetchHeadcount();
    toast.info("Actualisation des donnees...");
  }, [refetchEmployees, refetchHeadcount]);

  // Status change (optimistic local override)
  const handleStatusChange = useCallback(
    (userId: string, date: Date, status: PresenceStatus) => {
      const key = format(date, "yyyy-MM-dd");
      setLocalOverrides((prev) => ({
        ...prev,
        [userId]: {
          ...(prev[userId] ?? {}),
          [key]: status,
        },
      }));
    },
    [],
  );

  // Compute today's status counts for legend
  const statusCounts = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const counts: Record<PresenceStatus, number> = {
      bureau: 0,
      remote: 0,
      conge: 0,
      absent: 0,
      unknown: 0,
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
          <span className="text-sm font-medium capitalize ml-1">
            {rangeLabel}
          </span>
          <RulesBadge rules={presenceRules} />
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
                      cfg.borderClass,
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
              {teamOptions.map((t) => (
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
                onClick={() => {
                  setViewMode(mode);
                  setLocalOverrides({});
                }}
                className={cn(
                  "px-2 text-xs font-medium transition-colors",
                  viewMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-muted",
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
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw
              className={cn("w-3 h-3 mr-1", loading && "animate-spin")}
            />
            Actualiser
          </Button>
        </div>
      </div>

      {/* ================================================================
          TOP PANEL (40%): Headcount step-chart
      ================================================================ */}
      <div
        className="shrink-0 border-b border-border bg-card"
        style={{ height: "40%" }}
      >
        <div className="px-4 pt-2 pb-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Users className="w-4 h-4 text-muted-foreground" />
              Headcount par mode de presence
            </h3>
            <span className="text-xs text-muted-foreground">
              {loading
                ? "Chargement..."
                : `${filteredEmployees.length} personnes`}
            </span>
          </div>
        </div>
        {isLoadingHeadcount ? (
          <HeadcountSkeleton />
        ) : isErrorHeadcount ? (
          <ErrorState
            message="Impossible de charger les donnees de headcount."
            onRetry={() => refetchHeadcount()}
          />
        ) : (
          <HeadcountChart
            data={headcountData}
            roles={headcountRoles}
            thresholds={thresholds}
            height={160}
            className="px-2"
          />
        )}
      </div>

      {/* ================================================================
          BOTTOM PANEL (60%): Presence grid
      ================================================================ */}
      <div className="flex-1 flex flex-col min-h-0">
        {isErrorEmployees ? (
          <ErrorState
            message="Impossible de charger le statut de presence des collaborateurs."
            onRetry={() => refetchEmployees()}
          />
        ) : (
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
                      Role
                    </th>
                    {dateRange.map((day) => {
                      const isWeekend =
                        day.getDay() === 0 || day.getDay() === 6;
                      const isCurDay = isToday(day);
                      return (
                        <th
                          key={day.toISOString()}
                          className={cn(
                            "text-center py-1 px-0.5 font-medium whitespace-nowrap w-10 border border-border/30",
                            isWeekend && "bg-muted/20 text-muted-foreground/60",
                            isCurDay && "bg-primary/10 text-primary",
                          )}
                        >
                          <div className="text-[10px] leading-tight">
                            {format(day, "EEE", { locale: fr }).slice(0, 3)}
                          </div>
                          <div
                            className={cn(
                              "font-bold",
                              isCurDay ? "text-primary" : "text-foreground",
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
                  {isLoadingEmployees ? (
                    <TableSkeleton columns={dateRange.length} />
                  ) : filteredEmployees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={dateRange.length + 2}
                        className="text-center"
                      >
                        <EmptyState />
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
                                      .reduce(
                                        (a, c) => a + c.charCodeAt(0),
                                        0,
                                      ) % 360
                                  }, 55%, 48%)`,
                                }}
                              >
                                {emp.displayName
                                  .split(" ")
                                  .map((w) => w[0])
                                  .join("")
                                  .slice(0, 2)}
                              </div>
                              <span className="truncate max-w-28">
                                {emp.displayName}
                              </span>
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
                            const isWeekend =
                              day.getDay() === 0 || day.getDay() === 6;
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
                      <SummaryRow
                        days={dateRange}
                        employees={filteredEmployees}
                      />
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        )}

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
                    cfg.textClass,
                  )}
                >
                  {cfg.icon}
                </div>
                <span className="text-muted-foreground">{cfg.label}</span>
              </div>
            ))}
          <div className="flex items-center gap-1.5 text-xs ml-auto">
            <div className="w-3 h-3 rounded-sm ring-1 ring-red-500" />
            <span className="text-muted-foreground">Violation de regle</span>
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
