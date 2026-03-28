'use client';

import { SpinnerInfinity } from 'spinners-react';

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
import { Plus, Wifi, WifiOff, Shield, MoreVertical, Trash2, CheckCircle, RefreshCw, Copy, Globe, Radio, Activity, ArrowDownUp, ExternalLink, Pencil, PlugZap, ShieldCheck, Ban, CircleDot, X, Gauge } from 'lucide-react';
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
import { VpnDashboardTab } from '@/components/vpn/vpn-dashboard-tab';
import { VpnDnsTab } from '@/components/vpn/vpn-dns-tab';

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
      toast.error('Impossible d\'enregistrer le tunnel');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReconnectTunnel = async (tunnel: Tunnel) => {
    try {
      await tunnelApi.reconnectTunnel(tunnel.id);
      toast.success('Reconnexion du tunnel en cours...');
      setTimeout(fetchData, 2000);
    } catch {
      toast.error('Impossible de reconnecter le tunnel');
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
      toast.error("Impossible d'enregistrer relay");
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
      toast.error('Impossible de mettre à jour DNS settings');
    }
  };

  const handleToggleAdblock = async (enabled: boolean) => {
    try {
      await tunnelApi.updateDnsConfig({ adblock_enabled: enabled });
      setDnsConfig(prev => prev ? { ...prev, adblock_enabled: enabled } : null);
      toast.success(enabled ? 'Ad blocking enabled' : 'Ad blocking disabled');
    } catch {
      toast.error('Impossible de mettre à jour ad blocking settings');
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
      toast.error("Impossible d'enregistrer DNS record");
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
      toast.error('Impossible de supprimer');
    }
  };

  // Status badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-600" variant="outline">
            <CircleDot className="mr-1 h-3 w-3" />
            Connecté
          </Badge>
        );
      case 'connecting':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-600" variant="outline">
            <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-1 h-3 w-3 " />
            Connecting
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge variant="secondary">
            <WifiOff className="mr-1 h-3 w-3" />
            Déconnecté
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
          <h1 className="text-3xl font-bold">Tunnels Web</h1>
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
            <h1 className="text-3xl font-bold">Tunnels Web</h1>
            <p className="text-muted-foreground">
              Exposez vos services locaux de manière sécurisée sans ouvrir de ports
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
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
              DNS & Filtrage
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4">
            <VpnDashboardTab
              dashboardStats={dashboardStats}
              trafficData={trafficData}
              tunnels={tunnels}
              quickTunnel={quickTunnel}
              quickConnectAddr={quickConnectAddr}
              quickConnecting={quickConnecting}
              onQuickConnectAddrChange={setQuickConnectAddr}
              onQuickConnect={handleQuickConnect}
              onDisconnectQuick={handleDisconnectQuick}
              onCopyPublicUrl={copyPublicUrl}
              onNavigateToTunnels={() => setActiveTab('tunnels')}
              onOpenTunnelDialog={handleOpenTunnelDialog}
            />
          </TabsContent>

          {/* Tunnels Tab */}
          <TabsContent value="tunnels" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => handleOpenTunnelDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau tunnel
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Tunnels configurés</CardTitle>
                <CardDescription>
                  Les tunnels exposent vos services locaux via une URL publique
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Service local</TableHead>
                      <TableHead>URL publique</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Trafic</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tunnels.map((tunnel) => (
                      <TableRow key={tunnel.id}>
                        <TableCell>
                          <div className="font-medium">{tunnel.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Relais : {tunnel.relay_name || 'Défaut'}
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
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReconnectTunnel(tunnel)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Reconnecter
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteDialog({ open: true, type: 'tunnel', item: tunnel })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {tunnels.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Aucun tunnel configuré. Cliquez sur &quot;Nouveau tunnel&quot; pour en créer un.
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
                Ajouter un relais
              </Button>
            </div>

            {/* Explanation Card */}
            <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
              <CardContent className="flex items-start gap-4 p-4">
                <Radio className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Qu&apos;est-ce qu&apos;un relais ?</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Un relais est un serveur sur internet qui fait le pont entre vos services locaux
                    et le monde extérieur. Il reçoit les connexions entrantes et les achemine via
                    votre tunnel, sans nécessiter l&apos;ouverture de ports sur votre routeur ou pare-feu.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Relais configurés</CardTitle>
                <CardDescription>
                  Serveurs relais qui gèrent vos connexions de tunnel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Tunnels</TableHead>
                      <TableHead>Latence</TableHead>
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
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleTestRelay(relay)}>
                                <Activity className="mr-2 h-4 w-4" />
                                Tester la connexion
                              </DropdownMenuItem>
                              {!relay.is_primary && (
                                <DropdownMenuItem onClick={() => handleSetPrimaryRelay(relay)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Définir comme principal
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteDialog({ open: true, type: 'relay', item: relay })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {relays.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Aucun relais configuré. Ajoutez un relais pour commencer à créer des tunnels.
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
            <VpnDnsTab
              dnsConfig={dnsConfig}
              dnsStats={dnsStats}
              upstreamInput={upstreamInput}
              onUpstreamInputChange={setUpstreamInput}
              onToggleDns={handleToggleDns}
              onToggleAdblock={handleToggleAdblock}
              onAddUpstream={handleAddUpstream}
              onRemoveUpstream={handleRemoveUpstream}
              onOpenBlocklistDialog={() => setBlocklistDialogOpen(true)}
              onToggleBlocklist={handleToggleBlocklist}
              onDeleteBlocklist={(blocklist) => setDeleteDialog({ open: true, type: 'blocklist', item: blocklist })}
              onOpenDnsRecordDialog={handleOpenDnsRecordDialog}
              onDeleteDnsRecord={(record) => setDeleteDialog({ open: true, type: 'dns-record', item: record })}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Tunnel Dialog */}
      <Dialog open={tunnelDialogOpen} onOpenChange={setTunnelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTunnel ? 'Modifier le tunnel' : 'Nouveau tunnel'}</DialogTitle>
            <DialogDescription>
              Créez un tunnel pour exposer un service local via une URL publique
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tunnelName">Nom du tunnel</Label>
              <Input
                id="tunnelName"
                placeholder="my-webapp"
                value={tunnelForm.name}
                onChange={(e) => setTunnelForm({ ...tunnelForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="localAddr">Adresse locale</Label>
              <Input
                id="localAddr"
                placeholder="localhost:3000"
                value={tunnelForm.local_addr}
                onChange={(e) => setTunnelForm({ ...tunnelForm, local_addr: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Le service local à exposer (ex : localhost:8080)
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
              <Label htmlFor="relay">Relais</Label>
              <Select
                value={tunnelForm.relay_id}
                onValueChange={(value) => setTunnelForm({ ...tunnelForm, relay_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un relais" />
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
              Annuler
            </Button>
            <Button onClick={handleSaveTunnel} disabled={submitting}>
              {submitting && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
              {editingTunnel ? 'Enregistrer' : 'Créer le tunnel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Relay Dialog */}
      <Dialog open={relayDialogOpen} onOpenChange={setRelayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRelay ? 'Modifier le relais' : 'Ajouter un relais'}</DialogTitle>
            <DialogDescription>
              Configurer un serveur relais pour vos tunnels
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="relayName">Nom du relais</Label>
              <Input
                id="relayName"
                placeholder="My Relay"
                value={relayForm.name}
                onChange={(e) => setRelayForm({ ...relayForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relayUrl">URL du relais</Label>
              <Input
                id="relayUrl"
                placeholder="wss://relay.example.com"
                value={relayForm.url}
                onChange={(e) => setRelayForm({ ...relayForm, url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                URL WebSocket du serveur relais
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="relayToken">Jeton d&apos;authentification (optionnel)</Label>
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
                <Label>Définir comme principal</Label>
                <p className="text-xs text-muted-foreground">
                  Les nouveaux tunnels utiliseront ce relais par défaut
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
              Annuler
            </Button>
            <Button onClick={handleSaveRelay} disabled={submitting}>
              {submitting && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
              {editingRelay ? 'Enregistrer' : 'Ajouter un relais'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocklist Dialog */}
      <Dialog open={blocklistDialogOpen} onOpenChange={setBlocklistDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une liste de blocage</DialogTitle>
            <DialogDescription>
              Ajouter une URL de liste de blocage pour bloquer les publicités et traceurs
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
                URL vers un fichier de liste de blocage au format hosts
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlocklistDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddBlocklist} disabled={submitting}>
              {submitting && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
              Ajouter la liste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DNS Record Dialog */}
      <Dialog open={dnsRecordDialogOpen} onOpenChange={setDnsRecordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDnsRecord ? 'Modifier l\'enregistrement DNS' : 'Ajouter un enregistrement DNS'}</DialogTitle>
            <DialogDescription>
              Créer une substitution d&apos;enregistrement DNS personnalisé
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recordType">Type d&apos;enregistrement</Label>
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
              <Label htmlFor="recordTtl">TTL (secondes)</Label>
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
              Annuler
            </Button>
            <Button onClick={handleSaveDnsRecord} disabled={submitting}>
              {submitting && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
              {editingDnsRecord ? 'Enregistrer' : 'Ajouter'}
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
              Supprimer {deleteDialog.type === 'dns-record' ? 'l\'enregistrement DNS' : deleteDialog.type === 'tunnel' ? 'le tunnel' : deleteDialog.type === 'relay' ? 'le relais' : 'la liste'} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.type === 'tunnel' && (
                <>Êtes-vous sûr de vouloir supprimer le tunnel &quot;{(deleteDialog.item as Tunnel)?.name}&quot; ? Toutes les connexions actives seront déconnectées.</>
              )}
              {deleteDialog.type === 'relay' && (
                <>Êtes-vous sûr de vouloir supprimer le relais &quot;{(deleteDialog.item as Relay)?.name}&quot; ? Tous les tunnels utilisant ce relais seront déconnectés.</>
              )}
              {deleteDialog.type === 'blocklist' && (
                <>Êtes-vous sûr de vouloir supprimer la liste &quot;{(deleteDialog.item as Blocklist)?.name}&quot; ?</>
              )}
              {deleteDialog.type === 'dns-record' && (
                <>Êtes-vous sûr de vouloir supprimer l&apos;enregistrement DNS pour &quot;{(deleteDialog.item as CustomDnsRecord)?.name}&quot; ?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
