'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Shield, Download, Search, RefreshCw } from 'lucide-react';
import { auditApi } from '@/lib/api/crosslinks';
import type { AuditLogEntry } from '@/types/crosslinks';
import { toast } from 'sonner';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-500/10 text-green-600',
  update: 'bg-blue-500/10 text-blue-600',
  delete: 'bg-red-500/10 text-red-600',
  login: 'bg-purple-500/10 text-purple-600',
  logout: 'bg-gray-500/10 text-gray-600',
};

export default function AuditReportPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const res = await auditApi.query({ limit: 500 });
      setEntries(res.data || []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAudit(); }, []);

  const filtered = entries.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.action?.toLowerCase().includes(q) ||
      e.entity_type?.toLowerCase().includes(q) ||
      e.actor_id?.toLowerCase().includes(q)
    );
  });

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const headers = ['Date', 'Action', 'Entity Type', 'Entity ID', 'Actor', 'Details'];
    const rows = filtered.map(e => [
      new Date(e.created_at).toISOString(),
      e.action || '',
      e.entity_type || '',
      e.entity_id || '',
      e.actor_id || '',
      JSON.stringify(e.changes || {}),
    ].map(v => `"${v.replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} entrées exportées (CSV)`);
  };

  const exportJson = () => {
    if (filtered.length === 0) return;
    // SIEM-ready structured format (IDEA-078 + IDEA-082)
    const payload = {
      export_time: new Date().toISOString(),
      total: filtered.length,
      format_version: '1.0',
      events: filtered.map(e => ({
        id: e.id,
        timestamp: e.created_at,
        action: e.action,
        entity_type: e.entity_type,
        entity_id: e.entity_id,
        actor_id: e.actor_id,
        changes: e.changes || {},
        source: 'signapps-audit',
      })),
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-report-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} entrées exportées (JSON/SIEM)`);
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Rapport d'audit</h1>
              <p className="text-sm text-muted-foreground">Journal complet des actions système</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchAudit} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Rafraîchir
            </Button>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={exportJson}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par action, type, acteur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">{filtered.length} entrées</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Date</th>
                    <th className="text-left px-4 py-2 font-medium">Action</th>
                    <th className="text-left px-4 py-2 font-medium">Type</th>
                    <th className="text-left px-4 py-2 font-medium">Entity</th>
                    <th className="text-left px-4 py-2 font-medium">Acteur</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((e) => (
                    <tr key={e.id} className="hover:bg-accent/40 transition-colors">
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {new Date(e.created_at).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[e.action] || 'bg-muted text-muted-foreground'}`}>
                          {e.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{e.entity_type}</td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{e.entity_id?.slice(0, 8)}...</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{e.actor_id?.slice(0, 8) || '—'}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        {loading ? 'Chargement...' : 'Aucune entrée d\'audit'}
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
