'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, Clock, HardDrive, TrendingUp, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { backupsApi, BackupProfile } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function formatBytes(bytes?: number) {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDuration(ms?: number) {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function StatusIcon({ status }: { status?: string }) {
  if (status === 'success') return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />;
  if (status === 'running') return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
  return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
}

export function BackupMonitoringDashboard() {
  const { data: profiles, isLoading } = useQuery({
    queryKey: ['backup-monitoring'],
    queryFn: async () => {
      const res = await backupsApi.list();
      return res.data.profiles as BackupProfile[];
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  const total = profiles?.length ?? 0;
  const enabled = profiles?.filter(p => p.enabled).length ?? 0;
  const healthy = profiles?.filter(p => p.last_status === 'success').length ?? 0;
  const failed = profiles?.filter(p => p.last_status === 'failed').length ?? 0;

  const chartData = profiles?.slice(0, 8).map(p => ({
    name: p.name.slice(0, 12),
    size: p.last_size_bytes ? Math.round(p.last_size_bytes / 1024 / 1024) : 0,
    status: p.last_status,
  })) ?? [];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Profiles</span>
            </div>
            <p className="text-2xl font-bold mt-1">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Healthy</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{healthy}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Failed</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{failed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Active</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-blue-600">{enabled}</p>
          </CardContent>
        </Card>
      </div>

      {/* Backup size chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Last Backup Size (MB)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v} MB`, 'Size']} />
                <Bar dataKey="size" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.status === 'success' ? '#22c55e' : entry.status === 'failed' ? '#ef4444' : '#6366f1'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-profile status table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Profile Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {profiles?.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <StatusIcon status={p.last_status} />
                  <span className="text-sm font-medium">{p.name}</span>
                  <Badge variant="outline" className="text-xs">{p.destination_type}</Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{formatBytes(p.last_size_bytes)}</span>
                  <span>{formatDuration(p.last_duration_ms)}</span>
                  <span>{p.last_run_at ? new Date(p.last_run_at).toLocaleString() : '-'}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
