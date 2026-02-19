'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Clock,
  Play,
  MoreVertical,
  Pencil,
  Trash2,
  Terminal,
  Container,
  Server,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  History,
} from 'lucide-react';
import { schedulerApi, ScheduledJob, JobRun } from '@/lib/api';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; job: ScheduledJob | null }>({
    open: false,
    job: null,
  });
  const [runsDialog, setRunsDialog] = useState<{
    open: boolean;
    job: ScheduledJob | null;
    runs: JobRun[];
  }>({
    open: false,
    job: null,
    runs: [],
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cron_expression: '',
    command: '',
    target_type: 'host' as 'container' | 'host',
    target_id: '',
    enabled: true,
  });

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await schedulerApi.listJobs();
      setJobs(response.data || []);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleOpenDialog = (job?: ScheduledJob) => {
    if (job) {
      setEditingJob(job);
      setFormData({
        name: job.name,
        description: job.description || '',
        cron_expression: job.cron_expression,
        command: job.command,
        target_type: job.target_type,
        target_id: job.target_id || '',
        enabled: job.enabled,
      });
    } else {
      setEditingJob(null);
      setFormData({
        name: '',
        description: '',
        cron_expression: '',
        command: '',
        target_type: 'host',
        target_id: '',
        enabled: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.cron_expression.trim() || !formData.command.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      if (editingJob) {
        await schedulerApi.updateJob(editingJob.id, formData);
        toast.success('Job updated successfully');
      } else {
        await schedulerApi.createJob(formData);
        toast.success('Job created successfully');
      }
      setDialogOpen(false);
      fetchJobs();
    } catch {
      toast.error('Failed to save job');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (job: ScheduledJob) => {
    try {
      if (job.enabled) {
        await schedulerApi.disableJob(job.id);
        toast.success('Job disabled');
      } else {
        await schedulerApi.enableJob(job.id);
        toast.success('Job enabled');
      }
      fetchJobs();
    } catch {
      toast.error('Failed to update job');
    }
  };

  const handleRunNow = async (job: ScheduledJob) => {
    try {
      await schedulerApi.runJob(job.id);
      toast.success('Job started');
      setTimeout(fetchJobs, 1000);
    } catch {
      toast.error('Failed to run job');
    }
  };

  const handleViewRuns = async (job: ScheduledJob) => {
    try {
      const response = await schedulerApi.listRuns(job.id);
      setRunsDialog({
        open: true,
        job,
        runs: response.data || [],
      });
    } catch {
      toast.error('Failed to fetch job runs');
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.job) return;

    try {
      await schedulerApi.deleteJob(deleteDialog.job.id);
      toast.success('Job deleted');
      setDeleteDialog({ open: false, job: null });
      fetchJobs();
    } catch {
      toast.error('Failed to delete job');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500/10 text-green-600">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500/10 text-blue-600">Running</Badge>;
      default:
        return <Badge variant="secondary">-</Badge>;
    }
  };

  const cronPresets = [
    { label: 'Every minute', value: '* * * * *' },
    { label: 'Every 5 minutes', value: '*/5 * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every day at midnight', value: '0 0 * * *' },
    { label: 'Every week (Sunday)', value: '0 0 * * 0' },
    { label: 'Every month (1st)', value: '0 0 1 * *' },
  ];

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Scheduler</h1>
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  const stats = {
    total: jobs.length,
    enabled: jobs.filter((j) => j.enabled).length,
    lastRunSuccess: jobs.filter((j) => j.last_status === 'success').length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Scheduler</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchJobs}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              New Job
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Jobs</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                <Play className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Jobs</p>
                <p className="text-2xl font-bold">{stats.enabled}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <CheckCircle className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Run Success</p>
                <p className="text-2xl font-bold">{stats.lastRunSuccess}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Scheduled Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Last Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Switch
                        checked={job.enabled}
                        onCheckedChange={() => handleToggle(job)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{job.name}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">
                            {job.command}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {job.cron_expression}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {job.target_type === 'container' ? (
                          <Container className="h-3 w-3" />
                        ) : (
                          <Server className="h-3 w-3" />
                        )}
                        {job.target_type}
                        {job.target_id && `: ${job.target_id}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(job.last_run)}
                    </TableCell>
                    <TableCell>{getStatusBadge(job.last_status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleRunNow(job)}>
                            <Play className="mr-2 h-4 w-4" />
                            Run Now
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewRuns(job)}>
                            <History className="mr-2 h-4 w-4" />
                            View History
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenDialog(job)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteDialog({ open: true, job })}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {jobs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No scheduled jobs. Click &quot;New Job&quot; to create one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Job Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingJob ? 'Edit Job' : 'Create Job'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Job Name</Label>
              <Input
                id="name"
                placeholder="Backup database"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Optional description of this job"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cron">CRON Expression</Label>
              <Input
                id="cron"
                placeholder="0 0 * * *"
                value={formData.cron_expression}
                onChange={(e) => setFormData({ ...formData, cron_expression: e.target.value })}
              />
              <div className="flex flex-wrap gap-1">
                {cronPresets.map((preset) => (
                  <Button
                    key={preset.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-6"
                    onClick={() => setFormData({ ...formData, cron_expression: preset.value })}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="command">Command</Label>
              <Textarea
                id="command"
                placeholder="pg_dump -U postgres mydb > backup.sql"
                value={formData.command}
                onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Type</Label>
                <Select
                  value={formData.target_type}
                  onValueChange={(value: 'container' | 'host') =>
                    setFormData({ ...formData, target_type: value, target_id: '' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="host">Host</SelectItem>
                    <SelectItem value="container">Container</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.target_type === 'container' && (
                <div className="space-y-2">
                  <Label htmlFor="targetId">Container ID/Name</Label>
                  <Input
                    id="targetId"
                    placeholder="my-container"
                    value={formData.target_id}
                    onChange={(e) => setFormData({ ...formData, target_id: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Job will run according to schedule
                </p>
              </div>
              <Switch
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingJob ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Runs Dialog */}
      <Dialog open={runsDialog.open} onOpenChange={(open) => setRunsDialog({ ...runsDialog, open })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Run History: {runsDialog.job?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {runsDialog.runs.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No runs recorded yet
              </p>
            ) : (
              <div className="space-y-3">
                {runsDialog.runs.map((run) => (
                  <div key={run.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {run.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : run.status === 'failed' ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        )}
                        {getStatusBadge(run.status)}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(run.started_at)}
                      </span>
                    </div>
                    {run.output && (
                      <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                        {run.output}
                      </pre>
                    )}
                    {run.error && (
                      <pre className="mt-2 text-xs bg-red-50 text-red-600 p-2 rounded overflow-x-auto">
                        {run.error}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setRunsDialog({ ...runsDialog, open: false })}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, job: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteDialog.job?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
