'use client';

import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { containersApi, CreateContainerRequest } from '@/lib/api';
import { toast } from 'sonner';

interface ContainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface PortMapping {
  id: string;
  containerPort: string;
  hostPort: string;
  protocol: string;
}

interface EnvVar {
  id: string;
  key: string;
  value: string;
}

interface VolumeMount {
  id: string;
  hostPath: string;
  containerPath: string;
}

export function ContainerDialog({ open, onOpenChange, onSuccess }: ContainerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [restartPolicy, setRestartPolicy] = useState<'no' | 'always' | 'on-failure' | 'unless-stopped'>('unless-stopped');
  const [ports, setPorts] = useState<PortMapping[]>([]);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [volumes, setVolumes] = useState<VolumeMount[]>([]);

  useEffect(() => {
    if (!open) {
      // Reset form when dialog closes
      setName('');
      setImage('');
      setRestartPolicy('unless-stopped');
      setPorts([]);
      setEnvVars([]);
      setVolumes([]);
    }
  }, [open]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addPort = () => {
    setPorts([...ports, { id: generateId(), containerPort: '', hostPort: '', protocol: 'tcp' }]);
  };

  const removePort = (id: string) => {
    setPorts(ports.filter((p) => p.id !== id));
  };

  const updatePort = (id: string, field: keyof PortMapping, value: string) => {
    setPorts(ports.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { id: generateId(), key: '', value: '' }]);
  };

  const removeEnvVar = (id: string) => {
    setEnvVars(envVars.filter((e) => e.id !== id));
  };

  const updateEnvVar = (id: string, field: 'key' | 'value', value: string) => {
    setEnvVars(envVars.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const addVolume = () => {
    setVolumes([...volumes, { id: generateId(), hostPath: '', containerPath: '' }]);
  };

  const removeVolume = (id: string) => {
    setVolumes(volumes.filter((v) => v.id !== id));
  };

  const updateVolume = (id: string, field: 'hostPath' | 'containerPath', value: string) => {
    setVolumes(volumes.map((v) => (v.id === id ? { ...v, [field]: value } : v)));
  };

  const handleSubmit = async () => {
    if (!name.trim() || !image.trim()) {
      toast.error('Name and image are required');
      return;
    }

    setLoading(true);
    try {
      const portsObj: Record<string, string> = {};
      ports.forEach((p) => {
        if (p.containerPort && p.hostPort) {
          portsObj[`${p.containerPort}/${p.protocol}`] = p.hostPort;
        }
      });

      const envObj: Record<string, string> = {};
      envVars.forEach((e) => {
        if (e.key) {
          envObj[e.key] = e.value;
        }
      });

      const volumesList = volumes
        .filter((v) => v.hostPath && v.containerPath)
        .map((v) => `${v.hostPath}:${v.containerPath}`);

      const request: CreateContainerRequest = {
        name,
        image,
        restart_policy: restartPolicy,
      };

      if (Object.keys(portsObj).length > 0) {
        request.ports = portsObj;
      }
      if (Object.keys(envObj).length > 0) {
        request.env = envObj;
      }
      if (volumesList.length > 0) {
        request.volumes = volumesList;
      }

      await containersApi.create(request);
      toast.success('Container created successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create container:', error);
      toast.error('Failed to create container');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Container</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="ports">Ports</TabsTrigger>
            <TabsTrigger value="env">Environment</TabsTrigger>
            <TabsTrigger value="volumes">Volumes</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Container Name</Label>
              <Input
                id="name"
                placeholder="my-container"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Image</Label>
              <Input
                id="image"
                placeholder="nginx:latest"
                value={image}
                onChange={(e) => setImage(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Docker image name with optional tag (e.g., nginx:alpine)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="restart">Restart Policy</Label>
              <Select value={restartPolicy} onValueChange={(v: any) => setRestartPolicy(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="always">Always</SelectItem>
                  <SelectItem value="on-failure">On Failure</SelectItem>
                  <SelectItem value="unless-stopped">Unless Stopped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="ports" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label>Port Mappings</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPort}>
                <Plus className="mr-2 h-4 w-4" />
                Add Port
              </Button>
            </div>

            {ports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No port mappings configured
              </p>
            ) : (
              <div className="space-y-2">
                {ports.map((port) => (
                  <div key={port.id} className="flex items-center gap-2">
                    <Input
                      placeholder="Host port"
                      value={port.hostPort}
                      onChange={(e) => updatePort(port.id, 'hostPort', e.target.value)}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">:</span>
                    <Input
                      placeholder="Container port"
                      value={port.containerPort}
                      onChange={(e) => updatePort(port.id, 'containerPort', e.target.value)}
                      className="w-24"
                    />
                    <Select
                      value={port.protocol}
                      onValueChange={(v) => updatePort(port.id, 'protocol', v)}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tcp">TCP</SelectItem>
                        <SelectItem value="udp">UDP</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePort(port.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="env" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label>Environment Variables</Label>
              <Button type="button" variant="outline" size="sm" onClick={addEnvVar}>
                <Plus className="mr-2 h-4 w-4" />
                Add Variable
              </Button>
            </div>

            {envVars.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No environment variables configured
              </p>
            ) : (
              <div className="space-y-2">
                {envVars.map((env) => (
                  <div key={env.id} className="flex items-center gap-2">
                    <Input
                      placeholder="KEY"
                      value={env.key}
                      onChange={(e) => updateEnvVar(env.id, 'key', e.target.value.toUpperCase())}
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">=</span>
                    <Input
                      placeholder="value"
                      value={env.value}
                      onChange={(e) => updateEnvVar(env.id, 'value', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEnvVar(env.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="volumes" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label>Volume Mounts</Label>
              <Button type="button" variant="outline" size="sm" onClick={addVolume}>
                <Plus className="mr-2 h-4 w-4" />
                Add Volume
              </Button>
            </div>

            {volumes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No volumes configured
              </p>
            ) : (
              <div className="space-y-2">
                {volumes.map((vol) => (
                  <div key={vol.id} className="flex items-center gap-2">
                    <Input
                      placeholder="/host/path"
                      value={vol.hostPath}
                      onChange={(e) => updateVolume(vol.id, 'hostPath', e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">:</span>
                    <Input
                      placeholder="/container/path"
                      value={vol.containerPath}
                      onChange={(e) => updateVolume(vol.id, 'containerPath', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVolume(vol.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Container
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
