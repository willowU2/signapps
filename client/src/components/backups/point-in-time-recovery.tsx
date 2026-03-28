'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Clock, RotateCcw, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupsApi } from '@/lib/api';
import { toast } from 'sonner';

interface PITRDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId: string;
}

export function PointInTimeRecoveryDialog({ open, onOpenChange, profileId }: PITRDialogProps) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['pitr-snapshots', profileId],
    queryFn: async () => {
      const res = await backupsApi.snapshots(profileId);
      return res.data.snapshots as Array<{ id: string; short_id: string; time: string; tags?: string[] }>;
    },
    enabled: open,
  });

  const restore = useMutation({
    mutationFn: () => backupsApi.restore(profileId, selected!),
    onSuccess: () => {
      toast.success('Point-in-time recovery started');
      qc.invalidateQueries({ queryKey: ['backup-profiles'] });
      onOpenChange(false);
    },
    onError: () => toast.error('Recovery failed'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Point-in-Time Recovery
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Select a snapshot timestamp to restore the database to that exact point.
          </p>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : !snapshots || snapshots.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No snapshots available for this profile.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1 rounded-lg border p-2">
              {snapshots.map((snap) => (
                <button
                  key={snap.id}
                  onClick={() => setSelected(snap.short_id)}
                  className={`w-full text-left rounded-lg p-3 transition-colors ${
                    selected === snap.short_id
                      ? 'bg-primary/10 border border-primary/40'
                      : 'hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium">{snap.short_id}</span>
                    <time className="text-xs text-muted-foreground">
                      {new Date(snap.time).toLocaleString()}
                    </time>
                  </div>
                  {snap.tags && snap.tags.length > 0 && (
                    <div className="mt-1 flex gap-1 flex-wrap">
                      {snap.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                This will overwrite current data with the selected snapshot. This action cannot be undone.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={() => restore.mutate()}
            disabled={!selected || restore.isPending}
            variant="destructive"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {restore.isPending ? 'Restoring...' : 'Restore to this point'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
