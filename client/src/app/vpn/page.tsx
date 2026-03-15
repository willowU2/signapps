'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CardGridSkeleton } from '@/components/ui/skeleton-loader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Wifi,
  WifiOff,
  Shield,
  MoreVertical,
  Trash2,
  CheckCircle,
  RefreshCw,
  Loader2,
  Copy,
  Globe,
  Radio,
  Activity,
  ArrowDownUp,
  ExternalLink,
  Pencil,
  PlugZap,
  ShieldCheck,
  Ban,
  CircleDot,
  X,
  Gauge,
} from 'lucide-react';
import {
  tunnelApi,
  Tunnel,
  Relay,
  DnsConfig,
  DnsStats,
  Blocklist,
  CustomDnsRecord,
  TunnelDashboardStats,
  TrafficDataPoint,
} from '@/lib/api';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

// Utility function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Utility function to format number with comma separators
function formatNumber(num: number): string {
  return num.toLocaleString();
}

export default function VpnPage() {
  // Dashboard state
  const [dashboardStats, setDashboardStats] = useState<TunnelDashboardStats | null>(null);
  const [trafficData, setTrafficData] = useState<TrafficDataPoint[]>([]);

  // Tunnels state
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [tunnelDialogOpen, setTunnelDialogOpen] = useState(false);
  const [editingTunnel, setEditingTunnel] = useState<Tunnel | null>(null);
  const [tunnelForm, setTunnelForm] = useState({
    name: '',
    local_addr: 'localhost:',
    subdomain: '',
    relay_id: '',
  });

  // Relays state
  const [relays, setRelays] = useState<Relay[]>([]);
  const [relayDialogOpen, setRelayDialogOpen] = useState(false);
  const [editingRelay, setEditingRelay] = useState<Relay | null>(null);
  const [relayForm, setRelayForm] = useState({
    name: '',
    url: 'wss://',
    token: '',
    is_primary: false,
  });

  // DNS state
  const [dnsConfig, setDnsConfig] = useState<DnsConfig | null>(null);
  const [dnsStats, setDnsStats] = useState<DnsStats | null>(null);
  const [blocklistDialogOpen, setBlocklistDialogOpen] = useState(false);
  const [blocklistForm, setBlocklistForm] = useState({ name: '', url: '' });
  const [dnsRecordDialogOpen, setDnsRecordDialogOpen] = useState(false);
  const [editingDnsRecord, setEditingDnsRecord] = useState<CustomDnsRecord | null>(null);
  const [dnsRecordForm, setDnsRecordForm] = useState<CustomDnsRecord>({
    type: 'A',
    name: '',
    value: '',
    ttl: 3600,
  });
  const [upstreamInput, setUpstreamInput] = useState('');

  // General state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [quickConnecting, setQuickConnecting] = useState(false);
  const [quickConnectAddr, setQuickConnectAddr] = useState('localhost:3000');
  const [quickTunnel, setQuickTunnel] = useState<Tunnel | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: 'tunnel' | 'relay' | 'blocklist' | 'dns-record';
    item: Tunnel | Relay | Blocklist | CustomDnsRecord | null;
  }>({ open: false, type: 'tunnel', item: null });

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        dashboardRes,
        trafficRes,
        tunnelsRes,
        relaysRes,
        dnsConfigRes,
        dnsStatsRes,
      ] = await Promise.allSettled([
        tunnelApi.getDashboardStats(),
        tunnelApi.getTrafficHistory('24h'),
        tunnelApi.listTunnels(),
        tunnelApi.listRelays(),
        tunnelApi.getDnsConfig(),
        tunnelApi.getDnsStats(),
      ]);

      if (dashboardRes.status === 'fulfilled') {
        setDashboardStats(dashboardRes.value.data);
      }
      if (trafficRes.status === 'fulfilled') {
        setTrafficData(trafficRes.value.data || []);
      }
      if (tunnelsRes.status === 'fulfilled') {
        const tunnelData = tunnelsRes.value.data;
        setTunnels(Array.isArray(tunnelData) ? tunnelData : tunnelData?.tunnels || []);
      }
      if (relaysRes.status === 'fulfilled') {
        const relayData = relaysRes.value.data;
        setRelays(Array.isArray(relayData) ? relayData : relayData?.relays || []);
      }
      if (dnsConfigRes.status === 'fulfilled') {
        setDnsConfig(dnsConfigRes.value.data);
      }
      if (dnsStatsRes.status === 'fulfilled') {
        setDnsStats(dnsStatsRes.value.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Primary relay for selection
  const primaryRelay = useMemo(() => relays.find(r => r.is_primary), [relays]);

  // Tunnel handlers
  const handleOpenTunnelDialog = (tunnel?: Tunnel) => {
    if (tunnel) {
      setEditingTunnel(tunnel);
      setTunnelForm({
        name: tunnel.name,
        local_addr: tunnel.local_addr,
        subdomain: tunnel.subdomain,
        relay_id: tunnel.relay_id,
      });
    } else {
      setEditingTunnel(null);
      setTunnelForm({
        name: '',
        local_addr: 'localhost:',
        subdomain: '',
        relay_id: primaryRelay?.id || '',
      });
    }
    setTunnelDialogOpen(true);
  };

  const handleSaveTunnel = async () => {
    if (!tunnelForm.name.trim() || !tunnelForm.local_addr.trim() || !tunnelForm.subdomain.trim()) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      if (editingTunnel) {
        await tunnelApi.updateTunnel(editingTunnel.id, tunnelForm);
        toast.success('Tunnel updated');
      } else {
        await tunnelApi.createTunnel(tunnelForm);
        toast.success('Tunnel created');
      }
      setTunnelDialogOpen(false);
      fetchData();
    } catch {
      toast.error('Failed to save tunnel');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReconnectTunnel = async (tunnel: Tunnel) => {
    try {
      await tunnelApi.reconnectTunnel(tunnel.id);
      toast.success('Reconnecting tunnel...');
      setTimeout(fetchData, 2000);
    } catch {
      toast.error('Failed to reconnect tunnel');
    }
  };

  const copyPublicUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  // Relay handlers
  const handleOpenRelayDialog = (relay?: Relay) => {
    if (relay) {
      setEditingRelay(relay);
      setRelayForm({
        name: relay.name,
        url: relay.url,
        token: '',
        is_primary: relay.is_primary,
      });
    } else {
      setEditingRelay(null);
      setRelayForm({
        name: '',
        url: 'wss://',
        token: '',
        is_primary: relays.length === 0,
      });
    }
    setRelayDialogOpen(true);
  };

  const handleSaveRelay = async () => {
    if (!relayForm.name.trim() || !relayForm.url.trim()) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      if (editingRelay) {
        await tunnelApi.updateRelay(editingRelay.id, relayForm);
        toast.success('Relay updated');
      } else {
        await tunnelApi.addRelay(relayForm);
        toast.success('Relay added');
      }
      setRelayDialogOpen(false);
      fetchData();
    } catch {
      toast.error('Failed to save relay');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestRelay = async (relay: Relay) => {
    try {
      const result = await tunnelApi.testRelay(relay.id);
      if (result.data.success) {
        toast.success(`Relay is reachable (${result.data.latency_ms}ms)`);
      } else {
        toast.error(`Relay test failed: ${result.data.error}`);
      }
    } catch {
      toast.error('Failed to test relay');
    }
  };

  const handleSetPrimaryRelay = async (relay: Relay) => {
    try {
      await tunnelApi.setPrimaryRelay(relay.id);
      toast.success('Primary relay updated');
      fetchData();
    } catch {
      toast.error('Failed to set primary relay');
    }
  };

  // DNS handlers
  const handleToggleDns = async (enabled: boolean) => {
    try {
      await tunnelApi.updateDnsConfig({ enabled });
      setDnsConfig(prev => prev ? { ...prev, enabled } : null);
      toast.success(enabled ? 'DNS enabled' : 'DNS disabled');
    } catch {
      toast.error('Failed to update DNS settings');
    }
  };

  const handleToggleAdblock = async (enabled: boolean) => {
    try {
      await tunnelApi.updateDnsConfig({ adblock_enabled: enabled });
      setDnsConfig(prev => prev ? { ...prev, adblock_enabled: enabled } : null);
      toast.success(enabled ? 'Ad blocking enabled' : 'Ad blocking disabled');
    } catch {
      toast.error('Failed to update ad blocking settings');
    }
  };

  const handleAddUpstream = async () => {
    if (!upstreamInput.trim()) return;
    const newUpstream = [...(dnsConfig?.upstream || []), upstreamInput.trim()];
    try {
      await tunnelApi.updateDnsConfig({ upstream: newUpstream });
      setDnsConfig(prev => prev ? { ...prev, upstream: newUpstream } : null);
      setUpstreamInput('');
      toast.success('Upstream DNS added');
    } catch {
      toast.error('Failed to add upstream DNS');
    }
  };

  const handleRemoveUpstream = async (dns: string) => {
    const newUpstream = (dnsConfig?.upstream || []).filter(u => u !== dns);
    try {
      await tunnelApi.updateDnsConfig({ upstream: newUpstream });
      setDnsConfig(prev => prev ? { ...prev, upstream: newUpstream } : null);
      toast.success('Upstream DNS removed');
    } catch {
      toast.error('Failed to remove upstream DNS');
    }
  };

  const handleAddBlocklist = async () => {
    if (!blocklistForm.name.trim() || !blocklistForm.url.trim()) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await tunnelApi.addBlocklist({ ...blocklistForm, enabled: true });
      toast.success('Blocklist added');
      setBlocklistDialogOpen(false);
      setBlocklistForm({ name: '', url: '' });
      fetchData();
    } catch {
      toast.error('Failed to add blocklist');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleBlocklist = async (blocklist: Blocklist) => {
    try {
      await tunnelApi.toggleBlocklist(blocklist.id, !blocklist.enabled);
      setDnsConfig(prev => {
        if (!prev) return null;
        return {
          ...prev,
          blocklists: prev.blocklists.map(b =>
            b.id === blocklist.id ? { ...b, enabled: !b.enabled } : b
          ),
        };
      });
      toast.success(blocklist.enabled ? 'Blocklist disabled' : 'Blocklist enabled');
    } catch {
      toast.error('Failed to toggle blocklist');
    }
  };

  const handleOpenDnsRecordDialog = (record?: CustomDnsRecord) => {
    if (record) {
      setEditingDnsRecord(record);
      setDnsRecordForm({ ...record });
    } else {
      setEditingDnsRecord(null);
      setDnsRecordForm({ type: 'A', name: '', value: '', ttl: 3600 });
    }
    setDnsRecordDialogOpen(true);
  };

  const handleSaveDnsRecord = async () => {
    if (!dnsRecordForm.name.trim() || !dnsRecordForm.value.trim()) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      if (editingDnsRecord?.id) {
        await tunnelApi.updateDnsRecord(editingDnsRecord.id, dnsRecordForm);
        toast.success('DNS record updated');
      } else {
        await tunnelApi.addDnsRecord(dnsRecordForm);
        toast.success('DNS record added');
      }
      setDnsRecordDialogOpen(false);
      fetchData();
    } catch {
      toast.error('Failed to save DNS record');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deleteDialog.item) return;

    try {
      switch (deleteDialog.type) {
        case 'tunnel':
          await tunnelApi.deleteTunnel((deleteDialog.item as Tunnel).id);
          toast.success('Tunnel deleted');
          break;
        case 'relay':
          await tunnelApi.deleteRelay((deleteDialog.item as Relay).id);
          toast.success('Relay deleted');
          break;
        case 'blocklist':
          await tunnelApi.removeBlocklist((deleteDialog.item as Blocklist).id);
          toast.success('Blocklist removed');
          break;
        case 'dns-record':
          await tunnelApi.deleteDnsRecord((deleteDialog.item as CustomDnsRecord).id!);
          toast.success('DNS record deleted');
          break;
      }
      setDeleteDialog({ open: false, type: 'tunnel', item: null });
      fetchData();
    } catch {
      toast.error('Failed to delete');
    }
  };

  // Status badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-600" variant="outline">
            <CircleDot className="mr-1 h-3 w-3" />
            Connected
          </Badge>
        );
      case 'connecting':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-600" variant="outline">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Connecting
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge variant="secondary">
            <WifiOff className="mr-1 h-3 w-3" />
            Disconnected
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <Ban className="mr-1 h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleQuickConnect = async () => {
    setQuickConnecting(true);
    try {
      const result = await tunnelApi.quickConnect({ local_addr: quickConnectAddr });
      setQuickTunnel(result.data);
      toast.success('Quick tunnel created!');
      fetchData();
    } catch {
      toast.error('Quick connect failed. Make sure a relay is configured.');
    } finally {
      setQuickConnecting(false);
    }
  };

  const handleDisconnectQuick = async () => {
    if (quickTunnel) {
      try {
        await tunnelApi.deleteTunnel(quickTunnel.id);
        setQuickTunnel(null);
        toast.success('Tunnel disconnected');
        fetchData();
      } catch {
        toast.error('Failed to disconnect tunnel');
      }
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Web Tunnels</h1>
          <CardGridSkeleton count={4} className="md:grid-cols-4" />
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Web Tunnels</h1>
            <p className="text-muted-foreground">
              Expose your local services securely without opening ports
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard">
              <Gauge className="mr-2 h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="tunnels">
              <PlugZap className="mr-2 h-4 w-4" />
              Tunnels
            </TabsTrigger>
            <TabsTrigger value="relays">
              <Radio className="mr-2 h-4 w-4" />
              Relays
            </TabsTrigger>
            <TabsTrigger value="dns">
              <Shield className="mr-2 h-4 w-4" />
              DNS & Blocking
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4">
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
                        <Badge className="bg-green-500/10 text-green-600">Connected</Badge>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {quickTunnel.subdomain}.relay
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyPublicUrl(quickTunnel.public_url || quickTunnel.subdomain)}
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
                        onChange={(e) => setQuickConnectAddr(e.target.value)}
                        className="w-48 h-8"
                      />
                    </div>
                  )}
                </div>
                <div>
                  {quickTunnel ? (
                    <Button
                      variant="destructive"
                      onClick={handleDisconnectQuick}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleQuickConnect}
                      disabled={quickConnecting}
                    >
                      {quickConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                          setActiveTab('tunnels');
                          handleOpenTunnelDialog();
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
                            onClick={() => copyPublicUrl(tunnel.public_url)}
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
          </TabsContent>

          {/* Tunnels Tab */}
          <TabsContent value="tunnels" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => handleOpenTunnelDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                New Tunnel
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Configured Tunnels</CardTitle>
                <CardDescription>
                  Tunnels expose your local services via a public URL
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Local Service</TableHead>
                      <TableHead>Public URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Traffic</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tunnels.map((tunnel) => (
                      <TableRow key={tunnel.id}>
                        <TableCell>
                          <div className="font-medium">{tunnel.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Relay: {tunnel.relay_name || 'Default'}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {tunnel.local_addr}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {tunnel.public_url}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyPublicUrl(tunnel.public_url)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => window.open(tunnel.public_url, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(tunnel.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex flex-col">
                            <span>In: {formatBytes(tunnel.bytes_in)}</span>
                            <span>Out: {formatBytes(tunnel.bytes_out)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenTunnelDialog(tunnel)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReconnectTunnel(tunnel)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Reconnect
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteDialog({ open: true, type: 'tunnel', item: tunnel })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {tunnels.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No tunnels configured. Click &quot;New Tunnel&quot; to create one.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Relays Tab */}
          <TabsContent value="relays" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => handleOpenRelayDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Relay
              </Button>
            </div>

            {/* Explanation Card */}
            <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
              <CardContent className="flex items-start gap-4 p-4">
                <Radio className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">What is a Relay?</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    A relay is a server on the internet that acts as a bridge between your local services
                    and the outside world. It receives incoming connections and forwards them through
                    your tunnel, without requiring you to open any ports on your router or firewall.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configured Relays</CardTitle>
                <CardDescription>
                  Relay servers that handle your tunnel connections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tunnels</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relays.map((relay) => (
                      <TableRow key={relay.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{relay.name}</span>
                            {relay.is_primary && (
                              <Badge variant="outline" className="text-xs">Primary</Badge>
                            )}
                          </div>
                          {relay.region && (
                            <div className="text-xs text-muted-foreground">{relay.region}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{relay.url}</TableCell>
                        <TableCell>{getStatusBadge(relay.status)}</TableCell>
                        <TableCell>{relay.tunnels_count}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {relay.latency_ms ? `${relay.latency_ms}ms` : '-'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenRelayDialog(relay)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleTestRelay(relay)}>
                                <Activity className="mr-2 h-4 w-4" />
                                Test Connection
                              </DropdownMenuItem>
                              {!relay.is_primary && (
                                <DropdownMenuItem onClick={() => handleSetPrimaryRelay(relay)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Set as Primary
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteDialog({ open: true, type: 'relay', item: relay })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {relays.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No relays configured. Add a relay to start creating tunnels.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DNS & Blocking Tab */}
          <TabsContent value="dns" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* DNS Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>DNS Configuration</span>
                    <Switch
                      checked={dnsConfig?.enabled || false}
                      onCheckedChange={handleToggleDns}
                    />
                  </CardTitle>
                  <CardDescription>
                    Route DNS queries through your tunnels
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Upstream DNS Servers</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., 1.1.1.1 or 8.8.8.8"
                        value={upstreamInput}
                        onChange={(e) => setUpstreamInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddUpstream()}
                        disabled={!dnsConfig?.enabled}
                      />
                      <Button
                        variant="outline"
                        onClick={handleAddUpstream}
                        disabled={!dnsConfig?.enabled || !upstreamInput.trim()}
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(dnsConfig?.upstream || []).map((dns) => (
                        <Badge key={dns} variant="secondary" className="gap-1">
                          {dns}
                          <button
                            onClick={() => handleRemoveUpstream(dns)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ad Blocking */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Ad & Tracker Blocking</span>
                    <Switch
                      checked={dnsConfig?.adblock_enabled || false}
                      onCheckedChange={handleToggleAdblock}
                      disabled={!dnsConfig?.enabled}
                    />
                  </CardTitle>
                  <CardDescription>
                    Block ads and trackers at DNS level
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Blocked Today</p>
                      <p className="text-2xl font-bold text-red-500">
                        {formatNumber(dnsStats?.blocked_today || 0)}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Block Rate</p>
                      <p className="text-2xl font-bold">
                        {(dnsStats?.blocked_percent || 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Blocklists */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Blocklists</CardTitle>
                  <CardDescription>
                    Lists of domains to block for ad and tracker filtering
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setBlocklistDialogOpen(true)}
                  disabled={!dnsConfig?.enabled || !dnsConfig?.adblock_enabled}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Blocklist
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Entries</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Enabled</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(dnsConfig?.blocklists || []).map((blocklist) => (
                      <TableRow key={blocklist.id}>
                        <TableCell>
                          <div className="font-medium">{blocklist.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {blocklist.url}
                          </div>
                        </TableCell>
                        <TableCell>{formatNumber(blocklist.entries_count)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {blocklist.last_updated
                            ? new Date(blocklist.last_updated).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={blocklist.enabled}
                            onCheckedChange={() => handleToggleBlocklist(blocklist)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteDialog({ open: true, type: 'blocklist', item: blocklist })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(dnsConfig?.blocklists || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No blocklists configured.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Custom DNS Records */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Custom DNS Records</CardTitle>
                  <CardDescription>
                    Override DNS resolution for specific domains
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleOpenDnsRecordDialog()}
                  disabled={!dnsConfig?.enabled}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Record
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>TTL</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(dnsConfig?.custom_records || []).map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <Badge variant="outline">{record.type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{record.name}</TableCell>
                        <TableCell className="font-mono text-sm">{record.value}</TableCell>
                        <TableCell className="text-muted-foreground">{record.ttl || 3600}s</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDnsRecordDialog(record)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteDialog({ open: true, type: 'dns-record', item: record })}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(dnsConfig?.custom_records || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No custom DNS records.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Tunnel Dialog */}
      <Dialog open={tunnelDialogOpen} onOpenChange={setTunnelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTunnel ? 'Edit Tunnel' : 'New Tunnel'}</DialogTitle>
            <DialogDescription>
              Create a tunnel to expose a local service via a public URL
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tunnelName">Tunnel Name</Label>
              <Input
                id="tunnelName"
                placeholder="my-webapp"
                value={tunnelForm.name}
                onChange={(e) => setTunnelForm({ ...tunnelForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="localAddr">Local Address</Label>
              <Input
                id="localAddr"
                placeholder="localhost:3000"
                value={tunnelForm.local_addr}
                onChange={(e) => setTunnelForm({ ...tunnelForm, local_addr: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                The local service to expose (e.g., localhost:8080)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="subdomain"
                  placeholder="myapp"
                  value={tunnelForm.subdomain}
                  onChange={(e) => setTunnelForm({ ...tunnelForm, subdomain: e.target.value })}
                />
                <span className="text-muted-foreground whitespace-nowrap">.relay.domain</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="relay">Relay</Label>
              <Select
                value={tunnelForm.relay_id}
                onValueChange={(value) => setTunnelForm({ ...tunnelForm, relay_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a relay" />
                </SelectTrigger>
                <SelectContent>
                  {relays.map((relay) => (
                    <SelectItem key={relay.id} value={relay.id}>
                      <div className="flex items-center gap-2">
                        {relay.name}
                        {relay.is_primary && (
                          <Badge variant="outline" className="text-xs">Primary</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTunnelDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTunnel} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTunnel ? 'Save Changes' : 'Create Tunnel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Relay Dialog */}
      <Dialog open={relayDialogOpen} onOpenChange={setRelayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRelay ? 'Edit Relay' : 'Add Relay'}</DialogTitle>
            <DialogDescription>
              Configure a relay server for your tunnels
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="relayName">Relay Name</Label>
              <Input
                id="relayName"
                placeholder="My Relay"
                value={relayForm.name}
                onChange={(e) => setRelayForm({ ...relayForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relayUrl">Relay URL</Label>
              <Input
                id="relayUrl"
                placeholder="wss://relay.example.com"
                value={relayForm.url}
                onChange={(e) => setRelayForm({ ...relayForm, url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                WebSocket URL of the relay server
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="relayToken">Authentication Token (optional)</Label>
              <Input
                id="relayToken"
                type="password"
                placeholder="Enter token if required"
                value={relayForm.token}
                onChange={(e) => setRelayForm({ ...relayForm, token: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Set as Primary</Label>
                <p className="text-xs text-muted-foreground">
                  New tunnels will use this relay by default
                </p>
              </div>
              <Switch
                checked={relayForm.is_primary}
                onCheckedChange={(checked) => setRelayForm({ ...relayForm, is_primary: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRelayDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRelay} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingRelay ? 'Save Changes' : 'Add Relay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocklist Dialog */}
      <Dialog open={blocklistDialogOpen} onOpenChange={setBlocklistDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Blocklist</DialogTitle>
            <DialogDescription>
              Add a blocklist URL to block ads and trackers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="blocklistName">Name</Label>
              <Input
                id="blocklistName"
                placeholder="AdGuard DNS filter"
                value={blocklistForm.name}
                onChange={(e) => setBlocklistForm({ ...blocklistForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blocklistUrl">URL</Label>
              <Input
                id="blocklistUrl"
                placeholder="https://example.com/blocklist.txt"
                value={blocklistForm.url}
                onChange={(e) => setBlocklistForm({ ...blocklistForm, url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                URL to a hosts-style blocklist file
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlocklistDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddBlocklist} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Blocklist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DNS Record Dialog */}
      <Dialog open={dnsRecordDialogOpen} onOpenChange={setDnsRecordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDnsRecord ? 'Edit DNS Record' : 'Add DNS Record'}</DialogTitle>
            <DialogDescription>
              Create a custom DNS record override
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recordType">Record Type</Label>
              <Select
                value={dnsRecordForm.type}
                onValueChange={(value: 'A' | 'AAAA' | 'CNAME' | 'TXT') =>
                  setDnsRecordForm({ ...dnsRecordForm, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A (IPv4)</SelectItem>
                  <SelectItem value="AAAA">AAAA (IPv6)</SelectItem>
                  <SelectItem value="CNAME">CNAME (Alias)</SelectItem>
                  <SelectItem value="TXT">TXT (Text)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recordName">Name</Label>
              <Input
                id="recordName"
                placeholder="example.local"
                value={dnsRecordForm.name}
                onChange={(e) => setDnsRecordForm({ ...dnsRecordForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recordValue">Value</Label>
              <Input
                id="recordValue"
                placeholder={dnsRecordForm.type === 'A' ? '192.168.1.100' : 'value'}
                value={dnsRecordForm.value}
                onChange={(e) => setDnsRecordForm({ ...dnsRecordForm, value: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recordTtl">TTL (seconds)</Label>
              <Input
                id="recordTtl"
                type="number"
                placeholder="3600"
                value={dnsRecordForm.ttl || ''}
                onChange={(e) => setDnsRecordForm({ ...dnsRecordForm, ttl: parseInt(e.target.value) || 3600 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDnsRecordDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDnsRecord} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingDnsRecord ? 'Save Changes' : 'Add Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteDialog.type === 'dns-record' ? 'DNS Record' : deleteDialog.type}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.type === 'tunnel' && (
                <>Are you sure you want to delete the tunnel &quot;{(deleteDialog.item as Tunnel)?.name}&quot;? This will disconnect all active connections.</>
              )}
              {deleteDialog.type === 'relay' && (
                <>Are you sure you want to delete the relay &quot;{(deleteDialog.item as Relay)?.name}&quot;? All tunnels using this relay will be disconnected.</>
              )}
              {deleteDialog.type === 'blocklist' && (
                <>Are you sure you want to remove the blocklist &quot;{(deleteDialog.item as Blocklist)?.name}&quot;?</>
              )}
              {deleteDialog.type === 'dns-record' && (
                <>Are you sure you want to delete the DNS record for &quot;{(deleteDialog.item as CustomDnsRecord)?.name}&quot;?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// Simple Traffic Chart Component
function TrafficChart({ data }: { data: TrafficDataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No traffic data available
      </div>
    );
  }

  // Find max value for scaling
  const maxValue = Math.max(
    ...data.map(d => Math.max(d.bytes_in, d.bytes_out)),
    1 // Prevent division by zero
  );

  const width = 100;
  const height = 100;
  const padding = 10;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Generate path for incoming traffic
  const inPath = data.map((point, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = height - padding - (point.bytes_in / maxValue) * chartHeight;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Generate path for outgoing traffic
  const outPath = data.map((point, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = height - padding - (point.bytes_out / maxValue) * chartHeight;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {/* Grid lines */}
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="currentColor"
        strokeOpacity={0.1}
      />
      <line
        x1={padding}
        y1={padding + chartHeight / 2}
        x2={width - padding}
        y2={padding + chartHeight / 2}
        stroke="currentColor"
        strokeOpacity={0.1}
        strokeDasharray="2,2"
      />

      {/* Incoming traffic */}
      <path
        d={inPath}
        fill="none"
        stroke="#22c55e"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Outgoing traffic */}
      <path
        d={outPath}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
