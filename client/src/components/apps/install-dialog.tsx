'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  AlertTriangle,
  Plus,
  Settings,
  Trash2,
} from 'lucide-react';
import { storeApi } from '@/lib/api';
import type {
  StoreApp,
  AppDetails,
  ParsedService,
  PortConflict,
} from '@/lib/api';
import { toast } from 'sonner';
import { getContainerUrl } from '@/lib/utils';
import { InstallProgress } from './install-progress';

interface InstallDialogProps {
  app: StoreApp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstalled?: () => void;
}

interface ServiceFormState {
  containerName: string;
  envValues: Record<string, string>;
  portValues: { host: number; container: number; protocol: string }[];
  volumeValues: { source: string; target: string }[];
}

export function InstallDialog({
  app,
  open,
  onOpenChange,
  onInstalled,
}: InstallDialogProps) {
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [details, setDetails] = useState<AppDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoStart, setAutoStart] = useState(true);
  const [groupName, setGroupName] = useState('');

  // Per-service form state
  const [serviceForms, setServiceForms] = useState<Map<string, ServiceFormState>>(
    new Map()
  );

  // Port conflicts
  const [portConflicts, setPortConflicts] = useState<Map<number, PortConflict>>(
    new Map()
  );

  // Multi-service progress
  const [installId, setInstallId] = useState<string | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);

  // One-click vs advanced mode
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isMultiService = (details?.config.services.length ?? 0) > 1;

  // Helper: resolve {ServiceName} template with actual container name
  const resolveServiceName = (val: string, name: string) =>
    val.replace(/\{ServiceName\}/g, name);

  // Fetch compose details when dialog opens
  useEffect(() => {
    if (!app || !open) return;

    setLoading(true);
    setError(null);
    setDetails(null);
    setPortConflicts(new Map());
    setInstallId(null);
    setShowAdvanced(false);

    storeApi
      .getAppDetails(app.source_id, app.id)
      .then((res) => {
        const data = res.data;
        setDetails(data);

        // Initialize per-service forms
        const forms = new Map<string, ServiceFormState>();
        const baseName = app.id.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        setGroupName(baseName);

        data.config.services.forEach((svc) => {
          // Resolve {ServiceName} in container_name if present
          const resolvedContainerName = svc.container_name
            ? resolveServiceName(svc.container_name, baseName)
            : null;

          const name =
            data.config.services.length === 1
              ? resolvedContainerName || baseName
              : `${baseName}-${svc.service_name}`;

          // Resolve {ServiceName} in env defaults
          const envMap: Record<string, string> = {};
          svc.environment.forEach((e) => {
            envMap[e.key] = resolveServiceName(e.default || '', name);
          });

          forms.set(svc.service_name, {
            containerName: name,
            envValues: envMap,
            portValues: svc.ports.map((p) => ({ ...p })),
            // Resolve {ServiceName} in volume sources
            volumeValues: svc.volumes.map((v) => ({
              source: resolveServiceName(v.source, name),
              target: v.target,
            })),
          });
        });
        setServiceForms(forms);
      })
      .catch((err) => {
        setError(
          err.response?.data?.detail || err.message || 'Failed to load app details'
        );
      })
      .finally(() => setLoading(false));
  }, [app, open]);

  // Debounced port conflict check
  const checkPortConflicts = useCallback(async () => {
    const allPorts: number[] = [];
    serviceForms.forEach((form) => {
      form.portValues.forEach((p) => {
        if (p.host > 0) allPorts.push(p.host);
      });
    });
    if (allPorts.length === 0) return;

    try {
      const res = await storeApi.checkPorts(allPorts);
      const map = new Map<number, PortConflict>();
      res.data.forEach((c) => {
        if (c.in_use) map.set(c.port, c);
      });
      setPortConflicts(map);
    } catch {
      // ignore
    }
  }, [serviceForms]);

  useEffect(() => {
    const timer = setTimeout(checkPortConflicts, 500);
    return () => clearTimeout(timer);
  }, [checkPortConflicts]);

  const updateServiceForm = (
    serviceName: string,
    update: Partial<ServiceFormState>
  ) => {
    setServiceForms((prev) => {
      const next = new Map(prev);
      const existing = next.get(serviceName);
      if (existing) {
        next.set(serviceName, { ...existing, ...update });
      }
      return next;
    });
  };

  const handleInstall = async () => {
    if (!app || !details) return;

    setInstalling(true);
    try {
      if (isMultiService) {
        // Multi-service install
        const services = details.config.services.map((svc) => {
          const form = serviceForms.get(svc.service_name);
          return {
            service_name: svc.service_name,
            container_name: form?.containerName || svc.service_name,
            environment: form?.envValues,
            ports: showAdvanced
              ? (() => {
                  const valid = (form?.portValues || []).filter(
                    (p) => p.host > 0 && p.container > 0
                  );
                  return valid.length > 0
                    ? valid.map((p) => ({
                        host: p.host,
                        container: p.container,
                        protocol: p.protocol,
                      }))
                    : undefined;
                })()
              : undefined,
            volumes: showAdvanced ? form?.volumeValues : undefined,
          };
        });

        const res = await storeApi.installMulti({
          app_id: app.id,
          source_id: app.source_id,
          group_name: groupName,
          services,
          auto_start: autoStart,
        });

        setInstallId(res.data.install_id);
        setProgressOpen(true);
      } else {
        // Single-service install
        const form = serviceForms.values().next().value;
        if (!form) return;

        const validPorts = form.portValues.filter(
          (p) => p.host > 0 && p.container > 0
        );
        const res = await storeApi.install({
          app_id: app.id,
          source_id: app.source_id,
          container_name: form.containerName,
          environment: form.envValues,
          ports: showAdvanced
            ? validPorts.length > 0
              ? validPorts
              : undefined
            : undefined,
          volumes: showAdvanced ? form.volumeValues : undefined,
          auto_start: autoStart,
        });

        // Extract URL from install response
        const portMappings = (res.data?.docker_info?.ports || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((p: any) => p.host_port)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((p: any) => ({
            host: p.host_port as number,
            container: p.container_port as number,
            protocol: (p.protocol as string) || 'tcp',
          }));
        const appUrl = getContainerUrl(portMappings);

        if (appUrl) {
          toast.success(`${app.name} installed`, {
            action: {
              label: 'Open',
              onClick: () => window.open(appUrl, '_blank'),
            },
          });
        } else {
          toast.success(`${app.name} installed successfully`);
        }
        onOpenChange(false);
        onInstalled?.();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Installation failed';
      toast.error(message);
    } finally {
      setInstalling(false);
    }
  };

  const services = details?.config.services || [];

  const renderServiceForm = (svc: ParsedService) => {
    const form = serviceForms.get(svc.service_name);
    if (!form) return null;

    return (
      <div key={svc.service_name} className="space-y-4">
        <div className="space-y-2">
          <Label>Container Name</Label>
          <Input
            value={form.containerName}
            onChange={(e) =>
              updateServiceForm(svc.service_name, {
                containerName: e.target.value,
              })
            }
            placeholder="my-container"
          />
        </div>
        <div className="space-y-2">
          <Label>Image</Label>
          <Input value={svc.image} disabled />
        </div>

        {/* Ports */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Ports</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => {
                updateServiceForm(svc.service_name, {
                  portValues: [
                    ...form.portValues,
                    { host: 0, container: 0, protocol: 'tcp' },
                  ],
                });
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add port
            </Button>
          </div>
          {form.portValues.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No ports configured. Exposed ports will be auto-assigned on install.
            </p>
          ) : (
            form.portValues.map((port, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    type="number"
                    value={port.host || ''}
                    placeholder="Host"
                    onChange={(e) => {
                      const next = [...form.portValues];
                      next[i] = {
                        ...next[i],
                        host: parseInt(e.target.value) || 0,
                      };
                      updateServiceForm(svc.service_name, {
                        portValues: next,
                      });
                    }}
                  />
                  {portConflicts.has(port.host) && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      Port {port.host} in use by{' '}
                      {portConflicts.get(port.host)?.used_by || 'another container'}
                    </p>
                  )}
                </div>
                <span className="text-muted-foreground">:</span>
                <div className="flex-1">
                  <Input
                    type="number"
                    value={port.container || ''}
                    placeholder="Container"
                    onChange={(e) => {
                      const next = [...form.portValues];
                      next[i] = {
                        ...next[i],
                        container: parseInt(e.target.value) || 0,
                      };
                      updateServiceForm(svc.service_name, {
                        portValues: next,
                      });
                    }}
                  />
                </div>
                <div className="w-14">
                  <Input
                    value={port.protocol}
                    disabled
                    className="text-center text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    const next = form.portValues.filter((_, j) => j !== i);
                    updateServiceForm(svc.service_name, {
                      portValues: next,
                    });
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Environment */}
        {svc.environment.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">Environment</Label>
            {svc.environment.map((env) => (
              <div key={env.key} className="space-y-1">
                <Label className="text-xs font-mono">{env.key}</Label>
                <Input
                  type={
                    env.key.toLowerCase().includes('password') ||
                    env.key.toLowerCase().includes('secret')
                      ? 'password'
                      : 'text'
                  }
                  value={form.envValues[env.key] || ''}
                  placeholder={env.default || ''}
                  onChange={(e) =>
                    updateServiceForm(svc.service_name, {
                      envValues: {
                        ...form.envValues,
                        [env.key]: e.target.value,
                      },
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}

        {/* Volumes */}
        {form.volumeValues.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">Volumes</Label>
            {form.volumeValues.map((vol, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    value={vol.source}
                    onChange={(e) => {
                      const next = [...form.volumeValues];
                      next[i] = { ...next[i], source: e.target.value };
                      updateServiceForm(svc.service_name, {
                        volumeValues: next,
                      });
                    }}
                  />
                </div>
                <span className="text-muted-foreground">:</span>
                <div className="flex-1">
                  <Input value={vol.target} disabled />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open && !progressOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Install {app?.name}</DialogTitle>
            {isMultiService && (
              <p className="text-sm text-muted-foreground">
                This app has {services.length} services that will be installed
                together.
              </p>
            )}
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

          {!loading && services.length > 0 && (
            <div className="space-y-4">
              {/* Auto-start toggle */}
              <div className="flex items-center justify-between">
                <Label>Auto-start after creation</Label>
                <Switch checked={autoStart} onCheckedChange={setAutoStart} />
              </div>

              {isMultiService ? (
                // Multi-service
                <div className="space-y-3">
                  {showAdvanced ? (
                    // Advanced: collapsible per service
                    services.map((svc) => (
                      <Collapsible key={svc.service_name} defaultOpen>
                        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 hover:bg-muted/50">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-mono">
                              {svc.service_name}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {svc.image}
                            </span>
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-1 pt-3">
                          {renderServiceForm(svc)}
                        </CollapsibleContent>
                      </Collapsible>
                    ))
                  ) : (
                    // Simple: just service list
                    services.map((svc) => (
                      <div
                        key={svc.service_name}
                        className="flex items-center gap-2 rounded-lg border p-3"
                      >
                        <Badge variant="outline" className="text-xs font-mono">
                          {svc.service_name}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {svc.image}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                // Single-service
                services[0] && (
                  <div className="space-y-4">
                    {/* Always show container name + image */}
                    <div className="space-y-2">
                      <Label>Container Name</Label>
                      <Input
                        value={
                          serviceForms.get(services[0].service_name)
                            ?.containerName || ''
                        }
                        onChange={(e) =>
                          updateServiceForm(services[0].service_name, {
                            containerName: e.target.value,
                          })
                        }
                        placeholder="my-container"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Image</Label>
                      <Input value={services[0].image} disabled />
                    </div>

                    {/* Advanced: Ports/Env/Volumes tabs */}
                    {showAdvanced && (
                      <Tabs defaultValue="ports" className="w-full">
                        <TabsList className="w-full">
                          <TabsTrigger value="ports" className="flex-1">
                            Ports{' '}
                            {services[0].ports.length > 0 &&
                              `(${services[0].ports.length})`}
                          </TabsTrigger>
                          <TabsTrigger value="env" className="flex-1">
                            Env{' '}
                            {services[0].environment.length > 0 &&
                              `(${services[0].environment.length})`}
                          </TabsTrigger>
                          <TabsTrigger value="volumes" className="flex-1">
                            Volumes{' '}
                            {services[0].volumes.length > 0 &&
                              `(${services[0].volumes.length})`}
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="ports" className="space-y-3 pt-4">
                          {(() => {
                            const form = serviceForms.get(
                              services[0].service_name
                            );
                            if (!form) return null;
                            return (
                              <>
                                {form.portValues.length === 0 && (
                                  <p className="text-sm text-muted-foreground">
                                    No ports configured. Exposed ports will be auto-assigned on install.
                                  </p>
                                )}
                                {form.portValues.map((port, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <div className="flex-1 space-y-1">
                                      <Label className="text-xs">Host Port</Label>
                                      <Input
                                        type="number"
                                        value={port.host || ''}
                                        placeholder="Host"
                                        onChange={(e) => {
                                          const next = [...form.portValues];
                                          next[i] = {
                                            ...next[i],
                                            host: parseInt(e.target.value) || 0,
                                          };
                                          updateServiceForm(
                                            services[0].service_name,
                                            { portValues: next }
                                          );
                                        }}
                                      />
                                      {portConflicts.has(port.host) && (
                                        <p className="flex items-center gap-1 text-xs text-destructive">
                                          <AlertTriangle className="h-3 w-3" />
                                          In use by{' '}
                                          {portConflicts.get(port.host)?.used_by ||
                                            'another container'}
                                        </p>
                                      )}
                                    </div>
                                    <span className="mt-6 text-muted-foreground">
                                      :
                                    </span>
                                    <div className="flex-1 space-y-1">
                                      <Label className="text-xs">Container Port</Label>
                                      <Input
                                        type="number"
                                        value={port.container || ''}
                                        placeholder="Container"
                                        onChange={(e) => {
                                          const next = [...form.portValues];
                                          next[i] = {
                                            ...next[i],
                                            container: parseInt(e.target.value) || 0,
                                          };
                                          updateServiceForm(
                                            services[0].service_name,
                                            { portValues: next }
                                          );
                                        }}
                                      />
                                    </div>
                                    <div className="w-16 space-y-1">
                                      <Label className="text-xs">Proto</Label>
                                      <Input
                                        value={port.protocol}
                                        disabled
                                        className="text-center"
                                      />
                                    </div>
                                    <div className="mt-6">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => {
                                          const next = form.portValues.filter((_, j) => j !== i);
                                          updateServiceForm(
                                            services[0].service_name,
                                            { portValues: next }
                                          );
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    updateServiceForm(
                                      services[0].service_name,
                                      {
                                        portValues: [
                                          ...form.portValues,
                                          { host: 0, container: 0, protocol: 'tcp' },
                                        ],
                                      }
                                    );
                                  }}
                                >
                                  <Plus className="mr-1 h-3 w-3" />
                                  Add port
                                </Button>
                              </>
                            );
                          })()}
                        </TabsContent>

                        <TabsContent value="env" className="space-y-3 pt-4">
                          {services[0].environment.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No environment variables
                            </p>
                          ) : (
                            services[0].environment.map((env) => {
                              const form = serviceForms.get(
                                services[0].service_name
                              );
                              return (
                                <div key={env.key} className="space-y-1">
                                  <Label className="text-xs font-mono">
                                    {env.key}
                                  </Label>
                                  <Input
                                    type={
                                      env.key.toLowerCase().includes('password') ||
                                      env.key.toLowerCase().includes('secret')
                                        ? 'password'
                                        : 'text'
                                    }
                                    value={form?.envValues[env.key] || ''}
                                    placeholder={env.default || ''}
                                    onChange={(e) =>
                                      updateServiceForm(
                                        services[0].service_name,
                                        {
                                          envValues: {
                                            ...form?.envValues,
                                            [env.key]: e.target.value,
                                          },
                                        }
                                      )
                                    }
                                  />
                                </div>
                              );
                            })
                          )}
                        </TabsContent>

                        <TabsContent value="volumes" className="space-y-3 pt-4">
                          {(() => {
                            const form = serviceForms.get(
                              services[0].service_name
                            );
                            if (!form || form.volumeValues.length === 0)
                              return (
                                <p className="text-sm text-muted-foreground">
                                  No volumes configured
                                </p>
                              );
                            return form.volumeValues.map((vol, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <div className="flex-1 space-y-1">
                                  <Label className="text-xs">
                                    Host Path / Volume
                                  </Label>
                                  <Input
                                    value={vol.source}
                                    onChange={(e) => {
                                      const next = [...form.volumeValues];
                                      next[i] = {
                                        ...next[i],
                                        source: e.target.value,
                                      };
                                      updateServiceForm(
                                        services[0].service_name,
                                        { volumeValues: next }
                                      );
                                    }}
                                  />
                                </div>
                                <span className="mt-6 text-muted-foreground">
                                  :
                                </span>
                                <div className="flex-1 space-y-1">
                                  <Label className="text-xs">Container Path</Label>
                                  <Input value={vol.target} disabled />
                                </div>
                              </div>
                            ));
                          })()}
                        </TabsContent>
                      </Tabs>
                    )}
                  </div>
                )
              )}

              {/* Advanced settings toggle */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <Settings className="mr-1 h-3 w-3" />
                {showAdvanced ? 'Hide advanced settings' : 'Advanced settings'}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInstall}
              disabled={loading || installing || services.length === 0}
            >
              {installing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Install{isMultiService ? ` (${services.length} services)` : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progress dialog for multi-service installs */}
      <InstallProgress
        installId={installId}
        serviceNames={services.map((s) => s.service_name)}
        open={progressOpen}
        onOpenChange={(open) => {
          setProgressOpen(open);
          if (!open) {
            onOpenChange(false);
            onInstalled?.();
          }
        }}
        onComplete={onInstalled}
      />
    </>
  );
}
