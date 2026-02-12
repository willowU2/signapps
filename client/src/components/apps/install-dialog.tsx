'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { storeApi } from '@/lib/api';
import type { StoreApp, AppDetails, ParsedService } from '@/lib/api';
import { toast } from 'sonner';

interface InstallDialogProps {
  app: StoreApp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstalled?: () => void;
}

export function InstallDialog({ app, open, onOpenChange, onInstalled }: InstallDialogProps) {
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [details, setDetails] = useState<AppDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [containerName, setContainerName] = useState('');
  const [autoStart, setAutoStart] = useState(true);
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [portValues, setPortValues] = useState<{ host: number; container: number; protocol: string }[]>([]);
  const [volumeValues, setVolumeValues] = useState<{ source: string; target: string }[]>([]);

  // Fetch compose details when dialog opens
  useEffect(() => {
    if (!app || !open) return;

    setLoading(true);
    setError(null);
    setDetails(null);

    storeApi
      .getAppDetails(app.source_id, app.id)
      .then((res) => {
        const data = res.data;
        setDetails(data);

        // Initialize form from first service
        const svc = data.config.services[0];
        if (svc) {
          setContainerName(svc.container_name || app.id.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
          const envMap: Record<string, string> = {};
          svc.environment.forEach((e) => {
            envMap[e.key] = e.default || '';
          });
          setEnvValues(envMap);
          setPortValues(svc.ports.map((p) => ({ ...p })));
          setVolumeValues(svc.volumes.map((v) => ({ source: v.source, target: v.target })));
        }
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message || 'Failed to load app details');
      })
      .finally(() => setLoading(false));
  }, [app, open]);

  const handleInstall = async () => {
    if (!app || !details) return;

    setInstalling(true);
    try {
      await storeApi.install({
        app_id: app.id,
        source_id: app.source_id,
        container_name: containerName,
        environment: envValues,
        ports: portValues,
        volumes: volumeValues,
        auto_start: autoStart,
      });
      toast.success(`${app.name} installed successfully`);
      onOpenChange(false);
      onInstalled?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Installation failed';
      toast.error(message);
    } finally {
      setInstalling(false);
    }
  };

  const svc: ParsedService | undefined = details?.config.services[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Install {app?.name}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {svc && !loading && (
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
              <TabsTrigger value="ports" className="flex-1">
                Ports {svc.ports.length > 0 && `(${svc.ports.length})`}
              </TabsTrigger>
              <TabsTrigger value="env" className="flex-1">
                Env {svc.environment.length > 0 && `(${svc.environment.length})`}
              </TabsTrigger>
              <TabsTrigger value="volumes" className="flex-1">
                Volumes {svc.volumes.length > 0 && `(${svc.volumes.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Container Name</Label>
                <Input
                  value={containerName}
                  onChange={(e) => setContainerName(e.target.value)}
                  placeholder="my-container"
                />
              </div>
              <div className="space-y-2">
                <Label>Image</Label>
                <Input value={svc.image} disabled />
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto-start after creation</Label>
                <Switch checked={autoStart} onCheckedChange={setAutoStart} />
              </div>
            </TabsContent>

            <TabsContent value="ports" className="space-y-3 pt-4">
              {portValues.length === 0 && (
                <p className="text-sm text-muted-foreground">No ports configured</p>
              )}
              {portValues.map((port, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Host Port</Label>
                    <Input
                      type="number"
                      value={port.host}
                      onChange={(e) => {
                        const next = [...portValues];
                        next[i] = { ...next[i], host: parseInt(e.target.value) || 0 };
                        setPortValues(next);
                      }}
                    />
                  </div>
                  <span className="mt-6 text-muted-foreground">:</span>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Container Port</Label>
                    <Input type="number" value={port.container} disabled />
                  </div>
                  <div className="w-16 space-y-1">
                    <Label className="text-xs">Proto</Label>
                    <Input value={port.protocol} disabled className="text-center" />
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="env" className="space-y-3 pt-4">
              {svc.environment.length === 0 && (
                <p className="text-sm text-muted-foreground">No environment variables</p>
              )}
              {svc.environment.map((env) => (
                <div key={env.key} className="space-y-1">
                  <Label className="text-xs font-mono">{env.key}</Label>
                  <Input
                    type={env.key.toLowerCase().includes('password') || env.key.toLowerCase().includes('secret') ? 'password' : 'text'}
                    value={envValues[env.key] || ''}
                    placeholder={env.default || ''}
                    onChange={(e) =>
                      setEnvValues((prev) => ({ ...prev, [env.key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </TabsContent>

            <TabsContent value="volumes" className="space-y-3 pt-4">
              {volumeValues.length === 0 && (
                <p className="text-sm text-muted-foreground">No volumes configured</p>
              )}
              {volumeValues.map((vol, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Host Path / Volume</Label>
                    <Input
                      value={vol.source}
                      onChange={(e) => {
                        const next = [...volumeValues];
                        next[i] = { ...next[i], source: e.target.value };
                        setVolumeValues(next);
                      }}
                    />
                  </div>
                  <span className="mt-6 text-muted-foreground">:</span>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Container Path</Label>
                    <Input value={vol.target} disabled />
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleInstall}
            disabled={loading || installing || !svc}
          >
            {installing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Installing...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Install
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
