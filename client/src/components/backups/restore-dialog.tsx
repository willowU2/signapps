'use client';

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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RotateCcw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupsApi } from '@/lib/api';
import type { ContainerBackupSnapshot } from '@/lib/api/containers';
import { toast } from 'sonner';

interface RestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
}

export function RestoreDialog({ open, onOpenChange, profileId }: RestoreDialogProps) {
  const queryClient = useQueryClient();
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [targetPath, setTargetPath] = useState('');

  const { data: snapshotsData, isLoading } = useQuery({
    queryKey: ['backup-snapshots', profileId],
    queryFn: async () => {
      const res = await backupsApi.snapshots(profileId);
      return res.data.snapshots;
    },
    enabled: open,
  });

  const snapshots = snapshotsData || [];

  const restoreMutation = useMutation({
    mutationFn: () =>
      backupsApi.restore(profileId, selectedSnapshot!, targetPath || undefined),
    onSuccess: () => {
      toast.success('Restore started');
      queryClient.invalidateQueries({ queryKey: ['backup-profiles'] });
      onOpenChange(false);
    },
    onError: () => toast.error('Restore failed'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Restore Snapshot</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-32" />
        ) : snapshots.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No snapshots available.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Select Snapshot</Label>
              <div className="mt-1 max-h-48 overflow-y-auto space-y-1 rounded border p-2">
                {snapshots.map((snap: ContainerBackupSnapshot) => (
                  <div
                    key={snap.id}
                    onClick={() => setSelectedSnapshot(snap.short_id)}
                    className={`cursor-pointer rounded p-2 transition-colors ${
                      selectedSnapshot === snap.short_id
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">{snap.short_id}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(snap.time).toLocaleString()}
                      </span>
                    </div>
                    {snap.tags && snap.tags.length > 0 && (
                      <div className="mt-1 flex gap-1 flex-wrap">
                        {snap.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Target Path (optional)</Label>
              <Input
                placeholder="/tmp/restore (default)"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => restoreMutation.mutate()}
            disabled={!selectedSnapshot || restoreMutation.isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {restoreMutation.isPending ? 'Restoring...' : 'Restore'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
