'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Usb,
  Server,
  Cloud,
  RefreshCw,
  Plus,
  Power,
  MoreVertical,
  Unplug,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ExternalStorage } from '@/lib/api';

interface ExternalListProps {
  storages: ExternalStorage[];
  loading?: boolean;
  onDetect?: () => Promise<void>;
  onConnect?: () => void;
  onDisconnect?: (id: string) => Promise<void>;
  onEject?: (id: string) => Promise<void>;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '-';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function ExternalList({
  storages,
  loading,
  onDetect,
  onConnect,
  onDisconnect,
  onEject,
}: ExternalListProps) {
  const [detecting, setDetecting] = useState(false);

  const handleDetect = async () => {
    if (!onDetect) return;
    setDetecting(true);
    try {
      await onDetect();
    } finally {
      setDetecting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'usb':
        return <Usb className="h-5 w-5 text-orange-500" />;
      case 'nas':
      case 'smb':
      case 'nfs':
        return <Server className="h-5 w-5 text-blue-500" />;
      case 's3':
      case 'cloud':
        return <Cloud className="h-5 w-5 text-purple-500" />;
      default:
        return <Server className="h-5 w-5" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      connected: 'default',
      disconnected: 'secondary',
      mounting: 'secondary',
      error: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'secondary'} className="capitalize">
        {status === 'connected' ? 'Connecté' :
         status === 'disconnected' ? 'Déconnecté' :
         status === 'mounting' ? 'Montage...' : 'Erreur'}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stockages Externes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Stockages Externes ({storages.length})</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDetect} disabled={detecting}>
            <RefreshCw className={`mr-2 h-4 w-4 ${detecting ? 'animate-spin' : ''}`} />
            Détecter
          </Button>
          <Button size="sm" onClick={onConnect}>
            <Plus className="mr-2 h-4 w-4" />
            Connecter
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {storages.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Usb className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>Aucun stockage externe détecté</p>
            <div className="mt-4 space-x-2">
              <Button variant="outline" onClick={handleDetect}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Détecter les périphériques
              </Button>
              <Button variant="outline" onClick={onConnect}>
                <Plus className="mr-2 h-4 w-4" />
                Connecter un NAS
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {storages.map((storage) => (
              <div
                key={storage.id}
                className="flex items-center gap-4 rounded-lg border p-4"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  {getTypeIcon(storage.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{storage.name}</span>
                    {getStatusBadge(storage.status)}
                    <Badge variant="outline" className="uppercase text-xs">
                      {storage.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    {storage.mount_point && (
                      <span>{storage.mount_point}</span>
                    )}
                    {storage.size_bytes && (
                      <span>{formatBytes(storage.size_bytes)}</span>
                    )}
                    {storage.error_message && (
                      <span className="text-red-500">{storage.error_message}</span>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {storage.status === 'connected' && storage.type === 'usb' && onEject && (
                      <DropdownMenuItem onClick={() => onEject(storage.id)}>
                        <Power className="mr-2 h-4 w-4" />
                        Éjecter
                      </DropdownMenuItem>
                    )}
                    {onDisconnect && (
                      <DropdownMenuItem
                        onClick={() => onDisconnect(storage.id)}
                        className="text-destructive"
                      >
                        <Unplug className="mr-2 h-4 w-4" />
                        Déconnecter
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
