'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { StatCard } from '@/components/dashboard/stat-card';
import { ResourceGauge } from '@/components/dashboard/resource-gauge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Container,
  HardDrive,
  Network,
  Activity,
  Plus,
  Upload,
  Clock,
} from 'lucide-react';
import { containersApi, metricsApi } from '@/lib/api';

interface DashboardStats {
  containers: number;
  storage: string;
  routes: number;
  uptime: string;
}

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
}

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  time: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch containers
        const containersRes = await containersApi.list();
        const containerCount = containersRes.data?.length || 0;

        // Fetch system metrics
        let systemMetrics = { cpu: 0, memory: 0, disk: 0 };
        try {
          const metricsRes = await metricsApi.system();
          systemMetrics = metricsRes.data;
        } catch {
          // Use mock data if metrics service unavailable
          systemMetrics = { cpu: 45, memory: 72, disk: 65 };
        }

        setStats({
          containers: containerCount,
          storage: '48 GB',
          routes: 8,
          uptime: '99.9%',
        });

        setMetrics(systemMetrics);

        // Mock recent activity
        setActivities([
          { id: '1', type: 'container', message: 'nginx container started', time: '2 min ago' },
          { id: '2', type: 'backup', message: 'Backup completed successfully', time: '15 min ago' },
          { id: '3', type: 'auth', message: 'User admin logged in', time: '1 hour ago' },
          { id: '4', type: 'route', message: 'Route api.example.com created', time: '2 hours ago' },
        ]);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        // Set mock data on error
        setStats({
          containers: 12,
          storage: '48 GB',
          routes: 8,
          uptime: '99.9%',
        });
        setMetrics({ cpu: 45, memory: 72, disk: 65 });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
        <h1 className="text-3xl font-bold">Dashboard</h1>

        {/* Stat Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Containers"
            value={stats?.containers || 0}
            icon={Container}
            description="Running containers"
          />
          <StatCard
            title="Storage"
            value={stats?.storage || '0 GB'}
            icon={HardDrive}
            description="Used storage"
          />
          <StatCard
            title="Routes"
            value={stats?.routes || 0}
            icon={Network}
            description="Active proxy routes"
          />
          <StatCard
            title="Uptime"
            value={stats?.uptime || '0%'}
            icon={Activity}
            description="Last 30 days"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* System Health */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>System Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ResourceGauge label="CPU" value={metrics?.cpu || 0} />
              <ResourceGauge label="Memory" value={metrics?.memory || 0} />
              <ResourceGauge label="Disk" value={metrics?.disk || 0} />
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="mr-2 h-4 w-4" />
                New Container
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Network className="mr-2 h-4 w-4" />
                Add Route
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Upload className="mr-2 h-4 w-4" />
                Upload Files
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-sm">{activity.message}</span>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {activity.time}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
