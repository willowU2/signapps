'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Database,
  Plus,
  HardDrive,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Activity,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { RaidArray, RaidHealth } from '@/lib/api';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ArrayDetailDialog } from './array-detail-dialog';
import { CreateArrayDialog } from './create-array-dialog';

interface RaidOverviewProps {
  arrays: RaidArray[];
  health: RaidHealth | null;
  loading?: boolean;
  onRefresh?: () => void;
  onCreateArray?: (data: { name: string; raid_level: string; disk_ids: string[] }) => Promise<void>;
  onDeleteArray?: (id: string) => Promise<void>;
  onRebuildArray?: (id: string) => Promise<void>;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function RaidOverview({
  arrays,
  health,
  loading,
  onRefresh,
  onCreateArray,
  onDeleteArray,
  onRebuildArray,
}: RaidOverviewProps) {
  const [selectedArray, setSelectedArray] = useState<RaidArray | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteArrayId, setDeleteArrayId] = useState<string | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'rebuilding':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Database className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      degraded: 'secondary',
      rebuilding: 'outline',
      failed: 'destructive',
      inactive: 'secondary',
    };
    return (
      <Badge variant={variants[status] || 'secondary'} className="capitalize">
        {status}
      </Badge>
    );
  };

  const getRaidLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      raid0: 'bg-blue-500',
      raid1: 'bg-green-500',
      raid5: 'bg-purple-500',
      raid6: 'bg-indigo-500',
      raid10: 'bg-orange-500',
      raidz: 'bg-cyan-500',
      raidz2: 'bg-teal-500',
    };
    return colors[level] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Health Summary */}
      {health && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                  health.status === 'healthy' ? 'bg-green-500/10' :
                  health.status === 'warning' ? 'bg-yellow-500/10' : 'bg-red-500/10'
                }`}>
                  <Activity className={`h-6 w-6 ${
                    health.status === 'healthy' ? 'text-green-500' :
                    health.status === 'warning' ? 'text-yellow-500' : 'text-red-500'
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Santé Globale</p>
                  <p className="text-xl font-bold capitalize">{health.status}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
                <div>
                  <p className="text-2xl font-bold">{health.arrays_total}</p>
                  <p className="text-sm text-muted-foreground">Arrays</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{health.arrays_healthy}</p>
                  <p className="text-sm text-muted-foreground">OK</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{health.arrays_degraded}</p>
                  <p className="text-sm text-muted-foreground">Dégradés</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{health.disks_total}</p>
                  <p className="text-sm text-muted-foreground">Disques</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Arrays List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Arrays RAID</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvel Array
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {arrays.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Database className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>Aucun array RAID configuré</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Créer un Array
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {arrays.map((array) => (
                <div
                  key={array.id}
                  className="rounded-lg border p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedArray(array)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${getRaidLevelColor(array.raid_level)} text-white font-bold text-xs`}>
                        {array.raid_level.replace('raid', 'R').toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{array.name}</span>
                          {getStatusIcon(array.status)}
                          {getStatusBadge(array.status)}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>{array.device_path}</span>
                          <span>{formatBytes(array.total_size_bytes)}</span>
                          <span className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            {array.disks?.length || 0} disques
                          </span>
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {array.status === 'degraded' && onRebuildArray && (
                          <DropdownMenuItem onClick={() => onRebuildArray(array.id)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Reconstruire
                          </DropdownMenuItem>
                        )}
                        {onDeleteArray && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteArrayId(array.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Usage Bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Utilisation</span>
                      <span>
                        {formatBytes(array.used_size_bytes ?? 0)} / {formatBytes(array.total_size_bytes ?? 0)}
                      </span>
                    </div>
                    <Progress
                      value={array.total_size_bytes > 0
                        ? ((array.used_size_bytes ?? 0) / array.total_size_bytes) * 100
                        : 0}
                      className="h-2"
                    />
                  </div>

                  {/* Rebuild Progress */}
                  {array.status === 'rebuilding' && array.rebuild_progress !== undefined && (
                    <div className="mt-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-blue-500 flex items-center gap-1">
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          Reconstruction en cours
                        </span>
                        <span>{array.rebuild_progress}%</span>
                      </div>
                      <Progress value={array.rebuild_progress} className="h-2" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <ArrayDetailDialog
        array={selectedArray}
        open={!!selectedArray}
        onOpenChange={(open) => !open && setSelectedArray(null)}
      />

      {/* Create Dialog */}
      <CreateArrayDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={async (data) => {
          if (onCreateArray) {
            await onCreateArray(data);
          }
          setCreateDialogOpen(false);
        }}
      />

      {/* Delete Array Confirmation */}
      <ConfirmDialog
        open={deleteArrayId !== null}
        onOpenChange={(open) => { if (!open) setDeleteArrayId(null); }}
        title="Supprimer l'array RAID"
        description="Cette action est irréversible. Toutes les données de cet array seront perdues."
        onConfirm={() => {
          if (deleteArrayId && onDeleteArray) onDeleteArray(deleteArrayId);
          setDeleteArrayId(null);
        }}
      />
    </div>
  );
}
