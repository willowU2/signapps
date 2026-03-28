'use client';

import { SpinnerInfinity } from 'spinners-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Wifi,
  WifiOff,
  PlugZap,
  Globe,
  ShieldCheck,
  Activity,
  ArrowDownUp,
  Copy,
  Plus,
} from 'lucide-react';
import { Tunnel, TunnelDashboardStats, TrafficDataPoint } from '@/lib/api';

// Utility functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function TrafficChart({ data }: { data: TrafficDataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No traffic data available
      </div>
    );
  }

  const maxValue = Math.max(
    ...data.map(d => Math.max(d.bytes_in, d.bytes_out)),
    1,
  );

  const width = 100;
  const height = 100;
  const padding = 10;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const inPath = data.map((point, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = height - padding - (point.bytes_in / maxValue) * chartHeight;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const outPath = data.map((point, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = height - padding - (point.bytes_out / maxValue) * chartHeight;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding}
        stroke="currentColor" strokeOpacity={0.1} />
      <line x1={padding} y1={padding + chartHeight / 2} x2={width - padding} y2={padding + chartHeight / 2}
        stroke="currentColor" strokeOpacity={0.1} strokeDasharray="2,2" />
      <path d={inPath} fill="none" stroke="#22c55e" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" />
      <path d={outPath} fill="none" stroke="#3b82f6" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface VpnDashboardTabProps {
  dashboardStats: TunnelDashboardStats | null;
  trafficData: TrafficDataPoint[];
  tunnels: Tunnel[];
  quickTunnel: Tunnel | null;
  quickConnectAddr: string;
  quickConnecting: boolean;
  onQuickConnectAddrChange: (addr: string) => void;
  onQuickConnect: () => void;
  onDisconnectQuick: () => void;
  onCopyPublicUrl: (url: string) => void;
  onNavigateToTunnels: () => void;
  onOpenTunnelDialog: () => void;
}

export function VpnDashboardTab({
  dashboardStats,
  trafficData,
  tunnels,
  quickTunnel,
  quickConnectAddr,
  quickConnecting,
  onQuickConnectAddrChange,
  onQuickConnect,
  onDisconnectQuick,
  onCopyPublicUrl,
  onNavigateToTunnels,
  onOpenTunnelDialog,
}: VpnDashboardTabProps) {
  return (
    <div className="space-y-4">
      {/* Quick Connect */}
      <Card className="border-green-200 dark:border-green-900">
        <CardContent className="flex items-center gap-4 p-6">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full ${
            quickTunnel ? 'bg-green-500/20' : 'bg-muted'
          }`}>
            {quickTunnel ? (
              <Wifi className="h-8 w-8 text-green-500" />
            ) : (
              <WifiOff className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="font-semibold text-lg">Quick Connect</h3>
            {quickTunnel ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/10 text-green-600">Connecté</Badge>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {quickTunnel.subdomain}.relay
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onCopyPublicUrl(quickTunnel.public_url || quickTunnel.subdomain)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {quickTunnel.local_addr} exposed via relay
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="localhost:3000"
                  value={quickConnectAddr}
                  onChange={(e) => onQuickConnectAddrChange(e.target.value)}
                  className="w-48 h-8"
                />
              </div>
            )}
          </div>
          <div>
            {quickTunnel ? (
              <Button variant="destructive" onClick={onDisconnectQuick}>
                Disconnect
              </Button>
            ) : (
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={onQuickConnect}
                disabled={quickConnecting}
              >
                {quickConnecting && (
                  <SpinnerInfinity
                    size={24}
                    secondaryColor="rgba(128,128,128,0.2)"
                    color="currentColor"
                    speed={120}
                    className="mr-2 h-4 w-4"
                  />
                )}
                Quick Connect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <PlugZap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tunnels</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold">
                  {dashboardStats?.tunnels_active || 0}
                </p>
                <span className="text-sm text-muted-foreground">
                  / {dashboardStats?.tunnels_total || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${
              dashboardStats?.relay_status === 'connected' ? 'bg-green-500/10' :
              dashboardStats?.relay_status === 'partial' ? 'bg-yellow-500/10' : 'bg-red-500/10'
            }`}>
              {dashboardStats?.relay_status === 'connected' ? (
                <Wifi className="h-6 w-6 text-green-500" />
              ) : dashboardStats?.relay_status === 'partial' ? (
                <Activity className="h-6 w-6 text-yellow-500" />
              ) : (
                <WifiOff className="h-6 w-6 text-red-500" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Relay Status</p>
              <p className="text-2xl font-bold capitalize">
                {dashboardStats?.relay_status || 'Unknown'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
              <Globe className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">DNS Queries</p>
              <p className="text-2xl font-bold">
                {formatNumber(dashboardStats?.dns_queries_today || 0)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
              <ShieldCheck className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ads Blocked</p>
              <p className="text-2xl font-bold">
                {formatNumber(dashboardStats?.ads_blocked_today || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tunnel Status</CardTitle>
          </CardHeader>
          <CardContent>
            {tunnels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <PlugZap className="mx-auto h-12 w-12 opacity-30 mb-2" />
                <p>No tunnels configured</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    onNavigateToTunnels();
                    onOpenTunnelDialog();
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Tunnel
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {tunnels.map((tunnel) => (
                  <div
                    key={tunnel.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${
                        tunnel.status === 'connected' ? 'bg-green-500' :
                        tunnel.status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                        tunnel.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                      }`} />
                      <div>
                        <p className="font-medium">{tunnel.name}</p>
                        <p className="text-xs text-muted-foreground">{tunnel.local_addr}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCopyPublicUrl(tunnel.public_url)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Traffic (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowDownUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Incoming</span>
                </div>
                <span className="font-mono font-medium">
                  {formatBytes(dashboardStats?.bytes_in_today || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowDownUp className="h-4 w-4 text-blue-500 rotate-180" />
                  <span className="text-sm">Outgoing</span>
                </div>
                <span className="font-mono font-medium">
                  {formatBytes(dashboardStats?.bytes_out_today || 0)}
                </span>
              </div>
              {trafficData.length > 0 && (
                <div className="h-32 mt-4">
                  <TrafficChart data={trafficData} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
