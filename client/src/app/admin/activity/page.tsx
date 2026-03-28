'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Search, Download, Activity, Clock, FileText, Mail, Calendar } from 'lucide-react';
import { getClient, ServiceName } from '@/lib/api/factory';
import { usePageTitle } from '@/hooks/use-page-title';

interface UserActivity {
  user_id: string;
  username: string;
  email: string;
  last_active: string;
  actions_today: number;
  actions_week: number;
  top_modules: string[];
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  docs: <FileText className="h-3 w-3" />,
  mail: <Mail className="h-3 w-3" />,
  calendar: <Calendar className="h-3 w-3" />,
};

export default function UserActivityPage() {
  usePageTitle('Activite');
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = getClient(ServiceName.METRICS);
    client.get<UserActivity[]>('/metrics/user-activity')
      .then(res => setUsers(res.data || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(u => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const exportCsv = () => {
    const headers = ['Utilisateur', 'Email', 'Dernière activité', 'Actions (jour)', 'Actions (semaine)', 'Modules'];
    const rows = filtered.map(u => [u.username, u.email, u.last_active, u.actions_today, u.actions_week, u.top_modules.join(';')].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'user-activity.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalActive = users.filter(u => u.actions_today > 0).length;

  return (
    <AppLayout>
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Activité utilisateurs</h1>
              <p className="text-sm text-muted-foreground">Rapport d'activité par utilisateur</p>
            </div>
          </div>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold">{users.length}</p>
              <p className="text-xs text-muted-foreground">Utilisateurs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-green-600">{totalActive}</p>
              <p className="text-xs text-muted-foreground">Actifs aujourd'hui</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{users.reduce((s, u) => s + u.actions_week, 0)}</p>
              <p className="text-xs text-muted-foreground">Actions cette semaine</p>
            </CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un utilisateur..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Utilisateur</th>
                    <th className="text-left px-4 py-2 font-medium">Dernière activité</th>
                    <th className="text-right px-4 py-2 font-medium">Jour</th>
                    <th className="text-right px-4 py-2 font-medium">Semaine</th>
                    <th className="text-left px-4 py-2 font-medium">Modules</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((u) => (
                    <tr key={u.user_id} className="hover:bg-accent/40">
                      <td className="px-4 py-2">
                        <div>
                          <p className="font-medium">{u.username}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {new Date(u.last_active).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{u.actions_today}</td>
                      <td className="px-4 py-2 text-right font-mono">{u.actions_week}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          {u.top_modules.slice(0, 3).map(m => (
                            <Badge key={m} variant="secondary" className="text-[10px] gap-1">
                              {MODULE_ICONS[m]}
                              {m}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">{loading ? 'Chargement...' : 'Aucun utilisateur'}</td></tr>
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
