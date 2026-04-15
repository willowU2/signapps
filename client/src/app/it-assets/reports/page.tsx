"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  BarChart2,
  Server,
  ShieldCheck,
  Ticket,
  AlertTriangle,
  Download,
  Mail,
  Calendar,
  TrendingUp,
  CheckCircle,
  Clock,
} from "lucide-react";
import {
  itAssetsApi,
  FleetOverview as FleetOverviewBase,
  PatchComplianceStats,
} from "@/lib/api/it-assets";

// Extend local alias to accommodate both `total` and potential `total_devices` shapes
type FleetOverview = FleetOverviewBase & { total_devices?: number };
import { usePageTitle } from "@/hooks/use-page-title";

// ─── Mock chart data ──────────────────────────────────────────────────────────

const COMPLIANCE_TREND = [
  { month: "Oct", pct: 72 },
  { month: "Nov", pct: 78 },
  { month: "Dec", pct: 81 },
  { month: "Jan", pct: 85 },
  { month: "Feb", pct: 88 },
  { month: "Mar", pct: 91 },
];

const TICKET_VOLUME = [
  { month: "Oct", open: 34, closed: 28 },
  { month: "Nov", open: 42, closed: 39 },
  { month: "Dec", open: 38, closed: 41 },
  { month: "Jan", open: 51, closed: 48 },
  { month: "Feb", open: 44, closed: 50 },
  { month: "Mar", open: 37, closed: 42 },
];

const PATCH_TIMELINE = [
  { week: "W1", deployed: 12 },
  { week: "W2", deployed: 28 },
  { week: "W3", deployed: 19 },
  { week: "W4", deployed: 41 },
  { week: "W5", deployed: 33 },
  { week: "W6", deployed: 55 },
  { week: "W7", deployed: 47 },
  { week: "W8", deployed: 62 },
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-2 rounded-lg bg-muted/50`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Schedule Dialog ──────────────────────────────────────────────────────────

function ScheduleDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    email: "",
    frequency: "weekly",
    day: "monday",
    time: "08:00",
  });
  const [scheduled, setScheduled] = useState(false);

  function submit() {
    // In production: POST /api/v1/it-assets/reports/schedule  { email, frequency, day, time }
    setScheduled(true);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule Email Delivery</DialogTitle>
        </DialogHeader>
        {scheduled ? (
          <div className="text-center py-4">
            <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
            <p className="font-medium">Report scheduled!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Reports will be sent to <strong>{form.email}</strong> every{" "}
              {form.frequency}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Recipient email</Label>
              <Input
                className="mt-1"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="cto@company.com"
              />
            </div>
            <div>
              <Label>Frequency</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.frequency === "weekly" && (
              <div>
                <Label>Day</Label>
                <Select
                  value={form.day}
                  onValueChange={(v) => setForm((f) => ({ ...f, day: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "monday",
                      "tuesday",
                      "wednesday",
                      "thursday",
                      "friday",
                    ].map((d) => (
                      <SelectItem key={d} value={d}>
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Time</Label>
              <Input
                className="mt-1"
                type="time"
                value={form.time}
                onChange={(e) =>
                  setForm((f) => ({ ...f, time: e.target.value }))
                }
              />
            </div>
          </div>
        )}
        <DialogFooter>
          {scheduled ? (
            <Button onClick={onClose}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={!form.email}>
                <Mail className="h-4 w-4 mr-2" />
                Schedule
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExecutiveReportsPage() {
  usePageTitle("IT Reports");
  const [showSchedule, setShowSchedule] = useState(false);

  const { data: fleet } = useQuery<FleetOverview>({
    queryKey: ["fleet-overview"],
    queryFn: () => itAssetsApi.getFleetOverview().then((r) => r.data),
  });

  const { data: patchStats } = useQuery<PatchComplianceStats>({
    queryKey: ["patch-compliance"],
    queryFn: () => itAssetsApi.patchCompliance().then((r) => r.data),
  });

  function exportCsv() {
    const rows = [
      ["Metric", "Value"],
      ["Total Devices", fleet?.total ?? fleet?.total_devices ?? 0],
      ["Online Devices", fleet?.online ?? 0],
      ["Patch Compliance %", patchStats?.compliance_pct?.toFixed(1) ?? "—"],
      ["Critical Patches Pending", patchStats?.critical_pending ?? 0],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `it-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    window.print();
  }

  const fleetTotal = fleet?.total ?? fleet?.total_devices ?? 0;
  const avgHealth = fleet
    ? Math.round((fleet.online / Math.max(fleetTotal, 1)) * 100)
    : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart2 className="h-6 w-6 text-primary" />
              Executive IT Reports
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              High-level KPIs and trend analytics for IT operations
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={exportPdf}>
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button onClick={() => setShowSchedule(true)}>
              <Calendar className="h-4 w-4 mr-2" />
              Planifier
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Total devices"
            value={fleet?.total ?? fleet?.total_devices ?? "—"}
            subtitle={`${fleet?.online ?? 0} online`}
            icon={<Server className="h-5 w-5 text-blue-500" />}
            color="text-blue-600"
          />
          <KpiCard
            title="Avg health score"
            value={avgHealth != null ? `${avgHealth}%` : "—"}
            subtitle="Based on online/total"
            icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
            color="text-emerald-600"
          />
          <KpiCard
            title="Patch compliance"
            value={
              patchStats?.compliance_pct != null
                ? `${patchStats.compliance_pct.toFixed(0)}%`
                : "—"
            }
            subtitle={`${patchStats?.critical_pending ?? 0} critical pending`}
            icon={<ShieldCheck className="h-5 w-5 text-purple-500" />}
            color="text-purple-600"
          />
          <KpiCard
            title="Pending patches"
            value={patchStats?.pending_patches ?? "—"}
            subtitle={
              patchStats?.by_severity?.find((s) => s.severity === "critical")
                ? `${patchStats.by_severity.find((s) => s.severity === "critical")!.count} critical`
                : undefined
            }
            icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
            color="text-orange-600"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Compliance trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-purple-500" />
                Compliance trend (%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={COMPLIANCE_TREND}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}%`, "Compliance"]} />
                  <Line
                    type="monotone"
                    dataKey="pct"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Ticket volume */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Ticket className="h-4 w-4 text-cyan-500" />
                Ticket volume by month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={TICKET_VOLUME}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar
                    dataKey="open"
                    name="Opened"
                    fill="#06b6d4"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="closed"
                    name="Closed"
                    fill="#10b981"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 justify-center text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-cyan-500 inline-block" />
                  Opened
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
                  Closed
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Patch deployment timeline */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                Patch deployment timeline (last 8 weeks)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={PATCH_TIMELINE}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [v, "Patches deployed"]} />
                  <Bar dataKey="deployed" fill="#f97316" radius={[3, 3, 0, 0]}>
                    {PATCH_TIMELINE.map((_, i) => (
                      <Cell
                        key={i}
                        fill={
                          i === PATCH_TIMELINE.length - 1
                            ? "#f97316"
                            : "#fed7aa"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {showSchedule && (
        <ScheduleDialog onClose={() => setShowSchedule(false)} />
      )}
    </AppLayout>
  );
}
