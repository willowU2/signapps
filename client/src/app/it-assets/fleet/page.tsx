"use client";

import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Monitor, Wifi, WifiOff, AlertTriangle, Server } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { itAssetsApi, FleetOverview } from "@/lib/api/it-assets";
import { usePageTitle } from "@/hooks/use-page-title";

const OS_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#6b7280",
];
const STATUS_COLORS: Record<string, string> = {
  active: "#10b981",
  maintenance: "#f59e0b",
  retired: "#6b7280",
  stock: "#3b82f6",
  unknown: "#ef4444",
};

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FleetPage() {
  usePageTitle("Fleet Overview");

  const { data: fleet, isLoading } = useQuery<FleetOverview>({
    queryKey: ["fleet-overview"],
    queryFn: () => itAssetsApi.getFleetOverview().then((r) => r.data),
    refetchInterval: 30_000,
  });

  if (isLoading || !fleet) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Loading fleet data...
        </div>
      </AppLayout>
    );
  }

  const statusData = fleet.by_status.map((s) => ({
    name: s.status,
    count: Number(s.count),
    fill: STATUS_COLORS[s.status] ?? "#6b7280",
  }));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" />
            Fleet Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time status of all managed machines
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Machines"
            value={fleet.total}
            icon={<Monitor className="h-5 w-5 text-blue-600" />}
            color="bg-blue-50 dark:bg-blue-950"
          />
          <StatCard
            label="Online"
            value={fleet.online}
            icon={<Wifi className="h-5 w-5 text-emerald-600" />}
            color="bg-emerald-50 dark:bg-emerald-950"
          />
          <StatCard
            label="Warning"
            value={fleet.warning}
            icon={<AlertTriangle className="h-5 w-5 text-orange-600" />}
            color="bg-orange-50 dark:bg-orange-950"
          />
          <StatCard
            label="Offline"
            value={fleet.offline}
            icon={<WifiOff className="h-5 w-5 text-red-600" />}
            color="bg-red-50 dark:bg-red-950"
          />
        </div>

        {/* Charts row */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* OS Pie */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">By OS Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={fleet.by_os.map((o, i) => ({
                      name: o.os_type,
                      value: Number(o.count),
                      fill: OS_COLORS[i % OS_COLORS.length],
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={false}
                  >
                    {fleet.by_os.map((_, i) => (
                      <Cell key={i} fill={OS_COLORS[i % OS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status Bar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">By Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={statusData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={80}
                  />
                  <Tooltip />
                  <Bar dataKey="count" radius={4}>
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recently offline table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Machines Sorted by Last Seen
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fleet.recently_offline.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                All machines have been seen recently
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Heartbeat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fleet.recently_offline.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.os_type ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            m.status === "active" ? "default" : "secondary"
                          }
                        >
                          {m.status ?? "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.last_heartbeat
                          ? new Date(m.last_heartbeat).toLocaleString()
                          : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
