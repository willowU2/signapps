'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTableSkeleton } from '@/components/ui/skeleton-loader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HardDrive,
  Plus,
  Play,
  MoreHorizontal,
  Trash2,
  Clock,
  History,
  RotateCcw,
  Power,
  PowerOff,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backupsApi, BackupProfile } from '@/lib/api';
import { toast } from 'sonner';
import { BackupDialog } from '@/components/backups/backup-dialog';
import { RestoreDialog } from '@/components/backups/restore-dialog';
import { RunsDialog } from '@/components/backups/runs-dialog';
import { BackupVerificationStatus } from '@/components/backups/backup-verification-status';

function formatDate(dateStr?: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

function formatBytes(bytes?: number) {
  if (!bytes) return '-';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function BackupsPage() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<BackupProfile | null>(null);
  const [restoreProfileId, setRestoreProfileId] = useState<string | null>(null);
  const [runsProfileId, setRunsProfileId] = useState<string | null>(null);

  const { data: profilesData, isLoading } = useQuery({
    queryKey: ['backup-profiles'],
    queryFn: async () => {
      const res = await backupsApi.list();
      return res.data.profiles;
    },
  });

  const profiles = profilesData || [];

  const runBackup = useMutation({
    mutationFn: (id: string) => backupsApi.run(id),
    onSuccess: () => {
      toast.success('Backup started');
      queryClient.invalidateQueries({ queryKey: ['backup-profiles'] });
    },
    onError: () => toast.error('Failed to start backup'),
  });

  const deleteProfile = useMutation({
    mutationFn: (id: string) => backupsApi.remove(id),
    onSuccess: () => {
      toast.success('Backup profile deleted');
      queryClient.invalidateQueries({ queryKey: ['backup-profiles'] });
    },
    onError: () => toast.error('Failed to delete profile'),
  });

  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      backupsApi.update(id, { enabled } as Partial<BackupProfile>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-profiles'] });
    },
    onError: () => toast.error('Failed to toggle profile'),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Backups</h1>
          <DataTableSkeleton count={4} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Backups</h1>
            <p className="text-muted-foreground">
              Manage backup profiles and restore snapshots
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Profile
          </Button>
        </div>

        {/* AQ-BKPVER: Backup verification status */}
        <BackupVerificationStatus />

        {profiles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <HardDrive className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Backup Profiles</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a backup profile to start protecting your container data.
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Profile
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Backup Profiles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Containers</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">{profile.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{profile.destination_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {profile.schedule || 'Manual'}
                        </div>
                      </TableCell>
                      <TableCell>{profile.container_ids.length}</TableCell>
                      <TableCell className="text-sm">
                        {formatDate(profile.last_run_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={profile.enabled ? 'default' : 'secondary'}>
                          {profile.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => runBackup.mutate(profile.id)}
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Run Now
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setRestoreProfileId(profile.id)}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Restore
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setRunsProfileId(profile.id)}
                            >
                              <History className="mr-2 h-4 w-4" />
                              Run History
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                toggleEnabled.mutate({
                                  id: profile.id,
                                  enabled: !profile.enabled,
                                })
                              }
                            >
                              {profile.enabled ? (
                                <>
                                  <PowerOff className="mr-2 h-4 w-4" />
                                  Disable
                                </>
                              ) : (
                                <>
                                  <Power className="mr-2 h-4 w-4" />
                                  Enable
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setEditProfile(profile)}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteProfile.mutate(profile.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <BackupDialog
          open={createDialogOpen || !!editProfile}
          onOpenChange={(open) => {
            if (!open) {
              setCreateDialogOpen(false);
              setEditProfile(null);
            }
          }}
          profile={editProfile}
        />

        {restoreProfileId && (
          <RestoreDialog
            open={!!restoreProfileId}
            onOpenChange={(open) => !open && setRestoreProfileId(null)}
            profileId={restoreProfileId}
          />
        )}

        {runsProfileId && (
          <RunsDialog
            open={!!runsProfileId}
            onOpenChange={(open) => !open && setRunsProfileId(null)}
            profileId={runsProfileId}
          />
        )}
      </div>
    </AppLayout>
  );
}
