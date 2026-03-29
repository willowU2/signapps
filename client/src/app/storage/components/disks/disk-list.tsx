'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  HardDrive,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  ThermometerSun,
  Info,
} from 'lucide-react';
import type { DiskInfo } from '@/lib/api';
import { DiskDetailDialog } from './disk-detail-dialog';

interface DiskListProps {
  disks: DiskInfo[];
  loading?: boolean;
  onScan?: () => Promise<void>;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function DiskList({ disks, loading, onScan }: DiskListProps) {
  const [scanning, setScanning] = useState(false);
  const [selectedDisk, setSelectedDisk] = useState<DiskInfo | null>(null);

  const handleScan = async () => {
    if (!onScan) return;
    setScanning(true);
    try {
      await onScan();
    } finally {
      setScanning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'failing':
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <HardDrive className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      healthy: 'default',
      warning: 'secondary',
      failing: 'destructive',
      failed: 'destructive',
      spare: 'secondary',
    };
    return (
      <Badge variant={variants[status] || 'secondary'} className="capitalize">
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Disques Physiques</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Disques Physiques ({disks.length})</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleScan}
            disabled={scanning}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
            Scanner
          </Button>
        </CardHeader>
        <CardContent>
          {disks.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Aucun disque détecté
            </div>
          ) : (
            <div className="space-y-3">
              {disks.map((disk) => (
                <div
                  key={disk.id}
                  className="flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedDisk(disk)}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <HardDrive className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{disk.device_path}</span>
                      {getStatusIcon(disk.status)}
                      {getStatusBadge(disk.status)}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{disk.model || 'Unknown'}</span>
                      <span>{formatBytes(disk.size_bytes)}</span>
                      {disk.serial_number && (
                        <span className="truncate max-w-[200px]">SN: {disk.serial_number}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {disk.temperature && (
                      <div className="flex items-center gap-1 text-sm">
                        <ThermometerSun className={`h-4 w-4 ${
                          disk.temperature > 50 ? 'text-red-500' :
                          disk.temperature > 40 ? 'text-yellow-500' : 'text-green-500'
                        }`} />
                        <span>{disk.temperature}°C</span>
                      </div>
                    )}
                    {disk.array_id && (
                      <Badge variant="outline">RAID</Badge>
                    )}
                    <Button variant="ghost" size="icon">
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DiskDetailDialog
        disk={selectedDisk}
        open={!!selectedDisk}
        onOpenChange={(open) => !open && setSelectedDisk(null)}
      />
    </>
  );
}
