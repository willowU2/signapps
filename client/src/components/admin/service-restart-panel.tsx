'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RefreshCw, Power, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getClient, ServiceName } from '@/lib/api/factory';
import { toast } from 'sonner';

const SERVICES = [
  { id: 'identity', name: 'Identity', svc: ServiceName.IDENTITY, port: 3001 },
  { id: 'storage', name: 'Storage', svc: ServiceName.STORAGE, port: 3004 },
  { id: 'mail', name: 'Mail', svc: ServiceName.MAIL, port: 3012 },
  { id: 'calendar', name: 'Calendar', svc: ServiceName.CALENDAR, port: 3011 },
  { id: 'ai', name: 'AI', svc: ServiceName.AI, port: 3005 },
  { id: 'scheduler', name: 'Scheduler', svc: ServiceName.SCHEDULER, port: 3007 },
  { id: 'metrics', name: 'Metrics', svc: ServiceName.METRICS, port: 3008 },
  { id: 'containers', name: 'Containers', svc: ServiceName.CONTAINERS, port: 3002 },
];

export function ServiceRestartPanel() {
  const [confirmService, setConfirmService] = useState<typeof SERVICES[0] | null>(null);
  const [restarting, setRestarting] = useState<Record<string, boolean>>({});

  const { data: healthMap, refetch } = useQuery({
    queryKey: ['service-health-all'],
    queryFn: async () => {
      const results: Record<string, boolean> = {};
      await Promise.allSettled(
        SERVICES.map(async (s) => {
          try {
            const client = getClient(s.svc);
            await client.get('/health', { timeout: 3000 });
            results[s.id] = true;
          } catch {
            results[s.id] = false;
          }
        })
      );
      return results;
    },
    refetchInterval: 30000,
  });

  const restartService = async (svc: typeof SERVICES[0]) => {
    setRestarting(prev => ({ ...prev, [svc.id]: true }));
    try {
      const client = getClient(svc.svc);
      await client.post('/admin/restart', {});
      toast.success(`${svc.name} restart initiated`);
      // Wait then re-check health
      setTimeout(() => {
        refetch();
        setRestarting(prev => ({ ...prev, [svc.id]: false }));
      }, 4000);
    } catch {
      toast.error(`Failed to restart ${svc.name}`);
      setRestarting(prev => ({ ...prev, [svc.id]: false }));
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Power className="h-5 w-5 text-primary" />
              Service Restart
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SERVICES.map(svc => {
              const healthy = healthMap?.[svc.id];
              const isRestarting = restarting[svc.id];
              return (
                <div key={svc.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    {isRestarting ? (
                      <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />
                    ) : healthy ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{svc.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">:{svc.port}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={healthy ? 'default' : 'destructive'} className={`text-xs ${healthy ? 'bg-green-500' : ''}`}>
                      {isRestarting ? 'restarting' : healthy ? 'online' : 'offline'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmService(svc)}
                      disabled={isRestarting}
                      className="h-7 text-xs gap-1"
                    >
                      <RefreshCw className={`h-3 w-3 ${isRestarting ? 'animate-spin' : ''}`} />
                      Restart
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmService} onOpenChange={(o) => !o && setConfirmService(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restart {confirmService?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will briefly interrupt the {confirmService?.name} service (port {confirmService?.port}).
              Active requests will be terminated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (confirmService) { restartService(confirmService); setConfirmService(null); } }}
            >
              Restart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
