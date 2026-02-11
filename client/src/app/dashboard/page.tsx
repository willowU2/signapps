'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { StatCard } from '@/components/dashboard/stat-card';
import { ResourceGauge } from '@/components/dashboard/resource-gauge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Container,
  HardDrive,
  Network,
  Activity,
  Plus,
  Upload,
  Cpu,
  MemoryStick,
  Database,
  Wifi,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Server,
} from 'lucide-react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useServiceHealth, ServiceHealth } from '@/hooks/use-service-health';
import { useDashboardData } from '@/hooks/use-dashboard';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { data: dashboardData, isLoading: loading, isFetching: refreshing } = useDashboardData();
  const { data: services = [] } = useServiceHealth();

  const onlineCount = services.filter((s) => s.status === 'online').length;
  const totalCount = services.length;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const uptimeHours = Math.floor((dashboardData?.uptime || 0) / 3600);
  const uptimeDays = Math.floor(uptimeHours / 24);
  const uptimeStr = uptimeDays > 0 ? `${uptimeDays}d ${uptimeHours % 24}h` : `${uptimeHours}h`;

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-48" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['dashboard'] });
              queryClient.invalidateQueries({ queryKey: ['service-health'] });
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stat Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/containers">
            <StatCard
              title="Containers"
              value={`${dashboardData?.runningContainers || 0}/${dashboardData?.containers || 0}`}
              icon={Container}
              description="Running / Total"
              className="cursor-pointer hover:border-primary/50 transition-colors"
            />
          </Link>
          <Link href="/storage">
            <StatCard
              title="Storage"
              value={dashboardData?.storage || '0'}
              icon={HardDrive}
              description="S3 Buckets"
              className="cursor-pointer hover:border-primary/50 transition-colors"
            />
          </Link>
          <Link href="/routes">
            <StatCard
              title="Routes"
              value={dashboardData?.routes || 0}
              icon={Network}
              description="Active proxy routes"
              className="cursor-pointer hover:border-primary/50 transition-colors"
            />
          </Link>
          <StatCard
            title="Uptime"
            value={uptimeStr || '-'}
            icon={Activity}
            description="System uptime"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* System Health */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                System Health
              </CardTitle>
              <Badge variant="outline" className="gap-1">
                <div className={`h-2 w-2 rounded-full ${onlineCount === totalCount ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                {onlineCount}/{totalCount} Online
              </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Cpu className="h-4 w-4" />
                    CPU Usage
                  </div>
                  <ResourceGauge label="" value={dashboardData?.cpu || 0} showLabel={false} />
                  <p className="text-2xl font-bold">{dashboardData?.cpu || 0}%</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MemoryStick className="h-4 w-4" />
                    Memory
                  </div>
                  <ResourceGauge label="" value={dashboardData?.memory || 0} showLabel={false} />
                  <p className="text-2xl font-bold">{dashboardData?.memory || 0}%</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Database className="h-4 w-4" />
                    Disk
                  </div>
                  <ResourceGauge label="" value={dashboardData?.disk || 0} showLabel={false} />
                  <p className="text-2xl font-bold">{dashboardData?.disk || 0}%</p>
                </div>
              </div>

              {/* Service Status - 9 services grid */}
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">Services Status</h4>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-3">
                  {services.map((service: ServiceHealth) => (
                    <div
                      key={service.name}
                      className="flex items-center justify-between rounded-lg border p-2"
                    >
                      <span className="text-sm">{service.name}</span>
                      <div className="flex items-center gap-1">
                        <div className={`h-2 w-2 rounded-full ${service.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-xs text-muted-foreground">:{service.port}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/containers">
                <Button variant="outline" className="w-full justify-start">
                  <Plus className="mr-2 h-4 w-4" />
                  New Container
                </Button>
              </Link>
              <Link href="/routes">
                <Button variant="outline" className="w-full justify-start">
                  <Network className="mr-2 h-4 w-4" />
                  Add Route
                </Button>
              </Link>
              <Link href="/storage">
                <Button variant="outline" className="w-full justify-start">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Files
                </Button>
              </Link>
              <Link href="/ai">
                <Button variant="outline" className="w-full justify-start">
                  <Wifi className="mr-2 h-4 w-4" />
                  AI Assistant
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Network Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                <ArrowUpRight className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outbound Traffic</p>
                <p className="text-2xl font-bold">{formatBytes(dashboardData?.networkTx || 0)}</p>
                <p className="text-xs text-muted-foreground">Since boot</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <ArrowDownRight className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inbound Traffic</p>
                <p className="text-2xl font-bold">{formatBytes(dashboardData?.networkRx || 0)}</p>
                <p className="text-xs text-muted-foreground">Since boot</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
