'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Activity, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/use-page-title';
import { PageHeader } from '@/components/ui/page-header';

interface ApiQuotaEntry {
  user_id: string;
  email: string;
  calls_today: number;
  daily_limit: number;
  remaining: number | null;
  calls_last_minute: number;
  per_minute_limit: number;
  last_call_at: string | null;
}

function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(Math.round((used / limit) * 100), 100);
}

function usageBadgeClass(pct: number): string {
  if (pct >= 90) return 'bg-red-500/10 text-red-600';
  if (pct >= 70) return 'bg-yellow-500/10 text-yellow-600';
  return 'bg-green-500/10 text-green-600';
}

export default function ApiQuotaDashboardPage() {
  usePageTitle('Quotas API');
  const [entries, setEntries] = useState<ApiQuotaEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/metrics/api-quota', { credentials: 'include' });
      if (!resp.ok) throw new Error(await resp.text());
      setEntries(await resp.json());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Impossible de charger les données de quota API : ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalCalls = entries.reduce((s, e) => s + e.calls_today, 0);
  const usersAtLimit = entries.filter((e) => e.remaining !== null && e.remaining === 0).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Quota API"
          description="Utilisation API par utilisateur et statut des limites de débit"
          icon={<Activity className="h-5 w-5" />}
          actions={
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          }
        />

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <Activity className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total calls today</p>
                <p className="text-2xl font-bold">{totalCalls.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <Zap className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Users at limit</p>
                <p className="text-2xl font-bold text-orange-500">{usersAtLimit}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <Activity className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active users</p>
                <p className="text-2xl font-bold">{entries.filter((e) => e.calls_today > 0).length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Per-User Usage</CardTitle>
            <CardDescription>Sorted by API calls in the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Calls / 24h</TableHead>
                  <TableHead>Daily Quota</TableHead>
                  <TableHead>Calls / min</TableHead>
                  <TableHead>Last call</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No API usage data available.
                    </TableCell>
                  </TableRow>
                )}
                {entries.map((e) => {
                  const pct = usagePercent(e.calls_today, e.daily_limit);
                  return (
                    <TableRow key={e.user_id}>
                      <TableCell className="font-mono text-sm">{e.email}</TableCell>
                      <TableCell>
                        <span className="font-medium">{e.calls_today.toLocaleString()}</span>
                      </TableCell>
                      <TableCell>
                        {e.daily_limit > 0 ? (
                          <div className="space-y-1 min-w-[120px]">
                            <Progress value={pct} className="h-2" />
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {e.remaining ?? '∞'} left
                              </span>
                              <Badge className={`text-xs ${usageBadgeClass(pct)}`}>
                                {pct}%
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <Badge variant="outline">Unlimited</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{e.calls_last_minute}</span>
                        {e.per_minute_limit > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            / {e.per_minute_limit}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {e.last_call_at
                          ? new Date(e.last_call_at).toLocaleTimeString()
                          : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
