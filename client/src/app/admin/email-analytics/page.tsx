'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { getClient, ServiceName } from '@/lib/api/factory';
import { toast } from 'sonner';

interface EmailAnalyticsPoint {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  opened?: number;
}

interface EmailAnalyticsSummary {
  total_sent: number;
  total_delivered: number;
  total_bounced: number;
  delivery_rate: number;
  bounce_rate: number;
  history: EmailAnalyticsPoint[];
}

function StatCard({ label, value, sub, trend }: { label: string; value: string; sub: string; trend?: 'up' | 'down' | 'neutral' }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
          {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
        </div>
        <p className="text-3xl font-bold mt-1">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

export default function EmailAnalyticsPage() {
  const [data, setData] = useState<EmailAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const client = getClient(ServiceName.MAIL);
      const res = await client.get<EmailAnalyticsSummary>('/mail/analytics');
      setData(res.data);
    } catch {
      // Generate mock-free placeholder with zeros
      setData({
        total_sent: 0, total_delivered: 0, total_bounced: 0,
        delivery_rate: 0, bounce_rate: 0, history: [],
      });
      toast.error('Mail analytics endpoint unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const fmtRate = (r: number) => `${r.toFixed(1)}%`;

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Email Analytics</h1>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Total Sent" value={data?.total_sent.toLocaleString() ?? '—'} sub="All time" />
          <StatCard
            label="Delivery Rate"
            value={data ? fmtRate(data.delivery_rate) : '—'}
            sub={`${data?.total_delivered.toLocaleString() ?? 0} delivered`}
            trend={data && data.delivery_rate >= 95 ? 'up' : 'down'}
          />
          <StatCard
            label="Bounce Rate"
            value={data ? fmtRate(data.bounce_rate) : '—'}
            sub={`${data?.total_bounced.toLocaleString() ?? 0} bounced`}
            trend={data && data.bounce_rate < 2 ? 'up' : 'down'}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sent / Delivered / Bounced Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.history?.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.history} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sent" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="delivered" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="bounced" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                {loading ? 'Loading…' : 'No history data available'}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Badge variant="outline" className="text-green-600 border-green-300">Delivered</Badge>
          <Badge variant="outline" className="text-red-600 border-red-300">Bounced</Badge>
          <Badge variant="outline" className="text-indigo-600 border-indigo-300">Sent</Badge>
        </div>
      </div>
    </AppLayout>
  );
}
