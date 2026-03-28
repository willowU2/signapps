'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Lock, Shield, Activity } from 'lucide-react';
import Link from 'next/link';
import { useProxyStatus } from '@/hooks/use-proxy-status';
import { useRoutes } from '@/hooks/use-routes';

export function WidgetProxyStatus() {
  const { data: proxyStatus } = useProxyStatus();
  const { data: routes = [] } = useRoutes();

  const activeRoutes = routes.filter((r) => r.enabled).length;
  const tlsRoutes = routes.filter((r) => r.tls_enabled).length;
  const shieldedRoutes = routes.filter((r) => r.shield_config?.enabled).length;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4" />
          Reverse Proxy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Listeners */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">HTTP</span>
              <Badge
                variant={proxyStatus?.http_listener.active ? 'default' : 'secondary'}
                className="text-[10px] px-1.5 py-0"
              >
                {proxyStatus?.http_listener.active ? 'Active' : 'Off'}
              </Badge>
            </div>
            <p className="text-lg font-semibold">
              :{proxyStatus?.http_listener.port || 80}
            </p>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">HTTPS</span>
              <Badge
                variant={proxyStatus?.https_listener.active ? 'default' : 'secondary'}
                className="text-[10px] px-1.5 py-0"
              >
                {proxyStatus?.https_listener.active ? 'Active' : 'Off'}
              </Badge>
            </div>
            <p className="text-lg font-semibold">
              :{proxyStatus?.https_listener.port || 443}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
          <Link href="/routes" className="rounded-lg border p-2 hover:border-primary/50 transition-colors">
            <p className="text-lg font-bold">{activeRoutes}</p>
            <p className="text-[10px] text-muted-foreground">Routes</p>
          </Link>
          <div className="rounded-lg border p-2">
            <div className="flex items-center justify-center gap-1">
              <Lock className="h-3 w-3 text-green-500" />
              <p className="text-lg font-bold">{proxyStatus?.certificates_loaded ?? tlsRoutes}</p>
            </div>
            <p className="text-[10px] text-muted-foreground">Certs</p>
          </div>
          <div className="rounded-lg border p-2">
            <div className="flex items-center justify-center gap-1">
              <Shield className="h-3 w-3 text-orange-500" />
              <p className="text-lg font-bold">{shieldedRoutes}</p>
            </div>
            <p className="text-[10px] text-muted-foreground">Shield</p>
          </div>
        </div>

        {/* Requests */}
        {proxyStatus && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {proxyStatus.requests_total.toLocaleString()} requests
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
