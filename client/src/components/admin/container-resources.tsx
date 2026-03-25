'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Server, Cpu, HardDrive } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { containersApi, type ContainerInfo, type ContainerStats } from '@/lib/api/containers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContainerResource {
  name: string;
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
  memory_percent: number;
  net_rx: number;
  net_tx: number;
  state: string;
}

interface HistoryPoint {
  time: string;
  [container: string]: string | number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContainerResources() {
  const [resources, setResources] = useState<ContainerResource[]>([]);
  const [cpuHistory, setCpuHistory] = useState<HistoryPoint[]>([]);
  const [memHistory, setMemHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const historyRef = useRef<{ cpu: HistoryPoint[]; mem: HistoryPoint[] }>({ cpu: [], mem: [] });

  const fetchData = useCallback(async () => {
    try {
      const res = await containersApi.list(true);
      const containers: ContainerInfo[] = res.data || [];
      const running = containers.filter((c) => c.state === 'running');

      const stats: ContainerResource[] = [];
      for (const c of running.slice(0, 20)) {
        try {
          const sr = await containersApi.stats(c.id);
          const s: ContainerStats = sr.data;
          stats.push({
            name: c.name.replace(/^\//, '').slice(0, 20),
            cpu_percent: s.cpu_percent || 0,
            memory_usage: s.memory_usage || 0,
            memory_limit: s.memory_limit || 0,
            memory_percent: s.memory_percent || 0,
            net_rx: s.net_rx || 0,
            net_tx: s.net_tx || 0,
            state: c.state,
          });
        } catch {
          // container may have stopped
        }
      }

      setResources(stats);

      // Build history point
      const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const cpuPoint: HistoryPoint = { time };
      const memPoint: HistoryPoint = { time };
      for (const s of stats) {
        cpuPoint[s.name] = Math.round(s.cpu_percent * 100) / 100;
        memPoint[s.name] = Math.round(s.memory_percent * 100) / 100;
      }

      historyRef.current.cpu = [...historyRef.current.cpu, cpuPoint].slice(-30);
      historyRef.current.mem = [...historyRef.current.mem, memPoint].slice(-30);
      setCpuHistory([...historyRef.current.cpu]);
      setMemHistory([...historyRef.current.mem]);
    } catch {
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const containerNames = resources.map((r) => r.name);
  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#f97316'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">Container Resources</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{resources.length} containers</Badge>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Current usage bar charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* CPU Bar */}
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">CPU Usage (%)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {resources.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                {loading ? 'Loading...' : 'No running containers'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={resources} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Bar dataKey="cpu_percent" fill="#3b82f6" name="CPU %" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Memory Bar */}
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Memory Usage (%)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {resources.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                {loading ? 'Loading...' : 'No running containers'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={resources} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip
                    formatter={(v: number, name: string, props: any) =>
                      `${v.toFixed(1)}% (${formatBytes(props.payload.memory_usage)})`
                    }
                  />
                  <Bar dataKey="memory_percent" fill="#22c55e" name="Memory %" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CPU History */}
      {cpuHistory.length > 1 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">CPU Usage Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={cpuHistory}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                {containerNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={1.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Memory History */}
      {memHistory.length > 1 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Memory Usage Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={memHistory}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                {containerNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={1.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Detailed Table */}
      {resources.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Detailed Stats</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Container</th>
                  <th className="text-right px-4 py-2 font-medium">CPU %</th>
                  <th className="text-right px-4 py-2 font-medium">Memory</th>
                  <th className="text-right px-4 py-2 font-medium">Mem %</th>
                  <th className="text-right px-4 py-2 font-medium">Net RX</th>
                  <th className="text-right px-4 py-2 font-medium">Net TX</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {resources.map((r) => (
                  <tr key={r.name} className="hover:bg-accent/40">
                    <td className="px-4 py-2 font-medium">{r.name}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{r.cpu_percent.toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {formatBytes(r.memory_usage)} / {formatBytes(r.memory_limit)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{r.memory_percent.toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{formatBytes(r.net_rx)}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{formatBytes(r.net_tx)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
