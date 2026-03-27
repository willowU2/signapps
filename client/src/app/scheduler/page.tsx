'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTableSkeleton, CardGridSkeleton } from '@/components/ui/skeleton-loader';
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
import { Plus, Clock, Play, MoreVertical, Pencil, Trash2, Terminal, Container, Server, RefreshCw, CheckCircle, XCircle, History, ArrowUpDown } from 'lucide-react';
import { schedulerApi, ScheduledJob, JobRun, JobStats, RunningJob } from '@/lib/api';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

export default function SchedulerPage() {
  const queryClient = useQueryClient();
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

  const [sortField, setSortField] = useState<string>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  type SchedulerData = { jobs: ScheduledJob[]; stats: JobStats | null; runningJobs: RunningJob[] };

  const { data: schedulerData, isLoading: loading } = useQuery<SchedulerData>({
    queryKey: ['scheduler-jobs'],
    queryFn: async () => {
      const [jobsRes, statsRes, runningRes] = await Promise.all([
        schedulerApi.listJobs(),
        schedulerApi.getStats().catch(() => null),
        schedulerApi.getRunning().catch(() => ({ data: [] })),
      ]);
      return {
        jobs: jobsRes.data || [],
        stats: statsRes?.data ?? null,
        runningJobs: runningRes?.data || [],
      };
    },
  });

  const jobs = schedulerData?.jobs ?? [];
  const stats = schedulerData?.stats ?? null;
  const runningJobs = schedulerData?.runningJobs ?? [];

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      const aVal = (a as any)[sortField] ?? '';
      const bVal = (b as any)[sortField] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), 'fr', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [jobs, sortField, sortDir]);

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const fetchJobs = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['scheduler-jobs'] });
  }, [queryClient]);

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
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setSaving(true);
    try {
      if (editingJob) {
        await schedulerApi.updateJob(editingJob.id, formData);
        toast.success('Tâche mise à jour avec succès');
      } else {
        await schedulerApi.createJob(formData);
        toast.success('Tâche créée avec succès');
      }
      setDialogOpen(false);
      fetchJobs();
    } catch {
      toast.error('Échec de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (job: ScheduledJob) => {
    try {
      if (job.enabled) {
        await schedulerApi.disableJob(job.id);
        toast.success('Tâche désactivée');
      } else {
        await schedulerApi.enableJob(job.id);
        toast.success('Tâche activée');
      }
      fetchJobs();
    } catch {
      toast.error('Échec de la mise à jour');
    }
  };

  const handleRunNow = async (job: ScheduledJob) => {
    try {
      await schedulerApi.runJob(job.id);
      toast.success('Tâche lancée');
      setTimeout(fetchJobs, 1000);
    } catch {
      toast.error('Échec du lancement');
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
      toast.error('Échec du chargement de l\'historique');
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.job) return;

    try {
      await schedulerApi.deleteJob(deleteDialog.job.id);
      toast.success('Tâche supprimée');
      setDeleteDialog({ open: false, job: null });
      fetchJobs();
    } catch {
      toast.error('Échec de la suppression');
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
    { label: 'Chaque minute', value: '* * * * *' },
    { label: 'Toutes les 5 min', value: '*/5 * * * *' },
    { label: 'Chaque heure', value: '0 * * * *' },
    { label: 'Chaque jour minuit', value: '0 0 * * *' },
    { label: 'Chaque semaine (dim)', value: '0 0 * * 0' },
    { label: 'Chaque mois (1er)', value: '0 0 1 * *' },
  ];

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Scheduler</h1>
          <CardGridSkeleton count={3} className="md:grid-cols-3" />
          <DataTableSkeleton count={5} />
        </div>
      </AppLayout>
    );
  }

  // Fallback stats if backend stats not available
  const displayStats = stats || {
    total_jobs: jobs.length,
    enabled_jobs: jobs.filter((j) => j.enabled).length,
    successful_runs: jobs.filter((j) => j.last_status === 'success').length,
    failed_runs: jobs.filter((j) => j.last_status === 'failed').length,
    total_runs: 0,
    disabled_jobs: jobs.filter((j) => !j.enabled).length,
    average_duration_ms: 0,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Planificateur</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchJobs}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle Tâche
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Tâches</p>
                <p className="text-2xl font-bold">{displayStats.total_jobs}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                <Play className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tâches Actives</p>
                <p className="text-2xl font-bold">{displayStats.enabled_jobs}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <CheckCircle className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Exécutions Réussies</p>
                <p className="text-2xl font-bold">{displayStats.successful_runs}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${runningJobs.length > 0 ? 'bg-amber-500/10' : 'bg-muted'}`}>
                {runningJobs.length > 0 ? (
                  <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-6 w-6 text-amber-500 " />
                ) : (
                  <Server className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En Cours</p>
                <p className="text-2xl font-bold">{runningJobs.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Tâches Planifiées</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>État</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                    <span className="flex items-center gap-1">Nom {sortField === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('cron_expression')}>
                    <span className="flex items-center gap-1">Planification {sortField === 'cron_expression' ? (sortDir === 'asc' ? '↑' : '↓') : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}</span>
                  </TableHead>
                  <TableHead>Cible</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('last_run')}>
                    <span className="flex items-center gap-1">Dernière Exécution {sortField === 'last_run' ? (sortDir === 'asc' ? '↑' : '↓') : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}</span>
                  </TableHead>
                  <TableHead>Dernier Statut</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedJobs.map((job) => (
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
                            Exécuter Maintenant
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewRuns(job)}>
                            <History className="mr-2 h-4 w-4" />
                            Historique
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenDialog(job)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteDialog({ open: true, job })}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {sortedJobs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucune tâche planifiée. Cliquez sur &quot;Nouvelle Tâche&quot; pour en créer une.
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
            <DialogTitle>{editingJob ? 'Modifier la Tâche' : 'Nouvelle Tâche'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de la Tâche *</Label>
              <Input
                id="name"
                placeholder="Sauvegarde base de données"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Description optionnelle de cette tâche"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cron">Expression CRON *</Label>
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
              <Label htmlFor="command">Commande</Label>
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
                <Label>Type de Cible</Label>
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
                    <SelectItem value="host">Hôte</SelectItem>
                    <SelectItem value="container">Conteneur</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.target_type === 'container' && (
                <div className="space-y-2">
                  <Label htmlFor="targetId">ID/Nom du Conteneur</Label>
                  <Input
                    id="targetId"
                    placeholder="mon-conteneur"
                    value={formData.target_id}
                    onChange={(e) => setFormData({ ...formData, target_id: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Activée</Label>
                <p className="text-xs text-muted-foreground">
                  La tâche s'exécutera selon la planification
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
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
              {editingJob ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Runs Dialog */}
      <Dialog open={runsDialog.open} onOpenChange={(open) => setRunsDialog({ ...runsDialog, open })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historique : {runsDialog.job?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {runsDialog.runs.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                Aucune exécution enregistrée
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
                          <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4  text-blue-500" />
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
                      <pre className="mt-2 text-xs bg-red-50 text-red-600 dark:bg-red-950/50 p-2 rounded overflow-x-auto">
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
              Fermer
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
            <AlertDialogTitle>Supprimer la Tâche</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer &quot;{deleteDialog.job?.name}&quot; ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
