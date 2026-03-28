'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileType, RefreshCw } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { storageStatsApi } from '@/lib/api/storage';
import { getClient, ServiceName } from '@/lib/api/factory';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/use-page-title';

interface FileTypeEntry {
  type: string;
  count: number;
  total_bytes: number;
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316', '#64748b'];

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

export default function FileTypesPage() {
  usePageTitle('Types de fichiers');
  const [types, setTypes] = useState<FileTypeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalFiles, setTotalFiles] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const client = getClient(ServiceName.STORAGE);
      const res = await client.get<{ file_types: FileTypeEntry[]; total_files: number }>('/stats/file-types');
      setTypes(res.data.file_types ?? []);
      setTotalFiles(res.data.total_files ?? 0);
    } catch {
      // Try alternate: use search facets endpoint
      try {
        const client = getClient(ServiceName.STORAGE);
        const res = await client.get<{ facets: { file_types: { value: string; count: number }[] } }>('/search/facets');
        const facets = res.data?.facets?.file_types ?? [];
        setTypes(facets.map(f => ({ type: f.value, count: f.count, total_bytes: 0 })));
        setTotalFiles(facets.reduce((s, f) => s + f.count, 0));
      } catch {
        setTypes([]);
        toast.error('Endpoint de statistiques de types de fichiers indisponible');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const pieData = types.slice(0, 10).map(t => ({ name: t.type || 'unknown', value: t.count }));
  const totalBytes = types.reduce((s, t) => s + (t.total_bytes ?? 0), 0);

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileType className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">File Type Distribution</h1>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribution by Count</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">Loading…</div>
              ) : pieData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => typeof v === 'number' ? v.toLocaleString() : String(v ?? '')} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Breakdown Table</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-12 text-center text-muted-foreground">Loading…</div>
              ) : types.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">No data available</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Count</th>
                      {totalBytes > 0 && <th className="px-4 py-3 text-right font-medium text-muted-foreground">Size</th>}
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {types.map((t, i) => (
                      <tr key={t.type} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                            <Badge variant="outline" className="text-xs font-mono">{t.type || 'unknown'}</Badge>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">{t.count.toLocaleString()}</td>
                        {totalBytes > 0 && <td className="px-4 py-2 text-right text-muted-foreground">{fmtBytes(t.total_bytes)}</td>}
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {totalFiles > 0 ? `${((t.count / totalFiles) * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
