'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCw, CheckCircle, XCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getClient, ServiceName } from '@/lib/api/factory';

interface EndpointHealth {
  service: string;
  endpoint: string;
  method: string;
  avgMs: number;
  errorRate: number;
  p99: number;
  status: 'healthy' | 'degraded' | 'down';
  history: { t: string; ms: number }[];
}

const ENDPOINTS: Array<{ service: string; svc: ServiceName; endpoint: string; method: string }> = [
  { service: 'identity', svc: ServiceName.IDENTITY, endpoint: '/health', method: 'GET' },
  { service: 'storage', svc: ServiceName.STORAGE, endpoint: '/health', method: 'GET' },
  { service: 'mail', svc: ServiceName.MAIL, endpoint: '/health', method: 'GET' },
  { service: 'calendar', svc: ServiceName.CALENDAR, endpoint: '/health', method: 'GET' },
  { service: 'ai', svc: ServiceName.AI, endpoint: '/health', method: 'GET' },
  { service: 'scheduler', svc: ServiceName.SCHEDULER, endpoint: '/health', method: 'GET' },
];

function StatusIcon({ status }: { status: EndpointHealth['status'] }) {
  if (status === 'healthy') return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === 'degraded') return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
}

export function ApiHealthStatus() {
  const [health, setHealth] = useState<EndpointHealth[]>([]);
  const [loading, setLoading] = useState(false);

  const probe = async () => {
    setLoading(true);
    const results: EndpointHealth[] = [];

    for (const ep of ENDPOINTS) {
      const times: number[] = [];
      let errors = 0;

      // Probe 3 times
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        try {
          const client = getClient(ep.svc);
          await client.get(ep.endpoint, { timeout: 3000 });
          times.push(Date.now() - start);
        } catch {
          errors++;
          times.push(3000);
        }
      }

      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      const p99 = Math.max(...times);
      const errorRate = (errors / 3) * 100;
      const status: EndpointHealth['status'] = errors === 3 ? 'down' : avg > 500 ? 'degraded' : 'healthy';

      results.push({
        service: ep.service,
        endpoint: ep.endpoint,
        method: ep.method,
        avgMs: avg,
        errorRate,
        p99,
        status,
        history: times.map((ms, i) => ({ t: `T-${3 - i}`, ms })),
      });
    }

    setHealth(results);
    setLoading(false);
  };

  useEffect(() => { probe(); }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-primary" />
            API Health Status
          </CardTitle>
          <Button variant="outline" size="sm" onClick={probe} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {health.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-4">No health data. Click Refresh.</p>
          )}
          {loading && (
            <div className="space-y-2">
              {ENDPOINTS.map(ep => (
                <div key={ep.service} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          )}
          {health.map(ep => (
            <div key={ep.service} className="flex items-center gap-3 p-3 rounded-lg border">
              <StatusIcon status={ep.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium capitalize">{ep.service}</span>
                  <span className="text-xs font-mono text-muted-foreground">{ep.method} {ep.endpoint}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span>avg: <strong className={ep.avgMs > 500 ? 'text-red-500' : ep.avgMs > 200 ? 'text-yellow-500' : 'text-green-600'}>{ep.avgMs}ms</strong></span>
                  <span>p99: {ep.p99}ms</span>
                  <span>errors: {ep.errorRate.toFixed(0)}%</span>
                </div>
              </div>
              <div className="w-24 h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ep.history}>
                    <Line type="monotone" dataKey="ms" stroke={ep.status === 'healthy' ? '#22c55e' : '#ef4444'} dot={false} strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <Badge variant={ep.status === 'healthy' ? 'default' : ep.status === 'degraded' ? 'secondary' : 'destructive'}
                className={`text-xs shrink-0 ${ep.status === 'healthy' ? 'bg-green-500' : ''}`}>
                {ep.status}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
