'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RefreshCw, Mail, Send, CheckCircle2, XCircle, Eye } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { mailApi } from '@/lib/api/mail';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeliveryStats {
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
}

interface TimeSeriesPoint {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
}

type Period = '7d' | '30d' | '90d';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateTimeSeries(emails: any[], period: Period): TimeSeriesPoint[] {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const now = new Date();
  const points: TimeSeriesPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);

    const dayEmails = emails.filter((e) => {
      const eDate = (e.sent_at || e.created_at || '').slice(0, 10);
      return eDate === dateKey;
    });

    const sent = dayEmails.filter((e) => e.is_sent).length;
    const bounced = dayEmails.filter((e) => e.is_deleted && e.is_sent).length;
    const delivered = sent - bounced;
    const opened = dayEmails.filter((e) => e.is_read && e.is_sent).length;

    points.push({
      date: d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
      sent,
      delivered,
      bounced,
      opened,
    });
  }

  return points;
}

function computeStats(emails: any[]): DeliveryStats {
  const sentEmails = emails.filter((e) => e.is_sent);
  const sent = sentEmails.length;
  const bounced = sentEmails.filter((e) => e.is_deleted).length;
  const delivered = sent - bounced;
  const opened = sentEmails.filter((e) => e.is_read).length;
  return { sent, delivered, bounced, opened };
}

function pct(value: number, total: number): string {
  if (total === 0) return '0%';
  return ((value / total) * 100).toFixed(1) + '%';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmailAnalytics() {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30d');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mailApi.listEmails({ limit: 2000 });
      setEmails(res.data || []);
    } catch {
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = computeStats(emails);
  const series = generateTimeSeries(emails, period);

  const statCards = [
    { label: 'Sent', value: stats.sent, icon: Send, color: 'text-blue-600' },
    { label: 'Delivered', value: stats.delivered, icon: CheckCircle2, color: 'text-green-600', rate: pct(stats.delivered, stats.sent) },
    { label: 'Bounced', value: stats.bounced, icon: XCircle, color: 'text-red-600', rate: pct(stats.bounced, stats.sent) },
    { label: 'Opened', value: stats.opened, icon: Eye, color: 'text-purple-600', rate: pct(stats.opened, stats.delivered) },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">Email Delivery Analytics</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <Icon className={`h-5 w-5 ${s.color}`} />
                  {s.rate && (
                    <Badge variant="secondary" className="text-xs">
                      {s.rate}
                    </Badge>
                  )}
                </div>
                <p className="text-2xl font-bold mt-2">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Time Series Chart */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Delivery over time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="delivered" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="bounced" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="opened" stroke="#a855f7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
