'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Globe, Plus, Trash2, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface SecondaryLocation {
  id: string;
  name: string;
  type: 'local' | 's3' | 'sftp';
  path: string;
  enabled: boolean;
  lastSync?: string;
  status: 'synced' | 'pending' | 'error';
}

export function CrossRegionBackup() {
  const [locations, setLocations] = useState<SecondaryLocation[]>([
    {
      id: '1',
      name: 'EU West (NAS)',
      type: 'local',
      path: '/mnt/nas/backups',
      enabled: true,
      lastSync: new Date(Date.now() - 3600000).toISOString(),
      status: 'synced',
    },
  ]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<SecondaryLocation['type']>('local');
  const [newPath, setNewPath] = useState('');

  const addLocation = () => {
    if (!newName || !newPath) { toast.error('Le nom et le chemin sont requis'); return; }
    setLocations(prev => [...prev, {
      id: Date.now().toString(),
      name: newName,
      type: newType,
      path: newPath,
      enabled: true,
      status: 'pending',
    }]);
    setNewName(''); setNewPath(''); setAdding(false);
    toast.success('Emplacement de sauvegarde secondaire ajouté');
  };

  const toggle = (id: string) => {
    setLocations(prev => prev.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l));
  };

  const remove = (id: string) => {
    setLocations(prev => prev.filter(l => l.id !== id));
    toast.success('Emplacement supprimé');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5 text-primary" />
            Cross-Region Backup Locations
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setAdding(!adding)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Location
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="EU NAS" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as SecondaryLocation['type'])}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local Path</SelectItem>
                    <SelectItem value="s3">S3-compatible</SelectItem>
                    <SelectItem value="sftp">SFTP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Path / Endpoint</Label>
              <Input value={newPath} onChange={e => setNewPath(e.target.value)} placeholder="/mnt/backup2" className="h-8 text-sm" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              <Button size="sm" onClick={addLocation}>Add</Button>
            </div>
          </div>
        )}

        {locations.map(loc => (
          <div key={loc.id} className="flex items-center gap-3 p-3 rounded-lg border">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{loc.name}</span>
                <Badge variant="outline" className="text-xs">{loc.type}</Badge>
                {loc.status === 'synced' && <Badge variant="default" className="text-xs bg-green-500">Synced</Badge>}
                {loc.status === 'pending' && <Badge variant="secondary" className="text-xs">Pending</Badge>}
                {loc.status === 'error' && <Badge variant="destructive" className="text-xs">Error</Badge>}
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate">{loc.path}</p>
              {loc.lastSync && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />
                  Last sync: {new Date(loc.lastSync).toLocaleString()}
                </p>
              )}
            </div>
            <Switch checked={loc.enabled} onCheckedChange={() => toggle(loc.id)} />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(loc.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {locations.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No secondary backup locations configured.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
