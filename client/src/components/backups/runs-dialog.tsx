"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { backupsApi, BackupRun } from "@/lib/api";

interface RunsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
}

function formatDuration(seconds?: number) {
  if (!seconds) return "-";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatBytes(bytes?: number) {
  if (!bytes) return "-";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function statusBadge(status: string) {
  switch (status) {
    case "success":
      return <Badge className="bg-green-500/10 text-green-600">Success</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "running":
      return <Badge className="bg-blue-500/10 text-blue-600">Running</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function RunsDialog({ open, onOpenChange, profileId }: RunsDialogProps) {
  const { data: runsData, isLoading } = useQuery({
    queryKey: ["backup-runs", profileId],
    queryFn: async () => {
      const res = await backupsApi.runs(profileId);
      return res.data.runs;
    },
    enabled: open,
    refetchInterval: 5000,
  });

  const runs = runsData || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Backup Run History</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-32" />
        ) : runs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No backup runs yet.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Snapshot</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run: BackupRun) => (
                  <TableRow key={run.id}>
                    <TableCell>{statusBadge(run.status)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {run.snapshot_id?.substring(0, 8) || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {run.files_new != null
                        ? `+${run.files_new} / ~${run.files_changed}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatBytes(run.size_bytes ?? undefined)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDuration(run.duration_seconds ?? undefined)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(run.started_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
