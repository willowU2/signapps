'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, XCircle, Download, Circle } from 'lucide-react';
import { getInstallProgressUrl } from '@/lib/api';
import type { InstallEvent } from '@/lib/api';
import { toast } from 'sonner';

interface InstallProgressProps {
  installId: string | null;
  serviceNames: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

type ServiceStatus = 'waiting' | 'pulling' | 'creating' | 'starting' | 'done' | 'error';

export function InstallProgress({
  installId,
  serviceNames,
  open,
  onOpenChange,
  onComplete,
}: InstallProgressProps) {
  const [statuses, setStatuses] = useState<Map<string, ServiceStatus>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!installId || !open) return;

    // Reset state
    const initial = new Map<string, ServiceStatus>();
    serviceNames.forEach((name) => initial.set(name, 'waiting'));
    setStatuses(initial);
    setError(null);
    setComplete(false);

    const url = getInstallProgressUrl(installId);
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event: InstallEvent = JSON.parse(e.data);
        setStatuses((prev) => {
          const next = new Map(prev);
          switch (event.type) {
            case 'PullingImage':
              if (event.service_name) next.set(event.service_name, 'pulling');
              break;
            case 'CreatingContainer':
              if (event.service_name) next.set(event.service_name, 'creating');
              break;
            case 'Starting':
              if (event.service_name) next.set(event.service_name, 'starting');
              break;
            case 'ServiceReady':
              if (event.service_name) next.set(event.service_name, 'done');
              break;
            case 'Error':
              setError(event.message || 'Installation failed');
              break;
            case 'Complete':
              setComplete(true);
              toast.success('Installation complete');
              onComplete?.();
              break;
          }
          return next;
        });
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [installId, open, serviceNames, onComplete]);

  const getIcon = (status: ServiceStatus) => {
    switch (status) {
      case 'waiting':
        return <Circle className="h-4 w-4 text-muted-foreground" />;
      case 'pulling':
      case 'creating':
      case 'starting':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'done':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getLabel = (status: ServiceStatus) => {
    switch (status) {
      case 'waiting':
        return 'Waiting...';
      case 'pulling':
        return 'Pulling image...';
      case 'creating':
        return 'Creating container...';
      case 'starting':
        return 'Starting...';
      case 'done':
        return 'Ready';
      case 'error':
        return 'Failed';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Installing...
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {serviceNames.map((name) => {
            const status = statuses.get(name) || 'waiting';
            return (
              <div
                key={name}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                {getIcon(status)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {getLabel(status)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <DialogFooter>
          {complete ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : error ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Installing...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
