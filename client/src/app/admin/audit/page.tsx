'use client';

import { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shield, Download, RefreshCw, Trash2, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/use-page-title';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { DateDisplay } from '@/components/ui/date-display';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: 'login' | 'logout' | 'create' | 'edit' | 'delete' | 'settings_change';
  target: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'signapps_audit_log';

const ACTION_LABELS: Record<AuditEntry['action'], string> = {
  login: 'Connexion',
  logout: 'Deconnexion',
  create: 'Creation',
  edit: 'Modification',
  delete: 'Suppression',
  settings_change: 'Parametre modifie',
};

const ACTION_COLORS: Record<AuditEntry['action'], string> = {
  login: 'bg-purple-500/10 text-purple-600',
  logout: 'bg-gray-500/10 text-gray-600',
  create: 'bg-green-500/10 text-green-600',
  edit: 'bg-blue-500/10 text-blue-600',
  delete: 'bg-red-500/10 text-red-600',
  settings_change: 'bg-yellow-500/10 text-yellow-700',
};

const ALL_ACTIONS: AuditEntry['action'][] = [
  'login',
  'logout',
  'create',
  'edit',
  'delete',
  'settings_change',
];

// ---------------------------------------------------------------------------
// Sample data (pre-populated)
// ---------------------------------------------------------------------------

function generateSampleEntries(): AuditEntry[] {
  const now = Date.now();
  const h = 3_600_000;
  return [
    {
      id: 'a1',
      timestamp: new Date(now - 0.1 * h).toISOString(),
      user: 'admin@signapps.local',
      action: 'login',
      target: 'Session',
      details: 'IP 192.168.1.10 - Chrome / Windows',
    },
    {
      id: 'a2',
      timestamp: new Date(now - 0.5 * h).toISOString(),
      user: 'admin@signapps.local',
      action: 'settings_change',
      target: 'LDAP Configuration',
      details: 'Enabled LDAP authentication',
    },
    {
      id: 'a3',
      timestamp: new Date(now - 1 * h).toISOString(),
      user: 'admin@signapps.local',
      action: 'create',
      target: 'User: jean.dupont@corp.local',
      details: 'Role: user, Group: Engineering',
    },
    {
      id: 'a4',
      timestamp: new Date(now - 2 * h).toISOString(),
      user: 'jean.dupont@corp.local',
      action: 'login',
      target: 'Session',
      details: 'IP 10.0.0.42 - Firefox / Linux',
    },
    {
      id: 'a5',
      timestamp: new Date(now - 3 * h).toISOString(),
      user: 'jean.dupont@corp.local',
      action: 'create',
      target: 'Document: rapport-q4.docx',
      details: 'Uploaded to /shared/reports/',
    },
    {
      id: 'a6',
      timestamp: new Date(now - 4 * h).toISOString(),
      user: 'admin@signapps.local',
      action: 'edit',
      target: 'Document: budget-2026.xlsx',
      details: 'Updated sheet "Previsionnel"',
    },
    {
      id: 'a7',
      timestamp: new Date(now - 5 * h).toISOString(),
      user: 'marie.martin@corp.local',
      action: 'login',
      target: 'Session',
      details: 'IP 172.16.0.5 - Safari / macOS',
    },
    {
      id: 'a8',
      timestamp: new Date(now - 6 * h).toISOString(),
      user: 'marie.martin@corp.local',
      action: 'delete',
      target: 'Document: brouillon-v1.pdf',
      details: 'Permanently deleted from trash',
    },
    {
      id: 'a9',
      timestamp: new Date(now - 8 * h).toISOString(),
      user: 'admin@signapps.local',
      action: 'delete',
      target: 'User: ancien.employe@corp.local',
      details: 'Account deactivated and data archived',
    },
    {
      id: 'a10',
      timestamp: new Date(now - 10 * h).toISOString(),
      user: 'admin@signapps.local',
      action: 'settings_change',
      target: 'SMTP Configuration',
      details: 'Changed outgoing mail server to mail.corp.local:587',
    },
    {
      id: 'a11',
      timestamp: new Date(now - 12 * h).toISOString(),
      user: 'jean.dupont@corp.local',
      action: 'edit',
      target: 'Document: specs-api-v2.md',
      details: 'Added section "Authentication"',
    },
    {
      id: 'a12',
      timestamp: new Date(now - 14 * h).toISOString(),
      user: 'marie.martin@corp.local',
      action: 'logout',
      target: 'Session',
      details: 'Manual logout',
    },
    {
      id: 'a13',
      timestamp: new Date(now - 24 * h).toISOString(),
      user: 'admin@signapps.local',
      action: 'create',
      target: 'Group: Marketing',
      details: 'Created group with 5 initial members',
    },
    {
      id: 'a14',
      timestamp: new Date(now - 48 * h).toISOString(),
      user: 'admin@signapps.local',
      action: 'settings_change',
      target: 'Security Policy',
      details: 'Enforced 2FA for admin accounts',
    },
    {
      id: 'a15',
      timestamp: new Date(now - 72 * h).toISOString(),
      user: 'admin@signapps.local',
      action: 'create',
      target: 'User: marie.martin@corp.local',
      details: 'Role: user, Group: Marketing',
    },
  ];
}

function loadEntries(): AuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AuditEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Corrupted — regenerate
  }
  const sample = generateSampleEntries();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sample));
  return sample;
}

function saveEntries(entries: AuditEntry[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditLogPage() {
  usePageTitle('Audit');
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  // Derived filtered list
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      // Action filter
      if (actionFilter !== 'all' && e.action !== actionFilter) return false;
      // Date range
      if (dateFrom) {
        const from = new Date(dateFrom).getTime();
        if (new Date(e.timestamp).getTime() < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo).getTime() + 86_400_000; // end of day
        if (new Date(e.timestamp).getTime() > to) return false;
      }
      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.user.toLowerCase().includes(q) ||
          e.action.toLowerCase().includes(q) ||
          e.target.toLowerCase().includes(q) ||
          (e.details || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [entries, search, actionFilter, dateFrom, dateTo]);

  const refresh = () => {
    setEntries(loadEntries());
    toast.success('Journal d\'audit rechargé');
  };

  const clearFilters = () => {
    setSearch('');
    setActionFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const headers = ['Timestamp', 'User', 'Action', 'Target', 'Details'];
    const rows = filtered.map((e) =>
      [e.timestamp, e.user, e.action, e.target, e.details || '']
        .map((v) => `"${v.replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} entries exported (CSV)`);
  };

  const exportJson = () => {
    if (filtered.length === 0) return;
    const payload = {
      export_time: new Date().toISOString(),
      total: filtered.length,
      format_version: '1.0',
      entries: filtered,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} entries exported (JSON)`);
  };

  const clearAuditLog = () => {
    const fresh = generateSampleEntries();
    saveEntries(fresh);
    setEntries(fresh);
    toast.success('Journal d\'audit réinitialisé');
  };

  const hasFilters = search || actionFilter !== 'all' || dateFrom || dateTo;

  return (
    <AppLayout>
      <div className="w-full space-y-6">
        <PageHeader
          title="Journal d'audit"
          description="Toutes les actions utilisateur — connexions, modifications, suppressions"
          icon={<Shield className="h-5 w-5" />}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={refresh}>
                <RefreshCw className="h-4 w-4" />
                Rafraîchir
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportJson}>
                <Download className="h-4 w-4" />
                JSON
              </Button>
              <Button variant="outline" size="sm" onClick={clearAuditLog}>
                <Trash2 className="h-4 w-4" />
                Reset
              </Button>
            </>
          }
        />

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-end">
              {/* Text search */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Recherche
                </label>
                <SearchInput
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Utilisateur, action, cible..."
                />
              </div>

              {/* Action filter */}
              <div className="w-[180px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Type d&apos;action
                </label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les actions</SelectItem>
                    {ALL_ACTIONS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {ACTION_LABELS[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date from */}
              <div className="w-[160px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Du
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              {/* Date to */}
              <div className="w-[160px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Au
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>

              {/* Clear filters */}
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <Filter className="h-4 w-4 mr-1" />
                  Effacer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results count */}
        <div className="flex items-center gap-2">
          <Badge variant="outline">{filtered.length} / {entries.length} entrees</Badge>
          {hasFilters && (
            <span className="text-xs text-muted-foreground">Filtres actifs</span>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[62vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Horodatage</th>
                    <th className="text-left px-4 py-2.5 font-medium">Utilisateur</th>
                    <th className="text-left px-4 py-2.5 font-medium">Action</th>
                    <th className="text-left px-4 py-2.5 font-medium">Cible</th>
                    <th className="text-left px-4 py-2.5 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((e) => (
                    <tr key={e.id} className="h-12 hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-2 text-muted-foreground text-xs whitespace-nowrap">
                        <DateDisplay date={e.timestamp} withTime />
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{e.user}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[e.action] || 'bg-muted text-muted-foreground'}`}
                        >
                          {ACTION_LABELS[e.action]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs">{e.target}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground max-w-[300px] truncate">
                        {e.details || '---'}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                        Aucune entree correspondant aux filtres
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
