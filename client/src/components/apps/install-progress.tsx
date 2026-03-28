'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Download, Circle } from 'lucide-react';
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

  /* 
   * Replaced EventSource with fetch + ReadableStream to support Authorization header
   * and prevent token leakage in URL logs/history.
   */
  useEffect(() => {
    if (!installId || !open) return;

    // Reset state
    const initial = new Map<string, ServiceStatus>();
    serviceNames.forEach((name) => initial.set(name, 'waiting'));
    setStatuses(initial);
    setError(null);
    setComplete(false);

    const abortController = new AbortController();

    const fetchProgress = async () => {
      try {
        const url = getInstallProgressUrl(installId);
        const response = await fetch(url, {
          credentials: 'include',
          headers: {
            'Accept': 'text/event-stream',
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Échec de la connexion: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = line.slice(6);
                const event: InstallEvent = JSON.parse(data);

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
                      toast.success('Installation terminée');
                      onComplete?.();
                      break;
                  }
                  return next;
                });
              } catch {
                // ignore
              }
            }
          }
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Connection lost');
        }
      }
    };

    fetchProgress();

    return () => {
      abortController.abort();
    };
  }, [installId, open, serviceNames, onComplete]);

  const getIcon = (status: ServiceStatus) => {
    switch (status) {
      case 'waiting':
        return <Circle className="h-4 w-4 text-muted-foreground" />;
      case 'pulling':
      case 'creating':
      case 'starting':
        return <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4  text-blue-500" />;
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
              <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />
              Installing...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
