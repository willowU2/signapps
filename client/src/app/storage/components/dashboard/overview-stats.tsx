'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { HardDrive, Database, FileText, Activity, AlertTriangle, FolderOpen } from 'lucide-react';
import type { StorageStats, RaidHealth } from '@/lib/api';
import { cn } from '@/lib/utils';

interface OverviewStatsProps {
  stats: StorageStats | null;
  raidHealth: RaidHealth | null;
  loading?: boolean;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getUsageColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 75) return 'bg-orange-500';
  if (percentage >= 50) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getUsageTextColor(percentage: number): string {
  if (percentage >= 90) return 'text-red-500';
  if (percentage >= 75) return 'text-orange-500';
  if (percentage >= 50) return 'text-yellow-500';
  return 'text-green-500';
}

export function OverviewStats({ stats, raidHealth, loading }: OverviewStatsProps) {
  const usagePercent = stats && stats.total_bytes > 0
    ? Math.round((stats.used_bytes / stats.total_bytes) * 100)
    : 0;

  const statCards = [
    {
      title: 'Espace Total',
      value: stats ? formatBytes(stats.total_bytes) : '-',
      icon: HardDrive,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Espace Utilise',
      value: stats ? formatBytes(stats.used_bytes) : '-',
      icon: Database,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      subtitle: usagePercent > 0 ? `${usagePercent}%` : undefined,
    },
    {
      title: 'Espace Libre',
      value: stats ? formatBytes(stats.free_bytes) : '-',
      icon: Activity,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Fichiers',
      value: stats?.files_count?.toLocaleString() ?? '-',
      icon: FileText,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold">{loading ? '...' : card.value}</p>
                    {card.subtitle && (
                      <span className="text-sm text-muted-foreground">({card.subtitle})</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Storage Quota Progress Bar */}
      {stats && stats.total_bytes > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-5 w-5" />
              Utilisation du Stockage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatBytes(stats.used_bytes)} utilises sur {formatBytes(stats.total_bytes)}
                </span>
                <span className={cn('font-semibold', getUsageTextColor(usagePercent))}>
                  {usagePercent}%
                </span>
              </div>
              <div className="relative h-4 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                    getUsageColor(usagePercent)
                  )}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatBytes(stats.free_bytes)} disponible</span>
                <span>
                  {stats.buckets_count} bucket{stats.buckets_count !== 1 ? 's' : ''} - {stats.files_count?.toLocaleString() ?? 0} fichier{(stats.files_count ?? 0) !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Usage breakdown tiers */}
            {usagePercent >= 75 && (
              <div className="flex items-center gap-2 rounded-md bg-orange-500/10 p-3 text-sm text-orange-600">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>
                  {usagePercent >= 90
                    ? 'Stockage critique ! Liberez de l\'espace ou augmentez votre quota.'
                    : 'L\'espace de stockage commence a etre limite. Pensez a faire du menage.'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* RAID Health Summary */}
      {raidHealth && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  raidHealth.status === 'healthy' ? 'bg-green-500/10' :
                  raidHealth.status === 'warning' ? 'bg-yellow-500/10' : 'bg-red-500/10'
                }`}>
                  {raidHealth.status === 'healthy' ? (
                    <Activity className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className={`h-5 w-5 ${
                      raidHealth.status === 'warning' ? 'text-yellow-500' : 'text-red-500'
                    }`} />
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sante RAID</p>
                  <p className="text-lg font-semibold capitalize">{raidHealth.status}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
                <div>
                  <p className="text-2xl font-bold">{raidHealth.arrays_total || 0}</p>
                  <p className="text-sm text-muted-foreground">Arrays</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{raidHealth.arrays_healthy || 0}</p>
                  <p className="text-sm text-muted-foreground">OK</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">{(raidHealth.arrays_degraded || 0) + (raidHealth.arrays_failed || 0)}</p>
                  <p className="text-sm text-muted-foreground">Alertes</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
