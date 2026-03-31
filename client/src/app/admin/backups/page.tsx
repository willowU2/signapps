'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from 'sonner';
import {
  ArchiveRestore,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  HardDrive,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  backupApi,
  type BackupPlan,
  type BackupSnapshot,
  type BackupSnapshotDetail,
  type CreateBackupPlan,
} from '@/lib/api/storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function backupTypeLabel(t: string): string {
  switch (t) {
    case 'full': return 'Complète';
    case 'incremental': return 'Incrémentale';
    case 'differential': return 'Différentielle';
    default: return t;
  }
}

function SnapshotStatusBadge({ status }: { status: string }) {
  if (status === 'completed')
    return <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Terminée</Badge>;
  if (status === 'running')
    return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">En cours</Badge>;
  return <Badge className="bg-red-500/15 text-red-600 border-red-500/30">Échouée</Badge>;
}

// ---------------------------------------------------------------------------
// Plan form dialog
// ---------------------------------------------------------------------------

interface PlanFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateBackupPlan) => Promise<void>;
  initial?: BackupPlan | null;
}

function PlanFormDialog({ open, onClose, onSave, initial }: PlanFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [schedule, setSchedule] = useState(initial?.schedule ?? '0 2 * * *');
  const [backupType, setBackupType] = useState<string>(initial?.backup_type ?? 'incremental');
  const [retentionDays, setRetentionDays] = useState(String(initial?.retention_days ?? 30));
  const [maxSnapshots, setMaxSnapshots] = useState(String(initial?.max_snapshots ?? 10));
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setSchedule(initial?.schedule ?? '0 2 * * *');
      setBackupType(initial?.backup_type ?? 'incremental');
      setRetentionDays(String(initial?.retention_days ?? 30));
      setMaxSnapshots(String(initial?.max_snapshots ?? 10));
      setEnabled(initial?.enabled ?? true);
    }
  }, [open, initial]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Le nom du plan est requis');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        schedule,
        backup_type: backupType as 'full' | 'incremental' | 'differential',
        retention_days: parseInt(retentionDays, 10) || 30,
        max_snapshots: parseInt(maxSnapshots, 10) || 10,
        enabled,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Modifier le plan' : 'Nouveau plan de sauvegarde'}</DialogTitle>
          <DialogDescription>
            Configurez la planification et la politique de rétention.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="plan-name">Nom</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sauvegarde quotidienne"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="plan-schedule">Planification (CRON)</Label>
            <Input
              id="plan-schedule"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="0 2 * * *"
            />
            <p className="text-xs text-muted-foreground">
              Format : minute heure jour mois jour-semaine. Ex : <code>0 2 * * *</code> = chaque nuit à 2 h.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label>Type de sauvegarde</Label>
            <Select value={backupType} onValueChange={setBackupType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="incremental">Incrémentale</SelectItem>
                <SelectItem value="full">Complète</SelectItem>
                <SelectItem value="differential">Différentielle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="retention-days">Rétention (jours)</Label>
              <Input
                id="retention-days"
                type="number"
                min={1}
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="max-snapshots">Snapshots max</Label>
              <Input
                id="max-snapshots"
                type="number"
                min={1}
                value={maxSnapshots}
                onChange={(e) => setMaxSnapshots(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Plan actif</p>
              <p className="text-xs text-muted-foreground">Les sauvegardes seront exécutées automatiquement</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initial ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Restore dialog
// ---------------------------------------------------------------------------

interface RestoreDialogProps {
  snapshot: BackupSnapshot | null;
  onClose: () => void;
  onRestore: (snapshotId: string, nodePath?: string) => Promise<void>;
}

function RestoreDialog({ snapshot, onClose, onRestore }: RestoreDialogProps) {
  const [nodePath, setNodePath] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (snapshot) setNodePath('');
  }, [snapshot]);

  const handleRestore = async () => {
    if (!snapshot) return;
    setLoading(true);
    try {
      await onRestore(snapshot.id, nodePath || undefined);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!snapshot} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Restaurer depuis le snapshot</DialogTitle>
          <DialogDescription>
            Restaurez tout ou partie du snapshot sélectionné.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Chemin à restaurer (optionnel)</Label>
            <Input
              value={nodePath}
              onChange={(e) => setNodePath(e.target.value)}
              placeholder="Laisser vide pour tout restaurer"
            />
            <p className="text-xs text-muted-foreground">
              Ex : <code>/Documents/Projets</code>. Vide = restauration complète.
            </p>
          </div>
          {snapshot && (
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Date :</span> {formatDate(snapshot.started_at)}</p>
              <p><span className="text-muted-foreground">Fichiers :</span> {snapshot.files_count}</p>
              <p><span className="text-muted-foreground">Taille :</span> {formatBytes(snapshot.total_size)}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Annuler</Button>
          <Button onClick={handleRestore} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Restaurer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Snapshot detail row (expandable)
// ---------------------------------------------------------------------------

function SnapshotRow({
  snapshot,
  planName,
  onDelete,
  onRestore,
}: {
  snapshot: BackupSnapshot;
  planName: string;
  onDelete: (id: string) => void;
  onRestore: (s: BackupSnapshot) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<BackupSnapshotDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const toggleExpand = async () => {
    if (!expanded && !detail) {
      setLoadingDetail(true);
      try {
        const res = await backupApi.getSnapshot(snapshot.id);
        setDetail(res.data);
      } catch {
        toast.error('Impossible de charger les détails');
      } finally {
        setLoadingDetail(false);
      }
    }
    setExpanded((v) => !v);
  };

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={toggleExpand}>
        <TableCell>
          {loadingDetail ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium">{planName}</TableCell>
        <TableCell>{backupTypeLabel(snapshot.backup_type)}</TableCell>
        <TableCell>
          <SnapshotStatusBadge status={snapshot.status} />
        </TableCell>
        <TableCell>{formatDate(snapshot.started_at)}</TableCell>
        <TableCell>{snapshot.files_count}</TableCell>
        <TableCell>{formatBytes(snapshot.total_size)}</TableCell>
        <TableCell>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {snapshot.status === 'completed' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Restaurer"
                onClick={() => onRestore(snapshot)}
              >
                <ArchiveRestore className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Supprimer"
              onClick={() => onDelete(snapshot.id)}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {expanded && detail && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30 p-0">
            <div className="px-8 py-3">
              {detail.error_message && (
                <p className="text-sm text-red-500 mb-2">Erreur : {detail.error_message}</p>
              )}
              {detail.entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun fichier dans ce snapshot.</p>
              ) : (
                <div className="max-h-48 overflow-auto rounded border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-medium">Chemin</th>
                        <th className="text-right px-3 py-1.5 font-medium">Taille</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.entries.map((e) => (
                        <tr key={e.id} className="border-t hover:bg-muted/50">
                          <td className="px-3 py-1 font-mono text-muted-foreground">{e.node_path}</td>
                          <td className="px-3 py-1 text-right tabular-nums">{formatBytes(e.file_size)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DriveBackupsPage() {
  const [plans, setPlans] = useState<BackupPlan[]>([]);
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BackupPlan | null>(null);
  const [restoreSnapshot, setRestoreSnapshot] = useState<BackupSnapshot | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const res = await backupApi.listPlans();
      setPlans(res.data);
    } catch {
      toast.error('Impossible de charger les plans');
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  const fetchSnapshots = useCallback(async () => {
    setLoadingSnapshots(true);
    try {
      const res = await backupApi.listSnapshots();
      setSnapshots(res.data);
    } catch {
      toast.error('Impossible de charger les snapshots');
    } finally {
      setLoadingSnapshots(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchSnapshots();
  }, [fetchPlans, fetchSnapshots]);

  // Plans handlers

  const handleSavePlan = async (data: CreateBackupPlan) => {
    if (editingPlan) {
      await backupApi.updatePlan(editingPlan.id, data);
      toast.success('Plan mis à jour');
    } else {
      await backupApi.createPlan(data);
      toast.success('Plan créé');
    }
    await fetchPlans();
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Supprimer ce plan de sauvegarde et tous ses snapshots ?')) return;
    try {
      await backupApi.deletePlan(id);
      toast.success('Plan supprimé');
      fetchPlans();
      fetchSnapshots();
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleRunPlan = async (id: string) => {
    try {
      await backupApi.runPlan(id);
      toast.success('Sauvegarde démarrée');
      setTimeout(fetchSnapshots, 2000);
    } catch {
      toast.error('Impossible de déclencher la sauvegarde');
    }
  };

  const handleTogglePlan = async (plan: BackupPlan) => {
    try {
      await backupApi.updatePlan(plan.id, { enabled: !plan.enabled });
      fetchPlans();
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  // Snapshots handlers

  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm('Supprimer ce snapshot ?')) return;
    try {
      await backupApi.deleteSnapshot(id);
      toast.success('Snapshot supprimé');
      fetchSnapshots();
    } catch {
      toast.error('Erreur lors de la suppression du snapshot');
    }
  };

  const handleRestore = async (snapshotId: string, nodePath?: string) => {
    try {
      const res = await backupApi.restore({ snapshot_id: snapshotId, node_path: nodePath });
      toast.success(res.data.message);
    } catch {
      toast.error('Erreur lors de la restauration');
    }
  };

  // Plan name lookup
  const planNameById = (id: string) =>
    plans.find((p) => p.id === id)?.name ?? id.slice(0, 8) + '…';

  return (
    <AppLayout>
      <div className="space-y-8 pb-16">
        <PageHeader
          title="Sauvegardes Drive"
          description="Gérez les plans de sauvegarde automatique et consultez l'historique des snapshots."
          icon={<HardDrive className="h-5 w-5" />}
        />

        {/* ----------------------------------------------------------------- */}
        {/* Plans table                                                         */}
        {/* ----------------------------------------------------------------- */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Plans de sauvegarde</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchPlans} disabled={loadingPlans}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingPlans ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditingPlan(null);
                  setPlanDialogOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nouveau plan
              </Button>
            </div>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Planification</TableHead>
                  <TableHead>Dernière exécution</TableHead>
                  <TableHead>Prochaine exécution</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPlans ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                      Chargement…
                    </TableCell>
                  </TableRow>
                ) : plans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucun plan configuré. Créez votre premier plan.
                    </TableCell>
                  </TableRow>
                ) : (
                  plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{backupTypeLabel(plan.backup_type)}</Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{plan.schedule}</code>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {plan.last_run_at ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                            {formatDate(plan.last_run_at)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            Jamais
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(plan.next_run_at)}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={plan.enabled}
                          onCheckedChange={() => handleTogglePlan(plan)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Lancer maintenant"
                            onClick={() => handleRunPlan(plan.id)}
                          >
                            <Play className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Modifier"
                            onClick={() => {
                              setEditingPlan(plan);
                              setPlanDialogOpen(true);
                            }}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Supprimer"
                            onClick={() => handleDeletePlan(plan.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Snapshots table                                                     */}
        {/* ----------------------------------------------------------------- */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Historique des snapshots</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchSnapshots} disabled={loadingSnapshots}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingSnapshots ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
            </div>
          </div>

          {/* Summary badges */}
          <div className="flex gap-3 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              {snapshots.filter((s) => s.status === 'completed').length} terminées
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 text-blue-500" />
              {snapshots.filter((s) => s.status === 'running').length} en cours
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
              {snapshots.filter((s) => s.status === 'failed').length} échouées
            </span>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Plan</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Démarré le</TableHead>
                  <TableHead>Fichiers</TableHead>
                  <TableHead>Taille</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSnapshots ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                      Chargement…
                    </TableCell>
                  </TableRow>
                ) : snapshots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Aucun snapshot. Lancez une sauvegarde pour commencer.
                    </TableCell>
                  </TableRow>
                ) : (
                  snapshots.map((snapshot) => (
                    <SnapshotRow
                      key={snapshot.id}
                      snapshot={snapshot}
                      planName={planNameById(snapshot.plan_id)}
                      onDelete={handleDeleteSnapshot}
                      onRestore={setRestoreSnapshot}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Dialogs                                                               */}
      {/* ------------------------------------------------------------------- */}
      <PlanFormDialog
        open={planDialogOpen}
        onClose={() => {
          setPlanDialogOpen(false);
          setEditingPlan(null);
        }}
        onSave={handleSavePlan}
        initial={editingPlan}
      />

      <RestoreDialog
        snapshot={restoreSnapshot}
        onClose={() => setRestoreSnapshot(null)}
        onRestore={handleRestore}
      />
    </AppLayout>
  );
}
