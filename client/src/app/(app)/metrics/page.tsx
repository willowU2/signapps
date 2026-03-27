'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  RefreshCw,
  Activity,
  AlertTriangle,
  CheckCircle,
  Bell,
  BellOff,
  Plus,
  Settings,
  Trash2,
  Eye,
  Server,
} from 'lucide-react';
import { AlertConfig, AlertSeverity } from '@/lib/api';
import { toast } from 'sonner';
import { AlertConfigDialog } from '@/components/monitoring/alert-config-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  useMetricsSummary,
  useDiskMetrics,
  useAlertConfigs,
  useActiveAlerts,
  useAlertHistory,
  useAcknowledgeAlert,
  useToggleAlertConfig,
  useDeleteAlertConfig,
} from '@/hooks/use-monitoring';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

type StatusLevel = 'ok' | 'warning' | 'critical';

function getLevel(pct: number): StatusLevel {
  if (pct < 70) return 'ok';
  if (pct < 90) return 'warning';
  return 'critical';
}

function usageColor(pct: number): string {
  const level = getLevel(pct);
  if (level === 'ok') return 'text-green-500';
  if (level === 'warning') return 'text-yellow-500';
  return 'text-red-500';
}

function progressColor(pct: number): string {
  const level = getLevel(pct);
  if (level === 'ok') return 'bg-green-500';
  if (level === 'warning') return 'bg-yellow-500';
  return 'bg-red-500';
}

function StatusBadge({ pct }: { pct: number }) {
  const level = getLevel(pct);
  if (level === 'ok') return <Badge className="bg-green-500/10 text-green-600">OK</Badge>;
  if (level === 'warning') return <Badge className="bg-yellow-500/10 text-yellow-600">Warning</Badge>;
  return <Badge variant="destructive">Critical</Badge>;
}

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  if (severity === 'critical') return <Badge variant="destructive">Critical</Badge>;
  if (severity === 'warning') return <Badge className="bg-yellow-500/10 text-yellow-600">Warning</Badge>;
  return <Badge variant="secondary">Info</Badge>;
}

// ── Metric Card ────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: number;
  subtitle?: string;
}

function MetricCard({ icon, iconBg, label, value, subtitle }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
              {icon}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold leading-none mt-0.5 ${usageColor(value)}`}>
                {value.toFixed(1)}%
              </p>
            </div>
          </div>
          <StatusBadge pct={value} />
        </div>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${progressColor(value)}`}
            style={{ width: `${Math.min(value, 100)}%` }}
          />
        </div>
        {subtitle && <p className="mt-1.5 text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// ── Monitoring Tab ─────────────────────────────────────────────────────────

function MonitoringTab() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const queryClient = useQueryClient();

  const { data: metrics, isLoading, isError: metricsError } = useMetricsSummary(autoRefresh ? 5000 : undefined);
  const { data: disks = [], isLoading: disksLoading } = useDiskMetrics(autoRefresh ? 10000 : undefined);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (metricsError) toast.error('Failed to load system metrics');
  }, [metricsError]);

  const cpu = metrics?.cpu_usage_percent ?? metrics?.cpu ?? 0;
  const mem = metrics?.memory_usage_percent ?? metrics?.memory ?? 0;
  const disk = metrics?.disk_usage_percent ?? metrics?.disk ?? 0;
  const netRx = metrics?.network_rx_bytes ?? 0;
  const netTx = metrics?.network_tx_bytes ?? 0;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {metrics?.hostname ?? 'System'}
            {metrics?.os_name && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {metrics.os_name}
              </span>
            )}
          </h2>
          {metrics?.uptime_seconds !== undefined && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Server className="h-3.5 w-3.5" />
              Uptime: {formatUptime(metrics.uptime_seconds)}
              {metrics.cpu_cores && ` · ${metrics.cpu_cores} cores`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Auto-refresh</span>
          <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['metrics'] })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          {autoRefresh && (
            <Badge className="bg-green-500/10 text-green-600">
              <Activity className="mr-1 h-3 w-3 animate-pulse" />
              Live
            </Badge>
          )}
        </div>
      </div>

      {/* Main metric cards */}
      {isLoading && !metrics ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={<Cpu className="h-5 w-5 text-blue-500" />}
            iconBg="bg-blue-500/10"
            label="CPU Usage"
            value={cpu}
            subtitle={metrics?.cpu_cores ? `${metrics.cpu_cores} logical cores` : undefined}
          />
          <MetricCard
            icon={<MemoryStick className="h-5 w-5 text-purple-500" />}
            iconBg="bg-purple-500/10"
            label="Memory"
            value={mem}
            subtitle={
              metrics?.memory_total_bytes
                ? `${formatBytes(metrics.memory_used_bytes ?? 0)} / ${formatBytes(metrics.memory_total_bytes)}`
                : undefined
            }
          />
          <MetricCard
            icon={<HardDrive className="h-5 w-5 text-orange-500" />}
            iconBg="bg-orange-500/10"
            label="Disk (overall)"
            value={disk}
            subtitle={
              metrics?.disk_total_bytes
                ? `${formatBytes(metrics.disk_used_bytes ?? 0)} / ${formatBytes(metrics.disk_total_bytes)}`
                : undefined
            }
          />
          {/* Network card — no % value, show I/O */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
                  <Network className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Network I/O</p>
                  <p className="text-base font-semibold leading-none mt-0.5">
                    {formatBytes(netRx + netTx)}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span className="text-green-500">↓ Received</span>
                  <span>{formatBytes(netRx)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-orange-500">↑ Sent</span>
                  <span>{formatBytes(netTx)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Disk partitions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4" />
            Disk Partitions
          </CardTitle>
          <CardDescription>Storage usage by mount point</CardDescription>
        </CardHeader>
        <CardContent>
          {disksLoading && disks.length === 0 ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : disks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No disk data available</p>
          ) : (
            <div className="space-y-4">
              {disks.map((d, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono font-medium">{d.mount_point}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">
                        {formatBytes(d.used)} / {formatBytes(d.total)}
                      </span>
                      <StatusBadge pct={d.percent} />
                    </div>
                  </div>
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all ${progressColor(d.percent)}`}
                      style={{ width: `${Math.min(d.percent, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {d.percent.toFixed(1)}% used · {formatBytes(d.available)} free
                    {d.file_system && ` · ${d.file_system}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Alerts Tab ─────────────────────────────────────────────────────────────

function AlertsTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AlertConfig | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: configs = [], isLoading: configsLoading } = useAlertConfigs();
  const { data: active = [] } = useActiveAlerts();
  const { data: history = [] } = useAlertHistory(20);

  const acknowledge = useAcknowledgeAlert();
  const toggleConfig = useToggleAlertConfig();
  const deleteConfig = useDeleteAlertConfig();

  const openCreate = () => { setEditingConfig(null); setDialogOpen(true); };
  const openEdit = (cfg: AlertConfig) => { setEditingConfig(cfg); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      {/* Active alerts banner */}
      {active.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">
                    {active.length} active alert{active.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">{active[0]?.message}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => acknowledge.mutate(active[0].id)}
                disabled={acknowledge.isPending}
              >
                <Eye className="mr-2 h-4 w-4" />
                Acknowledge
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Alert Rules
              </CardTitle>
              <CardDescription>Configure thresholds and notifications</CardDescription>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {configsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : configs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <BellOff className="mb-2 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No alert rules configured</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first rule
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((cfg) => (
                  <TableRow key={cfg.id}>
                    <TableCell className="font-medium">{cfg.name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {(cfg.metric_type || cfg.metric || '').replace(/_/g, ' ')}
                      {cfg.metric_target && (
                        <span className="ml-1 text-muted-foreground">({cfg.metric_target})</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(cfg.operator || cfg.condition || '').replace(/_/g, ' ')} {cfg.threshold}%
                    </TableCell>
                    <TableCell><SeverityBadge severity={cfg.severity} /></TableCell>
                    <TableCell>
                      <Switch
                        checked={cfg.enabled}
                        onCheckedChange={(v) => toggleConfig.mutate({ id: cfg.id, enabled: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(cfg)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(cfg.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Active alerts table */}
      {active.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Active Alerts
              <Badge variant="destructive">{active.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Triggered</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="font-medium">{alert.config_name}</TableCell>
                    <TableCell>
                      {(alert.metric_value ?? alert.current_value ?? 0).toFixed(1)}%
                      <span className="ml-1 text-muted-foreground text-xs">
                        (threshold: {alert.threshold}%)
                      </span>
                    </TableCell>
                    <TableCell><SeverityBadge severity={alert.severity} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatTimeAgo(alert.triggered_at)}
                    </TableCell>
                    <TableCell>
                      {!alert.acknowledged_at && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => acknowledge.mutate(alert.id)}
                          disabled={acknowledge.isPending}
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          Acknowledge
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Alert history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Recent Alert History
          </CardTitle>
          <CardDescription>Last 20 alert events</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="mb-2 h-8 w-8 text-green-500" />
              <p className="text-sm text-muted-foreground">No recent alerts — all systems nominal</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Triggered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((evt) => (
                  <TableRow key={evt.id}>
                    <TableCell>
                      {evt.resolved_at ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : evt.acknowledged_at ? (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{evt.config_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {evt.message}
                    </TableCell>
                    <TableCell><SeverityBadge severity={evt.severity} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTimeAgo(evt.triggered_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AlertConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        config={editingConfig}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['alerts'] })}
      />
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Delete Alert Rule"
        description="This alert rule will be permanently deleted. This action cannot be undone."
        onConfirm={() => {
          if (deleteId) deleteConfig.mutate(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function MetricsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Metrics</h1>
          <p className="text-muted-foreground">
            System monitoring and alert management for SignApps services
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="monitoring">
          <TabsList>
            <TabsTrigger value="monitoring">
              <Activity className="mr-2 h-4 w-4" />
              Monitoring
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <Bell className="mr-2 h-4 w-4" />
              Alerts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monitoring" className="mt-6">
            <MonitoringTab />
          </TabsContent>

          <TabsContent value="alerts" className="mt-6">
            <AlertsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
