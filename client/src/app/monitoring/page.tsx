'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTableSkeleton, CardGridSkeleton } from '@/components/ui/skeleton-loader';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Activity,
  RefreshCw,
  Server,
  AlertTriangle,
  CheckCircle,
  Bell,
  BellOff,
  Plus,
  Settings,
  Clock,
  Trash2,
  Eye,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AnomalyAlertPanel } from '@/components/monitoring/anomaly-alert-panel';
import { AlertConfig, AlertSeverity } from '@/lib/api';
import { AlertConfigDialog } from '@/components/monitoring/alert-config-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  useMetricsSummary,
  useMetricsStream,
  useDiskMetrics,
  useAlertConfigs,
  useActiveAlerts,
  useAlertHistory,
  useAcknowledgeAlert,
  useToggleAlertConfig,
  useDeleteAlertConfig,
} from '@/hooks/use-monitoring';

interface MetricPoint {
  time: string;
  timestamp: number;
  cpu: number;
  memory: number;
  disk: number;
  networkRx: number;
  networkTx: number;
}

type TimePeriod = '5m' | '15m' | '1h' | '24h';

const periodLabels: Record<TimePeriod, string> = {
  '5m': '5 minutes',
  '15m': '15 minutes',
  '1h': '1 hour',
  '24h': '24 hours',
};

const maxPointsByPeriod: Record<TimePeriod, number> = {
  '5m': 60,    // 5 sec intervals
  '15m': 90,   // 10 sec intervals
  '1h': 120,   // 30 sec intervals
  '24h': 288,  // 5 min intervals
};

export default function MonitoringPage() {
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('5m');
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const { metrics: streamMetrics, connected: streamConnected } = useMetricsStream(realtimeEnabled);

  // Alerts local state
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AlertConfig | null>(null);
  const [deleteConfigId, setDeleteConfigId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const [history, setHistory] = useState<MetricPoint[]>([]);

  // React Query hooks
  const { data: queryMetrics, isLoading: loading, isError: metricsError } = useMetricsSummary(autoRefresh ? refreshInterval : undefined);
  const { data: disks = [] } = useDiskMetrics(autoRefresh ? refreshInterval : undefined);

  useEffect(() => {
    if (metricsError) toast.error('Failed to load system metrics');
  }, [metricsError]);

  // Use SSE metrics when real-time is enabled, otherwise use polling data
  const metrics = realtimeEnabled && streamMetrics ? streamMetrics : queryMetrics;
  const { data: alertConfigs = [] } = useAlertConfigs();
  const { data: activeAlerts = [] } = useActiveAlerts();
  const { data: alertHistory = [] } = useAlertHistory(10);

  // Mutations
  const acknowledgeAlert = useAcknowledgeAlert();
  const toggleAlertConfig = useToggleAlertConfig();
  const deleteAlertConfig = useDeleteAlertConfig();

  // Build history from metrics updates
  useEffect(() => {
    if (!metrics) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory((prev) => {
      const newPoint: MetricPoint = {
        time: timeStr,
        timestamp: now.getTime(),
        cpu: metrics.cpu_usage_percent || metrics.cpu || 0,
        memory: metrics.memory_usage_percent || metrics.memory || 0,
        disk: metrics.disk_usage_percent || metrics.disk || 0,
        networkRx: (metrics.network_rx_bytes || 0) / 1024 / 1024,
        networkTx: (metrics.network_tx_bytes || 0) / 1024 / 1024,
      };
      return [...prev, newPoint].slice(-maxPointsByPeriod[timePeriod]);
    });
  }, [metrics, timePeriod]);

  // Reset history when period changes
  useEffect(() => {
    setHistory([]); // eslint-disable-line react-hooks/set-state-in-effect
  }, [timePeriod]);

  const handleAcknowledgeAlert = (alertId: string) => {
    acknowledgeAlert.mutate(alertId);
  };

  const handleToggleConfig = (configId: string, enabled: boolean) => {
    toggleAlertConfig.mutate({ id: configId, enabled });
  };

  const handleDeleteConfig = (configId: string) => {
    deleteAlertConfig.mutate(configId);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getStatusColor = (value: number) => {
    if (value < 50) return 'text-green-500';
    if (value < 80) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusBadge = (value: number) => {
    if (value < 50) return <Badge className="bg-green-500/10 text-green-600">Normal</Badge>;
    if (value < 80) return <Badge className="bg-yellow-500/10 text-yellow-600">Warning</Badge>;
    return <Badge variant="destructive">Critical</Badge>;
  };

  const getAlertSeverityBadge = (severity: AlertSeverity) => {
    if (severity === 'critical') {
      return <Badge variant="destructive">Critical</Badge>;
    }
    return <Badge className="bg-yellow-500/10 text-yellow-600">Warning</Badge>;
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'cpu':
        return <Cpu className="h-4 w-4" />;
      case 'memory':
        return <MemoryStick className="h-4 w-4" />;
      case 'disk':
        return <HardDrive className="h-4 w-4" />;
      case 'network':
        return <Network className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  if (loading && !metrics) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <CardGridSkeleton count={4} className="md:grid-cols-4" />
          <DataTableSkeleton count={4} />
        </div>
      </AppLayout>
    );
  }

  const cpuUsage = metrics?.cpu_usage_percent || metrics?.cpu || 0;
  const memoryUsage = metrics?.memory_usage_percent || metrics?.memory || 0;
  const diskUsage = metrics?.disk_usage_percent || metrics?.disk || 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* AQ-AIAD: AI Anomaly Detection Panel */}
        <AnomalyAlertPanel />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">System Monitoring</h1>
            <p className="text-muted-foreground">
              {metrics?.hostname || 'Server'} - {metrics?.os_name || 'Unknown OS'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Time Period Selector */}
            <Select
              value={timePeriod}
              onValueChange={(v) => setTimePeriod(v as TimePeriod)}
            >
              <SelectTrigger className="w-32">
                <Clock className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5m">5 min</SelectItem>
                <SelectItem value="15m">15 min</SelectItem>
                <SelectItem value="1h">1 hour</SelectItem>
                <SelectItem value="24h">24 hours</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh Interval */}
            <Select
              value={refreshInterval.toString()}
              onValueChange={(v) => setRefreshInterval(parseInt(v))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1000">1s</SelectItem>
                <SelectItem value="5000">5s</SelectItem>
                <SelectItem value="10000">10s</SelectItem>
                <SelectItem value="30000">30s</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <Activity className={`mr-2 h-4 w-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
              {autoRefresh ? 'Live' : 'Paused'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['metrics'] })}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Real-time</span>
              <Switch
                checked={realtimeEnabled}
                onCheckedChange={setRealtimeEnabled}
              />
              {realtimeEnabled && streamConnected && (
                <Badge className="bg-green-500/10 text-green-600">Live</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Active Alerts Banner */}
        {activeAlerts.length > 0 && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive">
                      {activeAlerts.length} Active Alert{activeAlerts.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activeAlerts[0]?.message}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAcknowledgeAlert(activeAlerts[0].id)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Acknowledge
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Cpu className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">CPU</p>
                    <p className={`text-2xl font-bold ${getStatusColor(cpuUsage)}`}>
                      {cpuUsage.toFixed(1)}%
                    </p>
                  </div>
                </div>
                {getStatusBadge(cpuUsage)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {metrics?.cpu_cores || '-'} cores
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                    <MemoryStick className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Memory</p>
                    <p className={`text-2xl font-bold ${getStatusColor(memoryUsage)}`}>
                      {memoryUsage.toFixed(1)}%
                    </p>
                  </div>
                </div>
                {getStatusBadge(memoryUsage)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatBytes(metrics?.memory_used_bytes || 0)} / {formatBytes(metrics?.memory_total_bytes || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                    <HardDrive className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Disk</p>
                    <p className={`text-2xl font-bold ${getStatusColor(diskUsage)}`}>
                      {diskUsage.toFixed(1)}%
                    </p>
                  </div>
                </div>
                {getStatusBadge(diskUsage)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatBytes(metrics?.disk_used_bytes || 0)} / {formatBytes(metrics?.disk_total_bytes || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <Server className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Uptime</p>
                  <p className="text-2xl font-bold">
                    {formatUptime(metrics?.uptime_seconds || metrics?.uptime || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* CPU Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="h-5 w-5 text-blue-500" />
                CPU Usage
              </CardTitle>
              <CardDescription>
                Last {periodLabels[timePeriod]}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value) => [`${(value as number)?.toFixed(1) ?? 0}%`, 'CPU']}
                    />
                    <Line
                      type="monotone"
                      dataKey="cpu"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Memory Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MemoryStick className="h-5 w-5 text-purple-500" />
                Memory Usage
              </CardTitle>
              <CardDescription>
                Last {periodLabels[timePeriod]}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value) => [`${(value as number)?.toFixed(1) ?? 0}%`, 'Memory']}
                    />
                    <Area
                      type="monotone"
                      dataKey="memory"
                      stroke="#a855f7"
                      fill="#a855f7"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Network Chart - Full Width */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Network Traffic
            </CardTitle>
            <CardDescription>
              Received and sent traffic over the last {periodLabels[timePeriod]}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    tickFormatter={(v) => `${v.toFixed(0)} MB`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => [`${(value as number)?.toFixed(2) ?? 0} MB`]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="networkRx"
                    name="Received"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="networkTx"
                    name="Sent"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span>Total Received: {formatBytes(metrics?.network_rx_bytes || 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-orange-500" />
                <span>Total Sent: {formatBytes(metrics?.network_tx_bytes || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts & Disk Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Alerts Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Alert Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure thresholds and notification actions
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingConfig(null);
                    setAlertDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Alert
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="configs">
                <TabsList className="mb-4">
                  <TabsTrigger value="configs">Configurations</TabsTrigger>
                  <TabsTrigger value="history">
                    History
                    {alertHistory.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {alertHistory.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="configs">
                  {alertConfigs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <BellOff className="mb-2 h-10 w-10 text-muted-foreground" />
                      <p className="text-muted-foreground">No alert configurations</p>
                      <p className="text-sm text-muted-foreground">
                        Create an alert to get notified when thresholds are exceeded
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {alertConfigs.map((config) => (
                          <div
                            key={config.id}
                            className="flex items-center justify-between rounded-lg border p-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                {getMetricIcon(config.metric || config.metric_type || '')}
                              </div>
                              <div>
                                <p className="font-medium">{config.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {(config.metric || config.metric_type || '').toUpperCase()} {config.condition || config.operator} {config.threshold}%
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={config.enabled}
                                onCheckedChange={(checked) =>
                                  handleToggleConfig(config.id, checked)
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingConfig(config);
                                  setAlertDialogOpen(true);
                                }}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfigId(config.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="history">
                  {alertHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <CheckCircle className="mb-2 h-10 w-10 text-green-500" />
                      <p className="text-muted-foreground">No recent alerts</p>
                      <p className="text-sm text-muted-foreground">
                        All systems running normally
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {alertHistory.map((alert) => (
                          <div
                            key={alert.id}
                            className="flex items-start justify-between rounded-lg border p-3"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {alert.resolved_at ? (
                                  <CheckCircle className="h-5 w-5 text-green-500" />
                                ) : (
                                  <AlertTriangle className="h-5 w-5 text-destructive" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{alert.config_name}</p>
                                  {getAlertSeverityBadge(alert.severity)}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {alert.message}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatTimeAgo(alert.triggered_at)}
                                  {alert.acknowledged_at && ' - Acknowledged'}
                                  {alert.resolved_at && ' - Resolved'}
                                </p>
                              </div>
                            </div>
                            {!alert.acknowledged_at && !alert.resolved_at && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAcknowledgeAlert(alert.id)}
                              >
                                Acknowledge
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Disk Partitions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Disk Partitions
              </CardTitle>
              <CardDescription>
                Storage usage by partition
              </CardDescription>
            </CardHeader>
            <CardContent>
              {disks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <HardDrive className="mb-2 h-10 w-10 text-muted-foreground" />
                  <p className="text-muted-foreground">No disk information available</p>
                </div>
              ) : (
                <ScrollArea className="h-64">
                  <div className="space-y-4">
                    {disks.map((disk, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium font-mono text-sm">{disk.mount_point}</span>
                          <span className="text-sm text-muted-foreground">
                            {formatBytes(disk.used)} / {formatBytes(disk.total)}
                          </span>
                        </div>
                        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                              disk.percent < 50
                                ? 'bg-green-500'
                                : disk.percent < 80
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${disk.percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{disk.percent.toFixed(1)}% used</span>
                          <span>{formatBytes(disk.available)} available</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Alert Config Dialog */}
      <AlertConfigDialog
        open={alertDialogOpen}
        onOpenChange={setAlertDialogOpen}
        config={editingConfig}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['alerts'] })}
      />

      {/* Delete Alert Config Confirmation */}
      <ConfirmDialog
        open={deleteConfigId !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfigId(null); }}
        title="Delete Alert Configuration"
        description="Are you sure you want to delete this alert configuration? This action cannot be undone."
        onConfirm={() => {
          if (deleteConfigId) handleDeleteConfig(deleteConfigId);
          setDeleteConfigId(null);
        }}
      />
    </AppLayout>
  );
}
