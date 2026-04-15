"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlaTicket {
  id: string;
  title: string;
  priority: "critical" | "high" | "medium" | "low";
  createdAt: string;
  resolvedAt?: string;
  status: "open" | "in_progress" | "resolved" | "closed";
}

export interface SlaPolicy {
  priority: "critical" | "high" | "medium" | "low";
  responseMinutes: number; // time to first response
  resolutionMinutes: number; // time to close
}

type SlaStatus = "met" | "breached" | "approaching" | "open";

interface TicketSla {
  ticket: SlaTicket;
  policy: SlaPolicy;
  responseStatus: SlaStatus;
  resolutionStatus: SlaStatus;
  responseRemainingMin: number;
  resolutionRemainingMin: number;
  resolutionPct: number; // % of SLA time elapsed
}

// ─── Default policies ─────────────────────────────────────────────────────────

export const DEFAULT_SLA_POLICIES: SlaPolicy[] = [
  { priority: "critical", responseMinutes: 15, resolutionMinutes: 240 },
  { priority: "high", responseMinutes: 60, resolutionMinutes: 480 },
  { priority: "medium", responseMinutes: 240, resolutionMinutes: 1440 },
  { priority: "low", responseMinutes: 480, resolutionMinutes: 4320 },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-600 border-red-500/20",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  low: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

// ─── Compute SLA state ────────────────────────────────────────────────────────

function computeSla(
  ticket: SlaTicket,
  policy: SlaPolicy,
  now: Date,
): TicketSla {
  const created = new Date(ticket.createdAt).getTime();
  const resolved = ticket.resolvedAt
    ? new Date(ticket.resolvedAt).getTime()
    : null;
  const nowMs = now.getTime();

  const elapsedMin = (nowMs - created) / 60000;
  const resolutionRemainingMin = policy.resolutionMinutes - elapsedMin;
  const resolutionPct = Math.min(
    (elapsedMin / policy.resolutionMinutes) * 100,
    100,
  );

  let resolutionStatus: SlaStatus;
  if (resolved) {
    const resolvedElapsed = (resolved - created) / 60000;
    resolutionStatus =
      resolvedElapsed <= policy.resolutionMinutes ? "met" : "breached";
  } else if (resolutionRemainingMin < 0) {
    resolutionStatus = "breached";
  } else if (resolutionPct >= 80) {
    resolutionStatus = "approaching";
  } else {
    resolutionStatus = "open";
  }

  return {
    ticket,
    policy,
    responseStatus: "open", // Simplified — no response timestamp available
    resolutionStatus,
    responseRemainingMin: policy.responseMinutes - elapsedMin,
    resolutionRemainingMin,
    resolutionPct,
  };
}

function fmtRemaining(min: number): string {
  if (min < 0) return `Depasse de ${Math.abs(Math.round(min))} min`;
  if (min < 60) return `${Math.round(min)} min restantes`;
  if (min < 1440) return `${Math.round(min / 60)} h restantes`;
  return `${Math.round(min / 1440)} j restants`;
}

const STATUS_META: Record<SlaStatus, { badge: string; icon: React.ReactNode }> =
  {
    met: {
      badge: "bg-emerald-500/10 text-emerald-600",
      icon: <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />,
    },
    breached: {
      badge: "bg-red-500/10 text-red-600",
      icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
    },
    approaching: {
      badge: "bg-orange-500/10 text-orange-600",
      icon: <Clock className="h-3.5 w-3.5 text-orange-500" />,
    },
    open: {
      badge: "bg-muted text-muted-foreground",
      icon: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
    },
  };

const STATUS_LABEL: Record<SlaStatus, string> = {
  met: "Respecte",
  breached: "Depasse",
  approaching: "Proche limite",
  open: "En cours",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface SlaTrackerProps {
  tickets: SlaTicket[];
  policies?: SlaPolicy[];
}

export function SlaTracker({
  tickets,
  policies = DEFAULT_SLA_POLICIES,
}: SlaTrackerProps) {
  const now = new Date();

  const slaData = useMemo(
    () =>
      tickets.map((ticket) => {
        const policy =
          policies.find((p) => p.priority === ticket.priority) ?? policies[2];
        return computeSla(ticket, policy, now);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tickets, policies],
  );

  const met = slaData.filter((s) => s.resolutionStatus === "met").length;
  const breached = slaData.filter(
    (s) => s.resolutionStatus === "breached",
  ).length;
  const approaching = slaData.filter(
    (s) => s.resolutionStatus === "approaching",
  ).length;
  const open = slaData.filter((s) => s.resolutionStatus === "open").length;
  const total = slaData.length;
  const compliance =
    total > 0 ? Math.round(((met + open + approaching) / total) * 100) : 100;

  // Chart data by priority
  const chartData = ["critical", "high", "medium", "low"].map((prio) => {
    const group = slaData.filter((s) => s.ticket.priority === prio);
    return {
      name: prio.charAt(0).toUpperCase() + prio.slice(1),
      Respectes: group.filter((s) => s.resolutionStatus === "met").length,
      "En cours": group.filter((s) =>
        ["open", "approaching"].includes(s.resolutionStatus),
      ).length,
      Depasses: group.filter((s) => s.resolutionStatus === "breached").length,
    };
  });

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "Conformite",
            value: `${compliance}%`,
            cls: "text-emerald-600",
          },
          { label: "Respectes", value: met, cls: "text-emerald-600" },
          { label: "Critiques", value: breached, cls: "text-red-600" },
          { label: "Proches", value: approaching, cls: "text-orange-600" },
        ].map(({ label, value, cls }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold ${cls}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-primary" />
            Conformite SLA par priorite
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="Respectes" fill="#10b981" radius={[2, 2, 0, 0]} />
              <Bar dataKey="En cours" fill="#94a3b8" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Depasses" fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Ticket list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-primary" />
            Tickets avec SLA ({total})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {slaData.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              Aucun ticket
            </p>
          ) : (
            <div className="divide-y">
              {slaData
                .sort((a, b) => {
                  const order: Record<SlaStatus, number> = {
                    breached: 0,
                    approaching: 1,
                    open: 2,
                    met: 3,
                  };
                  return order[a.resolutionStatus] - order[b.resolutionStatus];
                })
                .map(
                  ({
                    ticket,
                    resolutionStatus,
                    resolutionRemainingMin,
                    resolutionPct,
                  }) => {
                    const statusMeta = STATUS_META[resolutionStatus];
                    return (
                      <div
                        key={ticket.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        {statusMeta.icon}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium truncate">
                              {ticket.title}
                            </span>
                            <Badge
                              className={`text-xs shrink-0 ${PRIORITY_COLORS[ticket.priority]}`}
                            >
                              {ticket.priority}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={resolutionPct}
                              className="h-1.5 flex-1"
                            />
                            <span className="text-xs text-muted-foreground shrink-0 w-32 text-right">
                              {fmtRemaining(resolutionRemainingMin)}
                            </span>
                          </div>
                        </div>
                        <Badge
                          className={`text-xs shrink-0 ${statusMeta.badge}`}
                        >
                          {STATUS_LABEL[resolutionStatus]}
                        </Badge>
                      </div>
                    );
                  },
                )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
