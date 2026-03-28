'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResourceGauge } from '@/components/dashboard/resource-gauge';
import { Cpu, MemoryStick, Database, Server } from 'lucide-react';
import { useDashboardData } from '@/hooks/use-dashboard';
import { useServiceHealth, ServiceHealth } from '@/hooks/use-service-health';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface SparklinePoint {
  time: string;
  value: number;
}

const MAX_SPARKLINE_POINTS = 10;

function MiniSparkline({ data, color, label }: { data: SparklinePoint[]; color: string; label: string }) {
  if (data.length < 2) return null;

  return (
    <div className="h-10 w-full mt-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '11px',
              padding: '4px 8px',
            }}
            formatter={(value) => [`${value}%`, label]}
            labelFormatter={(l) => l}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={`url(#gradient-${label})`}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WidgetSystemHealth() {
  const { data: dashboardData } = useDashboardData();
  const { data: services = [] } = useServiceHealth();

  const [cpuHistory, setCpuHistory] = useState<SparklinePoint[]>([]);
  const [memHistory, setMemHistory] = useState<SparklinePoint[]>([]);
  const prevCpuRef = useRef<number | null>(null);
  const prevMemRef = useRef<number | null>(null);

  // Accumulate data points as dashboard data updates (every ~30s)
  useEffect(() => {
    if (!dashboardData) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const cpuVal = dashboardData.cpu || 0;
    const memVal = dashboardData.memory || 0;

    // Only add a point when the value actually changes (new poll)
    if (cpuVal !== prevCpuRef.current || memVal !== prevMemRef.current) {
      prevCpuRef.current = cpuVal;
      prevMemRef.current = memVal;

      setCpuHistory((prev) =>
        [...prev, { time: timeStr, value: cpuVal }].slice(-MAX_SPARKLINE_POINTS)
      );
      setMemHistory((prev) =>
        [...prev, { time: timeStr, value: memVal }].slice(-MAX_SPARKLINE_POINTS)
      );
    }
  }, [dashboardData]);

  const onlineCount = services.filter((s) => s.status === 'online').length;
  const totalCount = services.length;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          System Health
        </CardTitle>
        <Badge variant="outline" className="gap-1">
          <div className={`h-2 w-2 rounded-full ${onlineCount === totalCount ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
          {onlineCount}/{totalCount} Online
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Cpu className="h-4 w-4" />
              CPU Usage
            </div>
            <ResourceGauge label="" value={dashboardData?.cpu || 0} showLabel={false} />
            <p className="text-2xl font-bold">{dashboardData?.cpu || 0}%</p>
            <MiniSparkline data={cpuHistory} color="#3b82f6" label="CPU" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MemoryStick className="h-4 w-4" />
              Memory
            </div>
            <ResourceGauge label="" value={dashboardData?.memory || 0} showLabel={false} />
            <p className="text-2xl font-bold">{dashboardData?.memory || 0}%</p>
            <MiniSparkline data={memHistory} color="#a855f7" label="Memory" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Database className="h-4 w-4" />
              Disk
            </div>
            <ResourceGauge label="" value={dashboardData?.disk || 0} showLabel={false} />
            <p className="text-2xl font-bold">{dashboardData?.disk || 0}%</p>
          </div>
        </div>

        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-3">Services Status</h4>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-3">
            {services.map((service: ServiceHealth) => (
              <div
                key={service.name}
                className="flex items-center justify-between rounded-lg border p-2"
              >
                <span className="text-sm">{service.name}</span>
                <div className="flex items-center gap-1">
                  <div className={`h-2 w-2 rounded-full ${service.status === 'online' ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                  <span className="text-xs text-muted-foreground">:{service.port}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
