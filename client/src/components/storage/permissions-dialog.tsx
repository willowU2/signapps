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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { storageApi } from '@/lib/api';
import { toast } from 'sonner';

interface PermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucket: string;
  fileKey: string;
  fileName: string;
}

interface PermissionSet {
  readable: boolean;
  writable: boolean;
  executable: boolean;
}

const COMMON_MODES = [
  { label: '755 (rwxr-xr-x)', value: '755', description: 'Owner: all, Group/Other: read+execute' },
  { label: '644 (rw-r--r--)', value: '644', description: 'Owner: read+write, Group/Other: read' },
  { label: '755 (rwx------)', value: '700', description: 'Owner only: all permissions' },
  { label: '777 (rwxrwxrwx)', value: '777', description: 'Everyone: all permissions' },
];

/**
 * PermissionsDialog - Modal pour gérer les permissions POSIX des fichiers.
 */
export function PermissionsDialog({
  open,
  onOpenChange,
  bucket,
  fileKey,
  fileName,
}: PermissionsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [mode, setMode] = useState('644');
  const [owner, setOwner] = useState<PermissionSet>({
    readable: true,
    writable: true,
    executable: false,
  });
  const [group, setGroup] = useState<PermissionSet>({
    readable: true,
    writable: false,
    executable: false,
  });
  const [other, setOther] = useState<PermissionSet>({
    readable: true,
    writable: false,
    executable: false,
  });

  // Fetch permissions when dialog opens
  useEffect(() => {
    if (open) {
      fetchPermissions();
    }
  }, [open]);

  const fetchPermissions = async () => {
    setFetching(true);
    try {
      const response = await storageApi.getPermissions(bucket, fileKey);
      const perms = response.data;

      setMode(String(perms.mode));
      setOwner({
        readable: perms.owner_readable,
        writable: perms.owner_writable,
        executable: perms.owner_executable,
      });
      setGroup({
        readable: perms.group_readable,
        writable: perms.group_writable,
        executable: perms.group_executable,
      });
      setOther({
        readable: perms.other_readable,
        writable: perms.other_writable,
        executable: perms.other_executable,
      });
    } catch {
      toast.error('Impossible de charger les permissions');
    } finally {
      setFetching(false);
    }
  };

  const permissionsToMode = (
    ownerPerms: PermissionSet,
    groupPerms: PermissionSet,
    otherPerms: PermissionSet
  ): number => {
    const calculateBits = (perms: PermissionSet) => {
      let bits = 0;
      if (perms.readable) bits += 4;
      if (perms.writable) bits += 2;
      if (perms.executable) bits += 1;
      return bits;
    };

    const ownerBits = calculateBits(ownerPerms);
    const groupBits = calculateBits(groupPerms);
    const otherBits = calculateBits(otherPerms);

    return parseInt(`${ownerBits}${groupBits}${otherBits}`, 10);
  };

  const modeToPermissions = (modeValue: number) => {
    const ownerBits = Math.floor(modeValue / 100);
    const groupBits = Math.floor((modeValue % 100) / 10);
    const otherBits = modeValue % 10;

    const bitsToPerms = (bits: number): PermissionSet => ({
      readable: (bits & 4) !== 0,
      writable: (bits & 2) !== 0,
      executable: (bits & 1) !== 0,
    });

    setOwner(bitsToPerms(ownerBits));
    setGroup(bitsToPerms(groupBits));
    setOther(bitsToPerms(otherBits));
    setMode(String(modeValue));
  };

  const updateMode = (newMode: string) => {
    setMode(newMode);
    const modeValue = parseInt(newMode, 10);
    if (!isNaN(modeValue)) {
      modeToPermissions(modeValue);
    }
  };

  const handleSave = async () => {
    const newMode = permissionsToMode(owner, group, other);

    setLoading(true);
    try {
      await storageApi.setPermissions(bucket, fileKey, { mode: newMode });
      toast.success('Permissions mises à jour');
      onOpenChange(false);
    } catch {
      toast.error('Impossible de mettre à jour les permissions');
    } finally {
      setLoading(false);
    }
  };

  const PermissionCheckbox = ({
    label,
    checked,
    onChange,
  }: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={checked}
        onCheckedChange={onChange}
        id={`perm-${label}`}
      />
      <label htmlFor={`perm-${label}`} className="text-sm cursor-pointer">
        {label}
      </label>
    </div>
  );

  const PermissionSection = ({
    title,
    perms,
    onChange,
  }: {
    title: string;
    perms: PermissionSet;
    onChange: (perms: PermissionSet) => void;
  }) => (
    <div className="space-y-2 p-3 rounded-lg bg-muted/50">
      <h4 className="font-medium text-sm">{title}</h4>
      <div className="space-y-1">
        <PermissionCheckbox
          label="Lecture (r)"
          checked={perms.readable}
          onChange={(readable) => onChange({ ...perms, readable })}
        />
        <PermissionCheckbox
          label="Écriture (w)"
          checked={perms.writable}
          onChange={(writable) => onChange({ ...perms, writable })}
        />
        <PermissionCheckbox
          label="Exécution (x)"
          checked={perms.executable}
          onChange={(executable) => onChange({ ...perms, executable })}
        />
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Permissions du fichier</DialogTitle>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* File info */}
            <div>
              <p className="text-xs text-muted-foreground">Fichier</p>
              <p className="text-sm font-medium truncate">{fileName}</p>
            </div>

            {/* Quick mode selector */}
            <div className="space-y-2">
              <Label htmlFor="mode-select">Mode rapide</Label>
              <Select value={mode} onValueChange={updateMode}>
                <SelectTrigger id="mode-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex flex-col">
                        <span>{m.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {m.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Manual mode input */}
            <div className="space-y-2">
              <Label htmlFor="mode-input">Mode POSIX (0-777)</Label>
              <input
                id="mode-input"
                type="text"
                inputMode="numeric"
                value={mode}
                onChange={(e) => updateMode(e.target.value)}
                maxLength={3}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                placeholder="644"
              />
              <p className="text-xs text-muted-foreground">
                Format octal: premier chiffre=propriétaire, deuxième=groupe, troisième=autres
              </p>
            </div>

            {/* Permission sections */}
            <div className="space-y-3">
              <Label className="text-base">Permissions détaillées</Label>
              <PermissionSection
                title="Propriétaire"
                perms={owner}
                onChange={setOwner}
              />
              <PermissionSection
                title="Groupe"
                perms={group}
                onChange={setGroup}
              />
              <PermissionSection
                title="Autres"
                perms={other}
                onChange={setOther}
              />
            </div>

            {/* Display calculated mode */}
            <div className="p-3 rounded-lg bg-primary/10">
              <p className="text-xs text-muted-foreground">Mode calculé</p>
              <p className="text-lg font-mono font-bold">
                {permissionsToMode(owner, group, other)}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={loading || fetching}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
