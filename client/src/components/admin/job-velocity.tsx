'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Zap } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { getClient, ServiceName } from '@/lib/api/factory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JobBucket {
  label: string;
  success: number;
  failure: number;
  total: number;
}

type Granularity = 'hourly' | 'daily';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JobVelocity() {
  const [buckets, setBuckets] = useState<JobBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>('hourly');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const client = getClient(ServiceName.SCHEDULER);
      const res = await client.get<{ jobs: any[] }>('/jobs', { params: { limit: 1000 } });
      const jobs: any[] = res.data?.jobs || res.data || [];

      const map = new Map<string, { success: number; failure: number }>();

      for (const job of jobs) {
        const ts = job.completed_at || job.created_at || job.scheduled_at;
        if (!ts) continue;
        const d = new Date(ts);
        const key =
          granularity === 'hourly'
            ? `${d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })} ${String(d.getHours()).padStart(2, '0')}h`
            : d.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });

        const entry = map.get(key) || { success: 0, failure: 0 };
        if (job.status === 'failed' || job.status === 'error') {
          entry.failure++;
        } else {
          entry.success++;
        }
        map.set(key, entry);
      }

      const result: JobBucket[] = Array.from(map.entries())
        .map(([label, v]) => ({
          label,
          success: v.success,
          failure: v.failure,
          total: v.success + v.failure,
        }))
        .slice(-24);

      setBuckets(result);
    } catch {
      setBuckets([]);
    } finally {
      setLoading(false);
    }
  }, [granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalSuccess = buckets.reduce((s, b) => s + b.success, 0);
  const totalFailed = buckets.reduce((s, b) => s + b.failure, 0);
  const totalAll = totalSuccess + totalFailed;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">Job Velocity</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Per Hour</SelectItem>
              <SelectItem value="daily">Per Day</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{totalAll}</p>
            <p className="text-xs text-muted-foreground">Total Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">{totalSuccess}</p>
            <p className="text-xs text-muted-foreground">Succeeded</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-red-600">{totalFailed}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">
            Jobs processed ({granularity === 'hourly' ? 'per hour' : 'per day'})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {buckets.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              {loading ? 'Chargement...' : 'No job data available'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={buckets}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="success" fill="#22c55e" stackId="a" name="Success" radius={[0, 0, 0, 0]} />
                <Bar dataKey="failure" fill="#ef4444" stackId="a" name="Failure" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
