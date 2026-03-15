'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, HardDrive, FileText, TrendingUp } from 'lucide-react';
import { quotasApi, type QuotaUsage, type QuotaAlert } from '@/lib/api';
import { cn } from '@/lib/utils';

interface QuotaCardProps {
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getProgressColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 80) return 'bg-orange-500';
  if (percentage >= 60) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getStatusLabel(percentage: number): { label: string; color: string } {
  if (percentage >= 90) return { label: 'Critique', color: 'text-red-500' };
  if (percentage >= 80) return { label: 'Attention', color: 'text-orange-500' };
  if (percentage >= 60) return { label: 'Modere', color: 'text-yellow-500' };
  return { label: 'OK', color: 'text-green-500' };
}

export function QuotaCard({ className }: QuotaCardProps) {
  const [quota, setQuota] = useState<QuotaUsage | null>(null);
  const [alerts, setAlerts] = useState<QuotaAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuota() {
      try {
        setLoading(true);
        const [quotaRes, alertsRes] = await Promise.allSettled([
          quotasApi.getMyQuota(),
          quotasApi.getAlerts(),
        ]);

        if (quotaRes.status === 'fulfilled') {
          setQuota(quotaRes.value.data);
        }
        if (alertsRes.status === 'fulfilled') {
          setAlerts(alertsRes.value.data);
        }
        setError(null);
      } catch {
        setError('Impossible de charger les quotas');
      } finally {
        setLoading(false);
      }
    }

    fetchQuota();
  }, []);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Quotas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error && !quota) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Quotas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!quota) return null;

  const storagePercentage = quota.storage.percentage ??
    (quota.storage.limit ? (quota.storage.used / quota.storage.limit) * 100 : 0);
  const filesPercentage = quota.files.percentage ??
    (quota.files.limit ? (quota.files.used / quota.files.limit) * 100 : 0);

  const storageStatus = getStatusLabel(storagePercentage);
  const filesStatus = getStatusLabel(filesPercentage);

  const criticalAlerts = alerts.filter(a => a.alert_type === 'critical' || a.alert_type === 'exceeded');
  const warningAlerts = alerts.filter(a => a.alert_type === 'warning');

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Quotas de Stockage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Critical Alerts */}
        {criticalAlerts.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Alerte Quota</AlertTitle>
            <AlertDescription>
              {criticalAlerts[0].message}
            </AlertDescription>
          </Alert>
        )}

        {/* Warning Alerts */}
        {warningAlerts.length > 0 && criticalAlerts.length === 0 && (
          <Alert className="border-orange-500/50 bg-orange-500/10">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <AlertTitle className="text-orange-500">Attention</AlertTitle>
            <AlertDescription>
              {warningAlerts[0].message}
            </AlertDescription>
          </Alert>
        )}

        {/* Storage Quota */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Espace de stockage</span>
            </div>
            <span className={cn("text-sm font-medium", storageStatus.color)}>
              {storageStatus.label}
            </span>
          </div>
          <div className="relative">
            <Progress
              value={storagePercentage}
              className="h-3"
            />
            <div
              className={cn(
                "absolute inset-0 h-3 rounded-full transition-all",
                getProgressColor(storagePercentage)
              )}
              style={{ width: `${Math.min(storagePercentage, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{formatBytes(quota.storage.used)} utilises</span>
            <span>
              {quota.storage.limit
                ? `${formatBytes(quota.storage.limit)} total`
                : 'Illimite'
              }
            </span>
          </div>
          {quota.storage.limit && (
            <div className="text-right">
              <span className="text-lg font-bold">{storagePercentage.toFixed(1)}%</span>
            </div>
          )}
        </div>

        {/* Files Quota */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Nombre de fichiers</span>
            </div>
            <span className={cn("text-sm font-medium", filesStatus.color)}>
              {filesStatus.label}
            </span>
          </div>
          <div className="relative">
            <Progress
              value={filesPercentage}
              className="h-3"
            />
            <div
              className={cn(
                "absolute inset-0 h-3 rounded-full transition-all",
                getProgressColor(filesPercentage)
              )}
              style={{ width: `${Math.min(filesPercentage, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{quota.files.used.toLocaleString()} fichiers</span>
            <span>
              {quota.files.limit
                ? `${quota.files.limit.toLocaleString()} max`
                : 'Illimite'
              }
            </span>
          </div>
          {quota.files.limit && (
            <div className="text-right">
              <span className="text-lg font-bold">{filesPercentage.toFixed(1)}%</span>
            </div>
          )}
        </div>

        {/* Bucket Breakdown */}
        {quota.buckets && quota.buckets.length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Repartition par bucket</span>
            </div>
            <div className="space-y-2">
              {quota.buckets.slice(0, 5).map((bucket) => {
                const bucketPercentage = quota.storage.limit
                  ? (bucket.used_bytes / quota.storage.limit) * 100
                  : 0;
                return (
                  <div key={bucket.bucket} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-24 truncate">
                      {bucket.bucket}
                    </span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(bucketPercentage * 2, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-20 text-right">
                      {formatBytes(bucket.used_bytes)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
