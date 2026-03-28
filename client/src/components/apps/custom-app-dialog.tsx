'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useState } from 'react';
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
import { Trash2, Plus } from 'lucide-react';
import { containersApi } from '@/lib/api';
import { toast } from 'sonner';

interface CustomAppDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInstalled?: () => void;
}

export function CustomAppDialog({
    open,
    onOpenChange,
    onInstalled,
}: CustomAppDialogProps) {
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [image, setImage] = useState('');
    const [autoStart, setAutoStart] = useState(true);

    const [ports, setPorts] = useState<{ host: number; container: number; protocol: string }[]>([]);
    const [env, setEnv] = useState<{ key: string; value: string }[]>([]);
    const [volumes, setVolumes] = useState<{ source: string; target: string }[]>([]);

    const handleInstall = async () => {
        if (!name.trim() || !image.trim()) {
            toast.error('Le nom et l\'image sont requis');
            return;
        }

        setLoading(true);
        try {
            // Format ports as Record<string, string> e.g. "80/tcp": "8080"
            const portsMap: Record<string, string> = {};
            ports.forEach(p => {
                if (p.host && p.container) {
                    portsMap[`${p.container}/${p.protocol || 'tcp'}`] = p.host.toString();
                }
            });

            // Format env as Record<string, string>
            const envMap: Record<string, string> = {};
            env.forEach(e => {
                if (e.key.trim()) {
                    envMap[e.key.trim()] = e.value;
                }
            });

            // Format volumes as string array "source:target"
            const volsArray: string[] = volumes
                .filter(v => v.source.trim() && v.target.trim())
                .map(v => `${v.source.trim()}:${v.target.trim()}`);

            const res = await containersApi.create({
                name: name.trim(),
                image: image.trim(),
                ports: Object.keys(portsMap).length > 0 ? portsMap : undefined,
                env: Object.keys(envMap).length > 0 ? envMap : undefined,
                volumes: volsArray.length > 0 ? volsArray : undefined,
                restart_policy: 'unless-stopped'
            });

            if (autoStart) {
                await containersApi.start(res.data.id);
            }

            toast.success(`${name} installed successfully`);
            onOpenChange(false);
            onInstalled?.();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to install custom app';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Custom Docker App</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Container Name *</Label>
                            <Input
                                placeholder="my-custom-app"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Image *</Label>
                            <Input
                                placeholder="nginx:latest"
                                value={image}
                                onChange={(e) => setImage(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Ports */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Ports</Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setPorts([...ports, { host: 0, container: 0, protocol: 'tcp' }])}
                            >
                                <Plus className="h-4 w-4 mr-1" /> Add Port
                            </Button>
                        </div>
                        {ports.map((p, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    placeholder="Host"
                                    value={p.host || ''}
                                    onChange={(e) => {
                                        const next = [...ports];
                                        next[i].host = parseInt(e.target.value) || 0;
                                        setPorts(next);
                                    }}
                                />
                                <span>:</span>
                                <Input
                                    type="number"
                                    placeholder="Container"
                                    value={p.container || ''}
                                    onChange={(e) => {
                                        const next = [...ports];
                                        next[i].container = parseInt(e.target.value) || 0;
                                        setPorts(next);
                                    }}
                                />
                                <Button variant="ghost" size="icon" onClick={() => setPorts(ports.filter((_, j) => j !== i))}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    {/* Environment */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Environment Variables</Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEnv([...env, { key: '', value: '' }])}
                            >
                                <Plus className="h-4 w-4 mr-1" /> Add Env
                            </Button>
                        </div>
                        {env.map((e, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Input
                                    placeholder="KEY"
                                    value={e.key}
                                    onChange={(evt) => {
                                        const next = [...env];
                                        next[i].key = evt.target.value;
                                        setEnv(next);
                                    }}
                                />
                                <span>=</span>
                                <Input
                                    placeholder="value"
                                    value={e.value}
                                    onChange={(evt) => {
                                        const next = [...env];
                                        next[i].value = evt.target.value;
                                        setEnv(next);
                                    }}
                                />
                                <Button variant="ghost" size="icon" onClick={() => setEnv(env.filter((_, j) => j !== i))}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    {/* Volumes */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Volumes</Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setVolumes([...volumes, { source: '', target: '' }])}
                            >
                                <Plus className="h-4 w-4 mr-1" /> Add Volume
                            </Button>
                        </div>
                        {volumes.map((v, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Input
                                    placeholder="/host/path"
                                    value={v.source}
                                    onChange={(e) => {
                                        const next = [...volumes];
                                        next[i].source = e.target.value;
                                        setVolumes(next);
                                    }}
                                />
                                <span>:</span>
                                <Input
                                    placeholder="/container/path"
                                    value={v.target}
                                    onChange={(e) => {
                                        const next = [...volumes];
                                        next[i].target = e.target.value;
                                        setVolumes(next);
                                    }}
                                />
                                <Button variant="ghost" size="icon" onClick={() => setVolumes(volumes.filter((_, j) => j !== i))}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch checked={autoStart} onCheckedChange={setAutoStart} />
                        <Label>Start container after installation</Label>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleInstall} disabled={loading}>
                        {loading && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
                        Install App
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
