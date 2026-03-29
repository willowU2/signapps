'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Download, Search, Users, ArrowUpDown } from 'lucide-react';
import { usersApi, auditApi, type User } from '@/lib/api/identity';
import { exportToCsv } from '@/lib/export-csv';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserActivityRow {
  id: string;
  username: string;
  email: string;
  display_name: string;
  last_login: string | null;
  actions_count: number;
  storage_used: number;
  role: number;
}

type SortKey = 'username' | 'last_login' | 'actions_count' | 'storage_used';
type SortDir = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function roleName(role: number): string {
  if (role >= 2) return 'Admin';
  if (role === 1) return 'User';
  return 'Guest';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserActivity() {
  const [rows, setRows] = useState<UserActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('last_login');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const usersRes = await usersApi.list(1, 500);
      const ud = usersRes.data as any; const users: User[] = Array.isArray(ud) ? ud : (ud?.users || []);

      // Fetch audit counts per user
      const auditCounts = new Map<string, number>();
      try {
        const auditRes = await auditApi.list({ limit: 5000 });
        const logs = auditRes.data?.logs || [];
        for (const log of logs) {
          auditCounts.set(log.user_id, (auditCounts.get(log.user_id) || 0) + 1);
        }
      } catch {
        // audit service may not be available
      }

      const result: UserActivityRow[] = users.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email || '',
        display_name: u.display_name || u.username,
        last_login: u.last_login || null,
        actions_count: auditCounts.get(u.id) || 0,
        storage_used: 0, // populated from quota API if available
        role: u.role,
      }));

      setRows(result);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    let list = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.username.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.display_name.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'username':
          cmp = a.username.localeCompare(b.username);
          break;
        case 'last_login':
          cmp = (a.last_login || '').localeCompare(b.last_login || '');
          break;
        case 'actions_count':
          cmp = a.actions_count - b.actions_count;
          break;
        case 'storage_used':
          cmp = a.storage_used - b.storage_used;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, search, sortKey, sortDir]);

  const handleExport = () => {
    exportToCsv(
      filtered.map((r) => ({
        Username: r.username,
        Email: r.email,
        'Display Name': r.display_name,
        Role: roleName(r.role),
        'Last Login': r.last_login ? new Date(r.last_login).toISOString() : 'Never',
        'Actions Count': r.actions_count,
        'Storage Used (bytes)': r.storage_used,
      })),
      `user-activity-${new Date().toISOString().slice(0, 10)}`
    );
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="text-left px-4 py-2 font-medium cursor-pointer hover:text-primary select-none"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
        {sortKey === field && (
          <span className="text-[10px] text-primary">{sortDir === 'asc' ? 'ASC' : 'DESC'}</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">User Activity Report</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Users</CardTitle>
            <Badge variant="secondary">{filtered.length} users</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <SortHeader label="Username" field="username" />
                  <th className="text-left px-4 py-2 font-medium">Email</th>
                  <th className="text-left px-4 py-2 font-medium">Role</th>
                  <SortHeader label="Last Login" field="last_login" />
                  <SortHeader label="Actions" field="actions_count" />
                  <SortHeader label="Storage" field="storage_used" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-accent/40 transition-colors">
                    <td className="px-4 py-2 font-medium">{r.username}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.email || '—'}</td>
                    <td className="px-4 py-2">
                      <Badge
                        variant={r.role >= 2 ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {roleName(r.role)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {r.last_login
                        ? new Date(r.last_login).toLocaleString('fr-FR')
                        : 'Never'}
                    </td>
                    <td className="px-4 py-2 text-center">{r.actions_count}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.storage_used > 0 ? formatBytes(r.storage_used) : '—'}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {loading ? 'Chargement...' : 'No users found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
