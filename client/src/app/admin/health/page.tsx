'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { ServiceName } from '@/lib/api/factory';
import { HealthThresholdsPanel } from '@/components/admin/health-thresholds-panel';
import { usePageTitle } from '@/hooks/use-page-title';

// ─── Service registry ─────────────────────────────────────────────────────────

interface ServiceEntry {
  name: string;
  label: string;
  port: number;
  healthPath: string;
}

const ALL_SERVICES: ServiceEntry[] = [
  { name: ServiceName.IDENTITY,   label: 'Identity',    port: 3001, healthPath: '/health' },
  { name: ServiceName.CONTAINERS, label: 'Containers',  port: 3002, healthPath: '/health' },
  { name: ServiceName.PROXY,      label: 'Proxy',       port: 3003, healthPath: '/health' },
  { name: ServiceName.STORAGE,    label: 'Storage',     port: 3004, healthPath: '/health' },
  { name: ServiceName.AI,         label: 'AI',          port: 3005, healthPath: '/health' },
  { name: ServiceName.SECURELINK, label: 'SecureLink',  port: 3006, healthPath: '/health' },
  { name: ServiceName.SCHEDULER,  label: 'Scheduler',   port: 3007, healthPath: '/health' },
  { name: ServiceName.METRICS,    label: 'Metrics',     port: 3008, healthPath: '/health' },
  { name: ServiceName.MEDIA,      label: 'Media',       port: 3009, healthPath: '/health' },
  { name: ServiceName.DOCS,       label: 'Docs',        port: 3010, healthPath: '/health' },
  { name: ServiceName.CALENDAR,   label: 'Calendar',    port: 3011, healthPath: '/health' },
  { name: ServiceName.MAIL,       label: 'Mail',        port: 3012, healthPath: '/health' },
  { name: ServiceName.COLLAB,     label: 'Collab',      port: 3013, healthPath: '/health' },
  { name: ServiceName.MEET,       label: 'Meet',        port: 3014, healthPath: '/health' },
  { name: ServiceName.FORMS,      label: 'Forms',       port: 3015, healthPath: '/health' },
  { name: ServiceName.PXE,        label: 'PXE',         port: 3016, healthPath: '/health' },
  { name: ServiceName.REMOTE,     label: 'Remote',      port: 3017, healthPath: '/health' },
  { name: ServiceName.OFFICE,     label: 'Office',      port: 3018, healthPath: '/health' },
  { name: ServiceName.WORKFORCE,  label: 'Workforce',   port: 3019, healthPath: '/health' },
  { name: ServiceName.CHAT,       label: 'Chat',        port: 3020, healthPath: '/health' },
  { name: ServiceName.CONTACTS,   label: 'Contacts',    port: 3021, healthPath: '/health' },
  { name: ServiceName.IT_ASSETS,  label: 'IT Assets',   port: 3022, healthPath: '/health' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type HealthStatus = 'healthy' | 'unhealthy' | 'pending';

interface ServiceHealthResult {
  name: string;
  label: string;
  port: number;
  status: HealthStatus;
  responseTime?: number;
  checkedAt?: Date;
}

// ─── Health check helper ──────────────────────────────────────────────────────

const TIMEOUT_MS = 4000;

async function checkServiceHealth(svc: ServiceEntry): Promise<ServiceHealthResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = performance.now();

  try {
    const res = await fetch(`http://localhost:${svc.port}${svc.healthPath}`, {
      signal: controller.signal,
      // no-cors lets us detect reachability even without CORS headers
      mode: 'no-cors',
    });
    const responseTime = Math.round(performance.now() - start);
    // Opaque response (no-cors) means the service responded — treat as healthy.
    const healthy = res.type === 'opaque' || res.ok;
    return {
      ...svc,
      status: healthy ? 'healthy' : 'unhealthy',
      responseTime,
      checkedAt: new Date(),
    };
  } catch {
    return {
      ...svc,
      status: 'unhealthy',
      responseTime: undefined,
      checkedAt: new Date(),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Service card ─────────────────────────────────────────────────────────────

function ServiceCard({ result }: { result: ServiceHealthResult }) {
  const isPending = result.status === 'pending';
  const isHealthy = result.status === 'healthy';

  return (
    <Card className={`transition-colors ${isHealthy ? 'border-green-500/30' : isPending ? '' : 'border-red-500/30'}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold truncate">{result.label}</CardTitle>
          {isPending ? (
            <div className="h-3 w-3 rounded-full bg-muted-foreground/30 animate-pulse" />
          ) : isHealthy ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-red-500" />
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Port {result.port}</span>
          {result.responseTime !== undefined && (
            <span>{result.responseTime} ms</span>
          )}
        </div>
        <Badge
          variant={isPending ? 'outline' : isHealthy ? 'default' : 'destructive'}
          className={`text-[10px] px-1.5 py-0 ${isHealthy ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30' : ''}`}
        >
          {isPending ? 'Checking…' : isHealthy ? 'Online' : 'Offline'}
        </Badge>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 30_000;

export default function HealthPage() {
  usePageTitle('Sante systeme');
  const [results, setResults] = useState<ServiceHealthResult[]>(() =>
    ALL_SERVICES.map((svc) => ({ ...svc, status: 'pending' as HealthStatus }))
  );
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const runChecks = useCallback(async () => {
    setRefreshing(true);
    // Reset all to pending first for visual feedback
    setResults(ALL_SERVICES.map((svc) => ({ ...svc, status: 'pending' as HealthStatus })));

    const checks = await Promise.all(ALL_SERVICES.map(checkServiceHealth));
    setResults(checks);
    setLastRefresh(new Date());
    setRefreshing(false);
  }, []);

  // Initial check + auto-refresh every 30 s
  useEffect(() => {
    runChecks();
    const interval = setInterval(runChecks, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [runChecks]);

  const healthyCount = results.filter((r) => r.status === 'healthy').length;
  const totalCount = ALL_SERVICES.length;
  const allHealthy = healthyCount === totalCount;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Activity className="h-7 w-7" />
              Service Health
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live status for all SignApps backend services — auto-refreshes every 30 seconds
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {lastRefresh && (
              <span className="text-xs text-muted-foreground">
                Last checked: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <HealthThresholdsPanel />
            <Button
              variant="outline"
              size="sm"
              onClick={runChecks}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary banner */}
        <div className={`rounded-xl border px-5 py-4 flex items-center justify-between ${
          allHealthy
            ? 'bg-green-500/5 border-green-500/30'
            : 'bg-red-500/5 border-red-500/30'
        }`}>
          <div className="flex items-center gap-3">
            {allHealthy ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <div>
              <p className="text-sm font-semibold">
                {allHealthy ? 'All services operational' : `${totalCount - healthyCount} service(s) degraded`}
              </p>
              <p className="text-xs text-muted-foreground">
                {healthyCount} / {totalCount} healthy
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-sm px-3 py-1 font-semibold ${
              allHealthy
                ? 'border-green-500/50 text-green-700 dark:text-green-400'
                : 'border-red-500/50 text-red-700 dark:text-red-400'
            }`}
          >
            {healthyCount}/{totalCount}
          </Badge>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {results.map((result) => (
            <ServiceCard key={result.name} result={result} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
