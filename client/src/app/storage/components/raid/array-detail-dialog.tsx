'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Database,
  HardDrive,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import type { RaidArray } from '@/lib/api';

interface ArrayDetailDialogProps {
  array: RaidArray | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function ArrayDetailDialog({ array, open, onOpenChange }: ArrayDetailDialogProps) {
  if (!array) return null;

  const usagePercent = array.total_size_bytes > 0
    ? ((array.used_size_bytes ?? 0) / array.total_size_bytes) * 100
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {array.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Device</label>
              <p className="font-medium font-mono">{array.device_path}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Niveau RAID</label>
              <p className="font-medium uppercase">{array.raid_level}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Capacité totale</label>
              <p className="font-medium">{formatBytes(array.total_size_bytes)}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Statut</label>
              <div className="flex items-center gap-2 mt-1">
                {array.status === 'active' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : array.status === 'rebuilding' ? (
                  <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
                <Badge
                  variant={array.status === 'active' ? 'default' :
                    array.status === 'degraded' ? 'secondary' : 'destructive'}
                  className="capitalize"
                >
                  {array.status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Usage */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Espace utilisé</span>
              <span>
                {formatBytes(array.used_size_bytes)} / {formatBytes(array.total_size_bytes)}
                ({usagePercent.toFixed(1)}%)
              </span>
            </div>
            <Progress value={usagePercent} className="h-3" />
          </div>

          {/* Rebuild Progress */}
          {array.status === 'rebuilding' && array.rebuild_progress !== undefined && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                <span className="font-medium text-blue-700 dark:text-blue-300">
                  Reconstruction en cours
                </span>
              </div>
              <Progress value={array.rebuild_progress} className="h-2" />
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                {array.rebuild_progress}% complété
              </p>
            </div>
          )}

          <Separator />

          {/* Disks */}
          <div>
            <h4 className="font-medium mb-4">
              Disques ({array.disks?.length || 0})
            </h4>
            {array.disks && array.disks.length > 0 ? (
              <div className="space-y-2">
                {array.disks.map((disk, index) => (
                  <div
                    key={disk.id}
                    className="flex items-center gap-4 rounded-lg border p-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-sm font-medium">
                      {disk.slot_number ?? index}
                    </div>
                    <HardDrive className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{disk.device_path}</span>
                        <Badge
                          variant={disk.status === 'healthy' ? 'default' :
                            disk.status === 'spare' ? 'secondary' : 'destructive'}
                          className="capitalize text-xs"
                        >
                          {disk.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {disk.model || 'Unknown'} - {formatBytes(disk.size_bytes)}
                      </p>
                    </div>
                    {disk.temperature && (
                      <span className={`text-sm ${
                        disk.temperature > 50 ? 'text-red-500' :
                        disk.temperature > 40 ? 'text-yellow-500' : 'text-green-500'
                      }`}>
                        {disk.temperature}°C
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">Aucun disque</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
