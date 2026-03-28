'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getClient, ServiceName } from '@/lib/api/factory';

interface EnvVar {
  key: string;
  value: string;
  source: string;
}

interface ServiceEnv {
  service: string;
  vars: EnvVar[];
  error?: string;
}

const SERVICES = [
  { name: 'identity', service: ServiceName.IDENTITY },
  { name: 'storage', service: ServiceName.STORAGE },
  { name: 'mail', service: ServiceName.MAIL },
  { name: 'scheduler', service: ServiceName.SCHEDULER },
  { name: 'ai', service: ServiceName.AI },
  { name: 'calendar', service: ServiceName.CALENDAR },
  { name: 'metrics', service: ServiceName.METRICS },
];

// Env keys that should be consistent across services
const SHARED_KEYS = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'RUST_LOG', 'CORS_ORIGIN'];

export default function EnvConfigPage() {
  const [data, setData] = useState<ServiceEnv[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEnvs = async () => {
    setLoading(true);
    const results: ServiceEnv[] = [];

    for (const svc of SERVICES) {
      try {
        const client = getClient(svc.service);
        const res = await client.get<{ env: EnvVar[] }>('/config/env');
        results.push({ service: svc.name, vars: res.data?.env || [] });
      } catch {
        results.push({ service: svc.name, vars: [], error: 'Indisponible' });
      }
    }

    setData(results);
    setLoading(false);
  };

  useEffect(() => { fetchEnvs(); }, []);

  // Diff: find inconsistencies in shared keys
  const diffs: { key: string; values: { service: string; value: string }[] }[] = [];
  for (const key of SHARED_KEYS) {
    const values: { service: string; value: string }[] = [];
    for (const svc of data) {
      const found = svc.vars.find(v => v.key === key);
      if (found) values.push({ service: svc.service, value: found.value });
    }
    const uniqueValues = new Set(values.map(v => v.value));
    if (uniqueValues.size > 1) {
      diffs.push({ key, values });
    }
  }

  return (
    <AppLayout>
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Configuration Env</h1>
              <p className="text-sm text-muted-foreground">Comparaison des variables d'environnement entre services</p>
            </div>
          </div>
          <Button variant="outline" onClick={fetchEnvs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Rafraîchir
          </Button>
        </div>

        {/* Diffs */}
        {diffs.length > 0 && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardHeader className="py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <CardTitle className="text-sm text-yellow-600">{diffs.length} incohérence{diffs.length > 1 ? 's' : ''} détectée{diffs.length > 1 ? 's' : ''}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {diffs.map((d) => (
                <div key={d.key} className="space-y-1">
                  <p className="text-sm font-mono font-medium">{d.key}</p>
                  {d.values.map((v) => (
                    <div key={v.service} className="flex items-center gap-2 text-xs ml-4">
                      <Badge variant="secondary" className="text-[10px]">{v.service}</Badge>
                      <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{v.value.slice(0, 40)}...</code>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {diffs.length === 0 && data.length > 0 && !loading && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Toutes les variables partagées sont cohérentes
          </div>
        )}

        {/* Per-service env */}
        {data.map((svc) => (
          <Card key={svc.service}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base capitalize">{svc.service}</CardTitle>
                {svc.error ? (
                  <Badge variant="destructive">{svc.error}</Badge>
                ) : (
                  <Badge variant="secondary">{svc.vars.length} vars</Badge>
                )}
              </div>
            </CardHeader>
            {svc.vars.length > 0 && (
              <CardContent className="pt-0">
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {svc.vars.map((v) => (
                    <div key={v.key} className="flex items-center gap-2 text-xs py-0.5">
                      <span className="font-mono font-medium w-48 shrink-0 truncate">{v.key}</span>
                      <span className="text-muted-foreground truncate">{v.value.length > 60 ? v.value.slice(0, 60) + '...' : v.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
