'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Clock, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { getClient, ServiceName } from '@/lib/api/factory';

interface JobStats {
  total: number;
  completed: number;
  failed: number;
  avg_duration_ms: number;
  daily: { date: string; completed: number; failed: number }[];
}

export default function JobVelocityPage() {
  const [stats, setStats] = useState<JobStats>({ total: 0, completed: 0, failed: 0, avg_duration_ms: 0, daily: [] });

  useEffect(() => {
    const client = getClient(ServiceName.SCHEDULER);
    client.get<JobStats>('/jobs/stats')
      .then(res => setStats(res.data || stats))
      .catch(() => {});
  }, []);

  const successRate = stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : '—';
  const avgDuration = stats.avg_duration_ms > 0 ? `${(stats.avg_duration_ms / 1000).toFixed(2)}s` : '—';
  const maxDaily = Math.max(...stats.daily.map(d => d.completed + d.failed), 1);

  return (
    <AppLayout>
      <div className="w-full space-y-6">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Vélocité des Jobs</h1>
            <p className="text-sm text-muted-foreground">Performance du scheduler et des tâches en arrière-plan</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: stats.total, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Complétés', value: stats.completed, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
            { label: 'Échoués', value: stats.failed, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
            { label: 'Durée moy.', value: avgDuration, icon: Clock, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          ].map(c => {
            const Icon = c.icon;
            return (
              <Card key={c.label}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{c.label}</p>
                      <p className="text-2xl font-bold mt-1">{c.value}</p>
                    </div>
                    <div className={`p-2 rounded-lg ${c.bg}`}>
                      <Icon className={`h-5 w-5 ${c.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Taux de succès: {successRate}%</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.daily.length > 0 ? (
              <div className="flex items-end gap-1 h-40">
                {stats.daily.slice(-30).map((d) => {
                  const total = d.completed + d.failed;
                  const successPct = total > 0 ? (d.completed / total) * 100 : 100;
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-stretch gap-0.5" title={`${d.date}: ${d.completed} OK, ${d.failed} KO`}>
                      <div className="bg-green-500/60 rounded-t" style={{ height: `${(d.completed / maxDaily) * 100}%`, minHeight: d.completed > 0 ? '2px' : 0 }} />
                      <div className="bg-red-500/60 rounded-b" style={{ height: `${(d.failed / maxDaily) * 100}%`, minHeight: d.failed > 0 ? '2px' : 0 }} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée disponible</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
