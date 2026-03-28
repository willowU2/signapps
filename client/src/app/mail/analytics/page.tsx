'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, CheckCheck, AlertTriangle, XCircle, TrendingUp, BarChart3 } from 'lucide-react';
import { getClient, ServiceName } from '@/lib/api/factory';

interface MailStats {
  total_sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  open_rate: number;
  daily: { date: string; sent: number; delivered: number; bounced: number }[];
}

export default function MailAnalyticsPage() {
  const [stats, setStats] = useState<MailStats>({
    total_sent: 0, delivered: 0, bounced: 0, failed: 0, open_rate: 0, daily: [],
  });

  useEffect(() => {
    const client = getClient(ServiceName.MAIL);
    client.get<MailStats>('/mail/analytics')
      .then(res => setStats(res.data || stats))
      .catch(() => {});
  }, []);

  const cards = [
    { label: 'Envoyés', value: stats.total_sent, icon: Send, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Délivrés', value: stats.delivered, icon: CheckCheck, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Rebonds', value: stats.bounced, icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { label: 'Échoués', value: stats.failed, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
  ];

  const deliveryRate = stats.total_sent > 0 ? ((stats.delivered / stats.total_sent) * 100).toFixed(1) : '—';
  const maxDaily = Math.max(...stats.daily.map(d => d.sent), 1);

  return (
    <div className="w-full space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Analytics Email</h1>
            <p className="text-sm text-muted-foreground">Statistiques de livraison des emails</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.label}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
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

        {/* Rates */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <TrendingUp className="h-6 w-6 mx-auto text-green-500 mb-2" />
              <p className="text-3xl font-bold text-green-600">{deliveryRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">Taux de livraison</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <CheckCheck className="h-6 w-6 mx-auto text-blue-500 mb-2" />
              <p className="text-3xl font-bold text-blue-600">{stats.open_rate ? `${stats.open_rate}%` : '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">Taux d'ouverture</p>
            </CardContent>
          </Card>
        </div>

        {/* Daily chart (simple bar) */}
        {stats.daily.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Envois quotidiens</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-32">
                {stats.daily.slice(-30).map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-primary/60 rounded-t transition-all hover:bg-primary"
                      style={{ height: `${(d.sent / maxDaily) * 100}%`, minHeight: d.sent > 0 ? '2px' : 0 }}
                      title={`${d.date}: ${d.sent} envoyés`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>{stats.daily[0]?.date}</span>
                <span>{stats.daily[stats.daily.length - 1]?.date}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
