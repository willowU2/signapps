"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Cpu,
  MemoryStick,
  HardDrive,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  itAssetsApi,
  HardwareAsset,
  AgentMetric,
  ITAlert,
} from "@/lib/api/it-assets";
import { usePageTitle } from "@/hooks/use-page-title";

const RANGES = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 365 days" },
];

function fmtTime(ts: string, range: string) {
  const d = new Date(ts);
  if (range === "24h")
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Compliance trend ─────────────────────────────────────────────────────────
// TODO: wire to backend API when compliance history endpoint is available

function ComplianceTrendChart({ range }: { range: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-purple-500" />
          Pourcentage de conformite dans le temps
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
          Aucune donnee de tendance disponible pour la periode selectionnee (
          {range})
        </div>
      </CardContent>
    </Card>
  );
}

export default function MonitoringPage() {
  usePageTitle("Monitoring");
  const [selectedHw, setSelectedHw] = useState<string>("");
  const [range, setRange] = useState("24h");

  const { data: hardware = [] } = useQuery<HardwareAsset[]>({
    queryKey: ["hardware"],
    queryFn: () => itAssetsApi.listHardware().then((r) => r.data),
  });

  const { data: metrics = [], isLoading: metricsLoading } = useQuery<
    AgentMetric[]
  >({
    queryKey: ["metrics", selectedHw, range],
    queryFn: () =>
      itAssetsApi.getMetrics(selectedHw, range).then((r) => r.data),
    enabled: !!selectedHw,
  });

  const { data: alerts = [] } = useQuery<ITAlert[]>({
    queryKey: ["alerts"],
    queryFn: () => itAssetsApi.listAlerts().then((r) => r.data),
  });

  const activeAlerts = alerts.filter((a) => !a.resolved_at);

  const chartData = metrics.map((m) => ({
    time: fmtTime(m.collected_at, range),
    cpu: m.cpu_usage != null ? Math.round(m.cpu_usage * 10) / 10 : null,
    memory:
      m.memory_usage != null ? Math.round(m.memory_usage * 10) / 10 : null,
    disk: m.disk_usage != null ? Math.round(m.disk_usage * 10) / 10 : null,
  }));

  const selectedMachine = hardware.find((h) => h.id === selectedHw);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Agent Monitoring
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time CPU, RAM, and disk metrics per machine
            </p>
          </div>
          {activeAlerts.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {activeAlerts.length} active alert
              {activeAlerts.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <Select value={selectedHw} onValueChange={setSelectedHw}>
              <SelectTrigger>
                <SelectValue placeholder="Select a machine..." />
              </SelectTrigger>
              <SelectContent>
                {hardware.map((hw) => (
                  <SelectItem key={hw.id} value={hw.id}>
                    {hw.name}{" "}
                    {hw.status && (
                      <span className="text-muted-foreground">
                        — {hw.status}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Machine info */}
        {selectedMachine && (
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">{selectedMachine.type}</Badge>
            {selectedMachine.manufacturer && (
              <Badge variant="outline">{selectedMachine.manufacturer}</Badge>
            )}
            {selectedMachine.location && (
              <Badge variant="outline">{selectedMachine.location}</Badge>
            )}
          </div>
        )}

        {!selectedHw ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a machine above to view metrics
            </CardContent>
          </Card>
        ) : metricsLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading metrics...
            </CardContent>
          </Card>
        ) : chartData.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No metrics data for this machine in the selected range
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {/* CPU Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-blue-500" /> CPU Usage (%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="opacity-20"
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v}%`]} />
                    <Line
                      type="monotone"
                      dataKey="cpu"
                      stroke="#3b82f6"
                      dot={false}
                      strokeWidth={2}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* RAM Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-emerald-500" /> Memory
                  Usage (%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="opacity-20"
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v}%`]} />
                    <Line
                      type="monotone"
                      dataKey="memory"
                      stroke="#10b981"
                      dot={false}
                      strokeWidth={2}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Disk Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-orange-500" /> Disk Usage
                  (%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="opacity-20"
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v}%`]} />
                    <Line
                      type="monotone"
                      dataKey="disk"
                      stroke="#f97316"
                      dot={false}
                      strokeWidth={2}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Compliance trend (long ranges) */}
        {(range === "90d" || range === "365d") && (
          <ComplianceTrendChart range={range} />
        )}

        {/* Active Alerts */}
        {activeAlerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Active
                Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                  >
                    <div className="text-sm">
                      <span className="font-medium">
                        Machine {alert.hardware_id.slice(0, 8)}
                      </span>
                      {alert.value != null && (
                        <span className="text-muted-foreground ml-2">
                          value: {alert.value.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(alert.triggered_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
