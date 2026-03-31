'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Shield,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  History,
  TrendingDown,
  Clock,
  Ban,
  Trash2,
} from 'lucide-react';
import { usePageTitle } from '@/hooks/use-page-title';
import {
  driveAuditApi,
  type AuditLogEntry,
  type ChainVerification,
} from '@/lib/api/storage';

// ─── Alert card config ───────────────────────────────────────

interface AlertConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  colorCls: string;
  bgCls: string;
  borderCls: string;
}

const ALERT_CONFIGS: AlertConfig[] = [
  {
    key: 'mass_download',
    label: 'Téléchargement massif',
    description: 'Détecte les téléchargements en masse inhabituels',
    icon: TrendingDown,
    colorCls: 'text-amber-700 dark:text-amber-400',
    bgCls: 'bg-amber-50 dark:bg-amber-900/20',
    borderCls: 'border-amber-200 dark:border-amber-800',
  },
  {
    key: 'off_hours',
    label: 'Accès hors horaires',
    description: 'Signale les accès en dehors des heures ouvrées',
    icon: Clock,
    colorCls: 'text-blue-700 dark:text-blue-400',
    bgCls: 'bg-blue-50 dark:bg-blue-900/20',
    borderCls: 'border-blue-200 dark:border-blue-800',
  },
  {
    key: 'access_denied_burst',
    label: 'Rafale de refus',
    description: 'Multiple tentatives d\'accès refusées consécutives',
    icon: Ban,
    colorCls: 'text-red-700 dark:text-red-400',
    bgCls: 'bg-red-50 dark:bg-red-900/20',
    borderCls: 'border-red-200 dark:border-red-800',
  },
  {
    key: 'mass_delete',
    label: 'Suppression massive',
    description: 'Suppression de nombreux fichiers en peu de temps',
    icon: Trash2,
    colorCls: 'text-red-700 dark:text-red-400',
    bgCls: 'bg-red-50 dark:bg-red-900/20',
    borderCls: 'border-red-200 dark:border-red-800',
  },
];

// ─── Action labels ───────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  view: 'Consultation',
  download: 'Téléchargement',
  create: 'Création',
  update: 'Modification',
  move: 'Déplacement',
  rename: 'Renommage',
  delete: 'Suppression',
  share: 'Partage',
  access_denied: 'Accès refusé',
};

const ACTION_OPTIONS = [
  { value: 'all', label: 'Toutes les actions' },
  ...Object.entries(ACTION_LABELS).map(([k, v]) => ({ value: k, label: v })),
];

// ─── Alert toggle card ───────────────────────────────────────

interface AlertCardProps {
  config: AlertConfig;
  enabled: boolean;
  threshold?: number;
  onToggle: () => void;
}

function AlertCard({ config, enabled, threshold, onToggle }: AlertCardProps) {
  const Icon = config.icon;
  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-3 transition-all ${config.bgCls} ${config.borderCls}`}
    >
      <div className={`mt-0.5 p-2 rounded-lg bg-white/60 dark:bg-black/20`}>
        <Icon className={`h-4 w-4 ${config.colorCls}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={`text-sm font-semibold ${config.colorCls}`}>{config.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
            {threshold !== undefined && (
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                Seuil: {threshold}
              </p>
            )}
          </div>
          <button
            onClick={onToggle}
            className="shrink-0 mt-0.5 transition-colors"
            title={enabled ? 'Désactiver' : 'Activer'}
          >
            {enabled ? (
              <ToggleRight className={`h-6 w-6 ${config.colorCls}`} />
            ) : (
              <ToggleLeft className="h-6 w-6 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function DriveAuditPage() {
  usePageTitle('Audit Drive');

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const [verification, setVerification] = useState<ChainVerification | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [alertStates, setAlertStates] = useState<Record<string, boolean>>({
    mass_download: true,
    off_hours: true,
    access_denied_burst: true,
    mass_delete: true,
  });

  const [alertThresholds] = useState<Record<string, number>>({
    mass_download: 50,
    off_hours: 0,
    access_denied_burst: 5,
    mass_delete: 10,
  });

  // Filters
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Export state
  const [exporting, setExporting] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await driveAuditApi.list({
        actor_id: actorFilter.trim() || undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      const data = res.data ?? [];
      setEntries(data);
      setTotal(data.length === PAGE_SIZE ? (page + 1) * PAGE_SIZE + 1 : page * PAGE_SIZE + data.length);
    } catch {
      toast.error('Impossible de charger les journaux');
    } finally {
      setLoading(false);
    }
  }, [actorFilter, actionFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await driveAuditApi.verify();
      setVerification(res.data);
      if (res.data?.valid) {
        toast.success('Chaîne d\'intégrité vérifiée — aucune altération détectée');
      } else {
        toast.error('Intégrité compromise — altération détectée !');
      }
    } catch {
      toast.error('Erreur lors de la vérification');
    } finally {
      setVerifying(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await driveAuditApi.export({
        format: 'csv',
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drive-audit-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Export CSV téléchargé');
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  const toggleAlert = (key: string) => {
    setAlertStates((prev) => ({ ...prev, [key]: !prev[key] }));
    toast.success(`Alerte "${key}" ${alertStates[key] ? 'désactivée' : 'activée'}`);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const getActionBadge = (action: string) => {
    const label = ACTION_LABELS[action] ?? action;
    let cls = 'bg-muted text-muted-foreground border-border';
    if (['view', 'download'].includes(action))
      cls = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    else if (['create'].includes(action))
      cls = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800';
    else if (['update', 'move', 'rename'].includes(action))
      cls = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    else if (['delete', 'access_denied'].includes(action))
      cls = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800';
    else if (['share'].includes(action))
      cls = 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800';

    return (
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 font-medium ${cls}`}>
        {label}
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 pb-24 w-full max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <History className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Audit du Drive</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Journal forensique des accès et modifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Exporter CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={loadEntries}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Rafraîchir
            </Button>
          </div>
        </div>

        {/* Alert cards */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Alertes de sécurité
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ALERT_CONFIGS.map((cfg) => (
              <AlertCard
                key={cfg.key}
                config={cfg}
                enabled={alertStates[cfg.key] ?? false}
                threshold={alertThresholds[cfg.key]}
                onToggle={() => toggleAlert(cfg.key)}
              />
            ))}
          </div>
        </div>

        {/* Chain verification */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Intégrité de la chaîne</p>
                <p className="text-xs text-muted-foreground">
                  Vérification des hachages SHA256 enchaînés
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleVerify}
              disabled={verifying}
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Vérifier l&apos;intégrité
            </Button>
          </div>

          {verification && (
            <div
              className={`mt-4 flex items-center gap-3 rounded-lg border p-3 text-sm ${
                verification.valid
                  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              }`}
            >
              {verification.valid ? (
                <CheckCircle2 className="h-5 w-5 shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0" />
              )}
              <div>
                <p className="font-semibold">
                  {verification.valid ? 'Chaîne intègre' : 'Altération détectée'}
                </p>
                <p className="text-xs opacity-80">
                  {verification.valid
                    ? `${verification.total_entries} entrées vérifiées sans anomalie`
                    : `Première corruption à l'entrée #${(verification.first_corrupt_index ?? 0) + 1}`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Log table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Filters bar */}
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
            <Input
              placeholder="Filtrer par utilisateur…"
              value={actorFilter}
              onChange={(e) => { setActorFilter(e.target.value); setPage(0); }}
              className="h-8 text-xs w-[180px]"
            />

            <Select
              value={actionFilter}
              onValueChange={(v) => { setActionFilter(v); setPage(0); }}
            >
              <SelectTrigger className="h-8 text-xs w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
              className="h-8 text-xs rounded-md border border-input bg-background px-2 w-[130px] focus:outline-none focus:ring-1 focus:ring-ring"
              title="Depuis"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
              className="h-8 text-xs rounded-md border border-input bg-background px-2 w-[130px] focus:outline-none focus:ring-1 focus:ring-ring"
              title="Jusqu'au"
            />

            {(actorFilter || actionFilter !== 'all' || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => {
                  setActorFilter('');
                  setActionFilter('all');
                  setDateFrom('');
                  setDateTo('');
                  setPage(0);
                }}
              >
                Réinitialiser
              </Button>
            )}

            <span className="ml-auto text-xs text-muted-foreground">
              {total} entrée{total !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left font-medium w-36">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Utilisateur</th>
                  <th className="px-4 py-3 text-left font-medium w-32">Action</th>
                  <th className="px-4 py-3 text-left font-medium">Fichier</th>
                  <th className="px-4 py-3 text-left font-medium w-28 hidden lg:table-cell">IP</th>
                  <th className="px-4 py-3 text-left font-medium w-16 hidden lg:table-cell">Géoloc</th>
                  <th className="px-4 py-3 text-left font-medium w-28 hidden xl:table-cell">Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      Aucune entrée trouvée
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const date = new Date(entry.created_at);
                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-accent/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {date.toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                          })}{' '}
                          {date.toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {entry.actor_name ?? entry.actor_id}
                        </td>
                        <td className="px-4 py-3">{getActionBadge(entry.action)}</td>
                        <td
                          className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate"
                          title={entry.node_path}
                        >
                          {entry.node_path || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell font-mono">
                          {entry.actor_ip ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                          {entry.actor_geo ?? '—'}
                        </td>
                        <td
                          className="px-4 py-3 text-[10px] text-muted-foreground/60 font-mono hidden xl:table-cell"
                          title={entry.log_hash}
                        >
                          {entry.log_hash ? `${entry.log_hash.substring(0, 8)}…` : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Page {page + 1} sur {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
