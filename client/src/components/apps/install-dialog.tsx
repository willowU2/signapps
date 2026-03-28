'use client';

import { SpinnerInfinity } from 'spinners-react';

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
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { CheckCircle, AlertCircle, ChevronDown, AlertTriangle, Plus, Trash2, Globe } from 'lucide-react';
import { storeApi, routesApi } from '@/lib/api';
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
  hostname: string;
  envValues: Record<string, string>;
  customEnvValues: { key: string; value: string }[];
  portValues: { host: number; container: number; protocol: string }[];
  volumeValues: { source: string; target: string }[];
  labelValues: { key: string; value: string }[];
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

          // Extract labels from compose, filtering out signapps.app.* keys
          const labelEntries = Object.entries(svc.labels || {})
            .filter(([k]) => !k.startsWith('signapps.app.'))
            .map(([key, value]) => ({ key, value }));

          forms.set(svc.service_name, {
            containerName: name,
            hostname: '',
            envValues: envMap,
            customEnvValues: [],
            portValues: svc.ports.map((p) => ({ ...p })),
            volumeValues: svc.volumes.map((v) => ({
              source: resolveServiceName(v.source, name),
              target: v.target,
            })),
            labelValues: labelEntries,
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

          // Merge template env + custom env
          const mergedEnv = { ...form?.envValues };
          form?.customEnvValues.forEach((ce) => {
            if (ce.key.trim()) {
              mergedEnv[ce.key.trim()] = ce.value;
            }
          });

          // Build labels map
          const labelsMap: Record<string, string> = {};
          form?.labelValues.forEach((l) => {
            if (l.key.trim()) {
              labelsMap[l.key.trim()] = l.value;
            }
          });

          const validPorts = (form?.portValues || []).filter(
            (p) => p.host > 0 && p.container > 0
          );

          return {
            service_name: svc.service_name,
            container_name: form?.containerName || svc.service_name,
            environment: mergedEnv,
            ports: validPorts.length > 0
              ? validPorts.map((p) => ({
                  host: p.host,
                  container: p.container,
                  protocol: p.protocol,
                }))
              : undefined,
            volumes: form?.volumeValues,
            labels: Object.keys(labelsMap).length > 0 ? labelsMap : undefined,
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

        // Create route for the first service with ports and a hostname
        const firstFormWithHostname = details.config.services
          .map((svc) => serviceForms.get(svc.service_name))
          .find((f) => f && f.hostname.trim());
        if (firstFormWithHostname) {
          const hostPort = firstFormWithHostname.portValues[0]?.host;
          if (hostPort && hostPort > 0) {
            try {
              await routesApi.create({
                name: firstFormWithHostname.containerName,
                host: firstFormWithHostname.hostname.trim(),
                target: `http://localhost:${hostPort}`,
                mode: 'proxy',
                enabled: true,
              });
              toast.success(`Route créée : ${firstFormWithHostname.hostname.trim()}`);
            } catch {
              toast.error('Conteneur installé mais la création de la route a échoué');
            }
          }
        }
      } else {
        // Single-service install
        const form = serviceForms.values().next().value;
        if (!form) return;

        // Merge template env + custom env
        const mergedEnv = { ...form.envValues };
        form.customEnvValues.forEach((ce) => {
          if (ce.key.trim()) {
            mergedEnv[ce.key.trim()] = ce.value;
          }
        });

        // Build labels map
        const labelsMap: Record<string, string> = {};
        form.labelValues.forEach((l) => {
          if (l.key.trim()) {
            labelsMap[l.key.trim()] = l.value;
          }
        });

        const validPorts = form.portValues.filter(
          (p) => p.host > 0 && p.container > 0
        );

        const res = await storeApi.install({
          app_id: app.id,
          source_id: app.source_id,
          container_name: form.containerName,
          environment: mergedEnv,
          ports: validPorts.length > 0 ? validPorts : undefined,
          volumes: form.volumeValues,
          labels: Object.keys(labelsMap).length > 0 ? labelsMap : undefined,
          auto_start: autoStart,
        });

        // Create route if hostname is set
        if (form.hostname.trim()) {
          const hostPort =
            validPorts[0]?.host ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (res.data?.docker_info?.ports || []).find((p: any) => p.host_port)
              ?.host_port;
          if (hostPort) {
            try {
              await routesApi.create({
                name: form.containerName,
                host: form.hostname.trim(),
                target: `http://localhost:${hostPort}`,
                mode: 'proxy',
                enabled: true,
              });
              toast.success(`Route créée : ${form.hostname.trim()}`);
            } catch {
              toast.error('Conteneur installé mais la création de la route a échoué');
            }
          }
        }

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
        {/* Service info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Container Name</Label>
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
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Image</Label>
            <Input value={svc.image} disabled className="text-muted-foreground" />
          </div>
        </div>

        {/* URL / Hostname */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs font-medium">Hostname (URL)</Label>
            <span className="text-xs text-muted-foreground">- optional, creates a proxy route</span>
          </div>
          <Input
            value={form.hostname}
            onChange={(e) =>
              updateServiceForm(svc.service_name, {
                hostname: e.target.value,
              })
            }
            placeholder="myapp.example.com"
          />
        </div>

        {/* Ports */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium">Ports</Label>
              {form.portValues.length > 0 && (
                <Badge variant="secondary" className="h-5 text-xs px-1.5">
                  {form.portValues.length}
                </Badge>
              )}
            </div>
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
              Add
            </Button>
          </div>
          {form.portValues.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No ports configured. Exposed ports will be auto-assigned on install.
            </p>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-[1fr_auto_1fr_3.5rem_2rem] gap-2 text-xs text-muted-foreground px-1">
                <span>Host</span>
                <span />
                <span>Container</span>
                <span className="text-center">Proto</span>
                <span />
              </div>
              {form.portValues.map((port, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr_3.5rem_2rem] items-center gap-2">
                  <div className="space-y-1">
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
                        In use by{' '}
                        {portConflicts.get(port.host)?.used_by || 'another container'}
                      </p>
                    )}
                  </div>
                  <span className="text-muted-foreground">:</span>
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
                  <Input
                    value={port.protocol}
                    disabled
                    className="text-center text-xs"
                  />
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
              ))}
            </div>
          )}
        </div>

        {/* Environment Variables */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium">Environment</Label>
              {(svc.environment.length + form.customEnvValues.length) > 0 && (
                <Badge variant="secondary" className="h-5 text-xs px-1.5">
                  {svc.environment.length + form.customEnvValues.length}
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => {
                updateServiceForm(svc.service_name, {
                  customEnvValues: [
                    ...form.customEnvValues,
                    { key: '', value: '' },
                  ],
                });
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>
          {svc.environment.length === 0 && form.customEnvValues.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No environment variables
            </p>
          ) : (
            <div className="space-y-2">
              {/* Template env vars (key fixed, value editable) */}
              {svc.environment.map((env) => (
                <div key={env.key} className="flex items-center gap-2">
                  <div className="w-2/5">
                    <Input
                      value={env.key}
                      disabled
                      className="text-xs font-mono text-muted-foreground"
                    />
                  </div>
                  <span className="text-muted-foreground">=</span>
                  <div className="flex-1">
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
                </div>
              ))}
              {/* Custom env vars (both key and value editable) */}
              {form.customEnvValues.map((ce, i) => (
                <div key={`custom-${i}`} className="flex items-center gap-2">
                  <div className="w-2/5">
                    <Input
                      value={ce.key}
                      placeholder="KEY"
                      className="text-xs font-mono"
                      onChange={(e) => {
                        const next = [...form.customEnvValues];
                        next[i] = { ...next[i], key: e.target.value };
                        updateServiceForm(svc.service_name, {
                          customEnvValues: next,
                        });
                      }}
                    />
                  </div>
                  <span className="text-muted-foreground">=</span>
                  <div className="flex-1">
                    <Input
                      value={ce.value}
                      placeholder="value"
                      onChange={(e) => {
                        const next = [...form.customEnvValues];
                        next[i] = { ...next[i], value: e.target.value };
                        updateServiceForm(svc.service_name, {
                          customEnvValues: next,
                        });
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      const next = form.customEnvValues.filter((_, j) => j !== i);
                      updateServiceForm(svc.service_name, {
                        customEnvValues: next,
                      });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Volumes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium">Volumes</Label>
              {form.volumeValues.length > 0 && (
                <Badge variant="secondary" className="h-5 text-xs px-1.5">
                  {form.volumeValues.length}
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => {
                updateServiceForm(svc.service_name, {
                  volumeValues: [
                    ...form.volumeValues,
                    { source: '', target: '' },
                  ],
                });
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>
          {form.volumeValues.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No volumes configured
            </p>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-[1fr_auto_1fr_2rem] gap-2 text-xs text-muted-foreground px-1">
                <span>Host Path / Volume</span>
                <span />
                <span>Container Path</span>
                <span />
              </div>
              {form.volumeValues.map((vol, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr_2rem] items-center gap-2">
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
                  <span className="text-muted-foreground">:</span>
                  <Input
                    value={vol.target}
                    onChange={(e) => {
                      const next = [...form.volumeValues];
                      next[i] = { ...next[i], target: e.target.value };
                      updateServiceForm(svc.service_name, {
                        volumeValues: next,
                      });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      const next = form.volumeValues.filter((_, j) => j !== i);
                      updateServiceForm(svc.service_name, {
                        volumeValues: next,
                      });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Labels */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium">Labels</Label>
              {form.labelValues.length > 0 && (
                <Badge variant="secondary" className="h-5 text-xs px-1.5">
                  {form.labelValues.length}
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => {
                updateServiceForm(svc.service_name, {
                  labelValues: [
                    ...form.labelValues,
                    { key: '', value: '' },
                  ],
                });
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>
          {form.labelValues.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No custom labels
            </p>
          ) : (
            <div className="space-y-1.5">
              {form.labelValues.map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2/5">
                    <Input
                      value={label.key}
                      placeholder="label.key"
                      className="text-xs font-mono"
                      onChange={(e) => {
                        const next = [...form.labelValues];
                        next[i] = { ...next[i], key: e.target.value };
                        updateServiceForm(svc.service_name, {
                          labelValues: next,
                        });
                      }}
                    />
                  </div>
                  <span className="text-muted-foreground">=</span>
                  <div className="flex-1">
                    <Input
                      value={label.value}
                      placeholder="value"
                      onChange={(e) => {
                        const next = [...form.labelValues];
                        next[i] = { ...next[i], value: e.target.value };
                        updateServiceForm(svc.service_name, {
                          labelValues: next,
                        });
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      const next = form.labelValues.filter((_, j) => j !== i);
                      updateServiceForm(svc.service_name, {
                        labelValues: next,
                      });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
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
                // Multi-service: collapsible per service
                <div className="space-y-3">
                  {services.map((svc) => (
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
                  ))}
                </div>
              ) : (
                // Single-service: show form directly
                services[0] && renderServiceForm(services[0])
              )}
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
                  <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />
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
