'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Shield,
  Radio,
  Globe,
  Activity,
  Plus,
  RefreshCw,
  Trash2,
  MoreVertical,
  Plug,
  PlugZap,
  Wifi,
  WifiOff,
  Network,
  Zap,
  Database,
  Ban,
  CheckCircle,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  securelinkApi,
  DashboardStats,
  DashboardTraffic,
  Tunnel,
  Relay,
  RelayStats,
  DnsConfig,
  DnsBlocklist,
  DnsRecord,
  DnsStats,
} from '@/lib/api/securelink';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TunnelStatusBadge({ status }: { status: Tunnel['status'] }) {
  if (status === 'connected')
    return <Badge className="bg-green-500/10 text-green-600">Connected</Badge>;
  if (status === 'error')
    return <Badge variant="destructive">Error</Badge>;
  return <Badge variant="secondary">Disconnected</Badge>;
}

function RelayStatusBadge({ status }: { status: Relay['status'] }) {
  if (status === 'connected')
    return <Badge className="bg-green-500/10 text-green-600">Connected</Badge>;
  return <Badge variant="secondary">Disconnected</Badge>;
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [traffic, setTraffic] = useState<DashboardTraffic[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([
        securelinkApi.dashboard.stats(),
        securelinkApi.dashboard.traffic(),
      ]);
      setStats(s.data);
      setTraffic(t.data);
    } catch {
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const statCards = [
    {
      label: 'Active Tunnels',
      value: stats?.active_tunnels ?? '—',
      icon: <Network className="h-5 w-5 text-blue-500" />,
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Active Relays',
      value: stats?.active_relays ?? '—',
      icon: <Radio className="h-5 w-5 text-purple-500" />,
      bg: 'bg-purple-500/10',
    },
    {
      label: 'DNS Queries Today',
      value: stats?.dns_queries_today ?? '—',
      icon: <Globe className="h-5 w-5 text-green-500" />,
      bg: 'bg-green-500/10',
    },
    {
      label: 'Blocked Queries',
      value: stats?.blocked_queries_today ?? '—',
      icon: <Ban className="h-5 w-5 text-red-500" />,
      bg: 'bg-red-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Overview of all SecureLink services</p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.bg}`}>
                  {card.icon}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Traffic Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Traffic Overview
          </CardTitle>
          <CardDescription>Bytes in / out per interval</CardDescription>
        </CardHeader>
        <CardContent>
          {traffic.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-muted-foreground">
              <Activity className="mb-2 h-10 w-10 opacity-30" />
              <p>No traffic data available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {traffic.slice(-10).map((point, i) => (
                <div key={i} className="flex items-center justify-between rounded border px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground font-mono text-xs">
                    {new Date(point.timestamp).toLocaleTimeString('fr-FR')}
                  </span>
                  <div className="flex gap-4">
                    <span className="text-green-600">↓ {formatBytes(point.bytes_in)}</span>
                    <span className="text-orange-500">↑ {formatBytes(point.bytes_out)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tunnels Tab ──────────────────────────────────────────────────────────────

function TunnelsTab() {
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', target_host: '', target_port: '', local_port: '', protocol: 'tcp' });
  const [quickForm, setQuickForm] = useState({ target_host: '', target_port: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await securelinkApi.tunnels.list();
      setTunnels(res.data);
    } catch {
      toast.error('Failed to load tunnels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name || !form.target_host || !form.target_port) {
      toast.error('Name, host and port are required');
      return;
    }
    setSaving(true);
    try {
      await securelinkApi.tunnels.create({
        name: form.name,
        target_host: form.target_host,
        target_port: parseInt(form.target_port),
        local_port: form.local_port ? parseInt(form.local_port) : undefined,
        protocol: form.protocol,
      });
      toast.success('Tunnel created');
      setCreateOpen(false);
      setForm({ name: '', target_host: '', target_port: '', local_port: '', protocol: 'tcp' });
      load();
    } catch {
      toast.error('Failed to create tunnel');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickConnect = async () => {
    if (!quickForm.target_host || !quickForm.target_port) {
      toast.error('Host and port are required');
      return;
    }
    setSaving(true);
    try {
      await securelinkApi.tunnels.quickConnect({
        target_host: quickForm.target_host,
        target_port: parseInt(quickForm.target_port),
      });
      toast.success('Quick connect initiated');
      setQuickOpen(false);
      setQuickForm({ target_host: '', target_port: '' });
      load();
    } catch {
      toast.error('Quick connect failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReconnect = async (id: string) => {
    try {
      await securelinkApi.tunnels.reconnect(id);
      toast.success('Reconnecting tunnel…');
      load();
    } catch {
      toast.error('Reconnect failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await securelinkApi.tunnels.delete(id);
      toast.success('Tunnel deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tunnels.length} tunnel(s) configured</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setQuickOpen(true)}>
            <Zap className="mr-2 h-4 w-4" />
            Quick Connect
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Tunnel
          </Button>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Protocol</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Loading tunnels…
                </TableCell>
              </TableRow>
            ) : tunnels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Network className="h-8 w-8 opacity-30" />
                    <p>No tunnels configured</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              tunnels.map((tunnel) => (
                <TableRow key={tunnel.id}>
                  <TableCell className="font-medium">{tunnel.name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {tunnel.target_host}:{tunnel.target_port}
                    {tunnel.local_port && (
                      <span className="ml-1 text-muted-foreground">→ :{tunnel.local_port}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase">{tunnel.protocol}</Badge>
                  </TableCell>
                  <TableCell>
                    <TunnelStatusBadge status={tunnel.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(tunnel.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleReconnect(tunnel.id)}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Reconnect
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(tunnel.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Tunnel Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Tunnel</DialogTitle>
            <DialogDescription>Configure a secure tunnel to a remote host.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input
                placeholder="my-tunnel"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Target Host</Label>
                <Input
                  placeholder="192.168.1.1"
                  value={form.target_host}
                  onChange={(e) => setForm((f) => ({ ...f, target_host: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Target Port</Label>
                <Input
                  type="number"
                  placeholder="22"
                  value={form.target_port}
                  onChange={(e) => setForm((f) => ({ ...f, target_port: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Local Port (optional)</Label>
                <Input
                  type="number"
                  placeholder="auto"
                  value={form.local_port}
                  onChange={(e) => setForm((f) => ({ ...f, local_port: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Protocol</Label>
                <Input
                  placeholder="tcp"
                  value={form.protocol}
                  onChange={(e) => setForm((f) => ({ ...f, protocol: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating…' : 'Create Tunnel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Connect Dialog */}
      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Connect</DialogTitle>
            <DialogDescription>Instantly open a tunnel to a host and port.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Host</Label>
              <Input
                placeholder="192.168.1.1"
                value={quickForm.target_host}
                onChange={(e) => setQuickForm((f) => ({ ...f, target_host: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Port</Label>
              <Input
                type="number"
                placeholder="80"
                value={quickForm.target_port}
                onChange={(e) => setQuickForm((f) => ({ ...f, target_port: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickOpen(false)}>Cancel</Button>
            <Button onClick={handleQuickConnect} disabled={saving}>
              <Zap className="mr-2 h-4 w-4" />
              {saving ? 'Connecting…' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tunnel</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the tunnel. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Relays Tab ───────────────────────────────────────────────────────────────

function RelaysTab() {
  const [relays, setRelays] = useState<Relay[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statsRelay, setStatsRelay] = useState<{ id: string; stats: RelayStats } | null>(null);
  const [form, setForm] = useState({ name: '', host: '', port: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await securelinkApi.relays.list();
      setRelays(res.data);
    } catch {
      toast.error('Failed to load relays');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name || !form.host || !form.port) {
      toast.error('Name, host and port are required');
      return;
    }
    setSaving(true);
    try {
      await securelinkApi.relays.create({
        name: form.name,
        host: form.host,
        port: parseInt(form.port),
      });
      toast.success('Relay created');
      setCreateOpen(false);
      setForm({ name: '', host: '', port: '' });
      load();
    } catch {
      toast.error('Failed to create relay');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async (id: string) => {
    try {
      await securelinkApi.relays.connect(id);
      toast.success('Relay connecting…');
      load();
    } catch {
      toast.error('Connect failed');
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await securelinkApi.relays.disconnect(id);
      toast.success('Relay disconnected');
      load();
    } catch {
      toast.error('Disconnect failed');
    }
  };

  const handleTest = async (id: string) => {
    try {
      await securelinkApi.relays.test(id);
      toast.success('Relay test sent');
    } catch {
      toast.error('Test failed');
    }
  };

  const handleShowStats = async (id: string) => {
    try {
      const res = await securelinkApi.relays.stats(id);
      setStatsRelay({ id, stats: res.data });
    } catch {
      toast.error('Failed to load relay stats');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await securelinkApi.relays.delete(id);
      toast.success('Relay deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{relays.length} relay(s) configured</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Relay
          </Button>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Host</TableHead>
              <TableHead>Latency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Loading relays…
                </TableCell>
              </TableRow>
            ) : relays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Radio className="h-8 w-8 opacity-30" />
                    <p>No relays configured</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              relays.map((relay) => (
                <TableRow key={relay.id}>
                  <TableCell className="font-medium">{relay.name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {relay.host}:{relay.port}
                  </TableCell>
                  <TableCell className="text-sm">
                    {relay.latency_ms != null ? (
                      <span className={relay.latency_ms < 50 ? 'text-green-600' : relay.latency_ms < 150 ? 'text-yellow-600' : 'text-red-500'}>
                        {relay.latency_ms} ms
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <RelayStatusBadge status={relay.status} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {relay.status === 'connected' ? (
                          <DropdownMenuItem onClick={() => handleDisconnect(relay.id)}>
                            <WifiOff className="mr-2 h-4 w-4" />
                            Disconnect
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleConnect(relay.id)}>
                            <Wifi className="mr-2 h-4 w-4" />
                            Connect
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleTest(relay.id)}>
                          <PlugZap className="mr-2 h-4 w-4" />
                          Test
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShowStats(relay.id)}>
                          <Activity className="mr-2 h-4 w-4" />
                          Stats
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(relay.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Relay Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Relay</DialogTitle>
            <DialogDescription>Add a new relay server to route traffic through.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input
                placeholder="relay-eu-1"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Host</Label>
                <Input
                  placeholder="relay.example.com"
                  value={form.host}
                  onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Port</Label>
                <Input
                  type="number"
                  placeholder="443"
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating…' : 'Create Relay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Dialog */}
      <Dialog open={statsRelay !== null} onOpenChange={(o) => { if (!o) setStatsRelay(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Relay Stats</DialogTitle>
          </DialogHeader>
          {statsRelay && (
            <div className="grid grid-cols-2 gap-4 py-2">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Bytes In</p>
                  <p className="text-xl font-bold">{formatBytes(statsRelay.stats.bytes_in)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Bytes Out</p>
                  <p className="text-xl font-bold">{formatBytes(statsRelay.stats.bytes_out)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Latency</p>
                  <p className="text-xl font-bold">
                    {statsRelay.stats.latency_ms != null ? `${statsRelay.stats.latency_ms} ms` : '—'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Connected At</p>
                  <p className="text-sm font-medium">{formatDate(statsRelay.stats.connected_at)}</p>
                </CardContent>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatsRelay(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Relay</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the relay. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── DNS Tab ──────────────────────────────────────────────────────────────────

function DnsTab() {
  const [config, setConfig] = useState<DnsConfig | null>(null);
  const [blocklists, setBlocklists] = useState<DnsBlocklist[]>([]);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [dnsStats, setDnsStats] = useState<DnsStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [editConfig, setEditConfig] = useState(false);
  const [configForm, setConfigForm] = useState({ upstream: '', cache_size: '', blocking: false });

  const [addBlocklistOpen, setAddBlocklistOpen] = useState(false);
  const [blocklistForm, setBlocklistForm] = useState({ name: '', url: '' });

  const [addRecordOpen, setAddRecordOpen] = useState(false);
  const [recordForm, setRecordForm] = useState({ name: '', record_type: 'A', value: '' });

  const [deleteBlocklistId, setDeleteBlocklistId] = useState<string | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<DnsRecord | null>(null);

  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, bl, rec, st] = await Promise.all([
        securelinkApi.dns.config(),
        securelinkApi.dns.blocklists(),
        securelinkApi.dns.records(),
        securelinkApi.dns.stats(),
      ]);
      setConfig(cfg.data);
      setConfigForm({
        upstream: cfg.data.upstream_servers.join(', '),
        cache_size: String(cfg.data.cache_size),
        blocking: cfg.data.blocking_enabled,
      });
      setBlocklists(bl.data);
      setRecords(rec.data);
      setDnsStats(st.data);
    } catch {
      toast.error('Failed to load DNS configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await securelinkApi.dns.updateConfig({
        upstream_servers: configForm.upstream.split(',').map((s) => s.trim()).filter(Boolean),
        cache_size: parseInt(configForm.cache_size) || 1000,
        blocking_enabled: configForm.blocking,
      });
      toast.success('DNS config updated');
      setEditConfig(false);
      load();
    } catch {
      toast.error('Failed to update DNS config');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlocklist = async () => {
    if (!blocklistForm.name || !blocklistForm.url) {
      toast.error('Name and URL are required');
      return;
    }
    setSaving(true);
    try {
      await securelinkApi.dns.addBlocklist(blocklistForm);
      toast.success('Blocklist added');
      setAddBlocklistOpen(false);
      setBlocklistForm({ name: '', url: '' });
      load();
    } catch {
      toast.error('Failed to add blocklist');
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshBlocklist = async (id: string) => {
    try {
      await securelinkApi.dns.refreshBlocklist(id);
      toast.success('Blocklist refresh initiated');
      load();
    } catch {
      toast.error('Refresh failed');
    }
  };

  const handleDeleteBlocklist = async (id: string) => {
    try {
      await securelinkApi.dns.deleteBlocklist(id);
      toast.success('Blocklist deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
    setDeleteBlocklistId(null);
  };

  const handleAddRecord = async () => {
    if (!recordForm.name || !recordForm.value) {
      toast.error('Name and value are required');
      return;
    }
    setSaving(true);
    try {
      await securelinkApi.dns.addRecord({
        name: recordForm.name,
        record_type: recordForm.record_type,
        value: recordForm.value,
      });
      toast.success('DNS record added');
      setAddRecordOpen(false);
      setRecordForm({ name: '', record_type: 'A', value: '' });
      load();
    } catch {
      toast.error('Failed to add record');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async (record: DnsRecord) => {
    try {
      await securelinkApi.dns.deleteRecord({ name: record.name, record_type: record.record_type });
      toast.success('DNS record deleted');
      load();
    } catch {
      toast.error('Delete failed');
    }
    setDeleteRecord(null);
  };

  const handleFlushCache = async () => {
    try {
      await securelinkApi.dns.flushCache();
      toast.success('DNS cache flushed');
      load();
    } catch {
      toast.error('Cache flush failed');
    }
  };

  const handleResetStats = async () => {
    try {
      await securelinkApi.dns.resetStats();
      toast.success('DNS stats reset');
      load();
    } catch {
      toast.error('Reset failed');
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Loading DNS configuration…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Config Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                DNS Configuration
              </CardTitle>
              <CardDescription>Upstream resolvers and cache settings</CardDescription>
            </div>
            <div className="flex gap-2">
              {editConfig ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditConfig(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveConfig} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={handleFlushCache}>
                    <Database className="mr-2 h-4 w-4" />
                    Flush Cache
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditConfig(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {editConfig ? (
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Upstream Servers (comma-separated)</Label>
                <Input
                  placeholder="8.8.8.8, 1.1.1.1"
                  value={configForm.upstream}
                  onChange={(e) => setConfigForm((f) => ({ ...f, upstream: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Cache Size (entries)</Label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={configForm.cache_size}
                  onChange={(e) => setConfigForm((f) => ({ ...f, cache_size: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={configForm.blocking}
                  onCheckedChange={(v) => setConfigForm((f) => ({ ...f, blocking: v }))}
                />
                <Label>Blocking Enabled</Label>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between rounded border p-3">
                <span className="text-muted-foreground">Upstream Servers</span>
                <span className="font-mono">{config?.upstream_servers.join(', ') || '—'}</span>
              </div>
              <div className="flex items-center justify-between rounded border p-3">
                <span className="text-muted-foreground">Cache Size</span>
                <span className="font-mono">{config?.cache_size ?? '—'} entries</span>
              </div>
              <div className="flex items-center justify-between rounded border p-3">
                <span className="text-muted-foreground">Blocking</span>
                {config?.blocking_enabled ? (
                  <Badge className="bg-green-500/10 text-green-600">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Disabled
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Card */}
      {dnsStats && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                DNS Statistics
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={handleResetStats}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset Stats
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Total Queries', value: dnsStats.total_queries },
                { label: 'Blocked', value: dnsStats.blocked_queries },
                { label: 'Cache Hits', value: dnsStats.cache_hits },
                { label: 'Cache Misses', value: dnsStats.cache_misses },
              ].map((s) => (
                <div key={s.label} className="rounded border p-3 text-center">
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Blocklists */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Ban className="h-5 w-5" />
                Blocklists
              </CardTitle>
              <CardDescription>{blocklists.length} list(s) configured</CardDescription>
            </div>
            <Button size="sm" onClick={() => setAddBlocklistOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add List
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Entries</TableHead>
                <TableHead>Last Refresh</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {blocklists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    No blocklists configured
                  </TableCell>
                </TableRow>
              ) : (
                blocklists.map((bl) => (
                  <TableRow key={bl.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{bl.name}</p>
                        <p className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">{bl.url}</p>
                      </div>
                    </TableCell>
                    <TableCell>{bl.entries_count.toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(bl.last_refresh)}
                    </TableCell>
                    <TableCell>
                      {bl.enabled ? (
                        <Badge className="bg-green-500/10 text-green-600">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleRefreshBlocklist(bl.id)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteBlocklistId(bl.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* DNS Records */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                DNS Records
              </CardTitle>
              <CardDescription>Custom local DNS entries</CardDescription>
            </div>
            <Button size="sm" onClick={() => setAddRecordOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Record
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    No custom DNS records
                  </TableCell>
                </TableRow>
              ) : (
                records.map((rec, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{rec.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{rec.record_type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{rec.value}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteRecord(rec)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Blocklist Dialog */}
      <Dialog open={addBlocklistOpen} onOpenChange={setAddBlocklistOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Blocklist</DialogTitle>
            <DialogDescription>Subscribe to a DNS blocklist from a URL.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input
                placeholder="EasyList"
                value={blocklistForm.name}
                onChange={(e) => setBlocklistForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>URL</Label>
              <Input
                placeholder="https://somehost.invalid/blocklist.txt"
                value={blocklistForm.url}
                onChange={(e) => setBlocklistForm((f) => ({ ...f, url: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBlocklistOpen(false)}>Cancel</Button>
            <Button onClick={handleAddBlocklist} disabled={saving}>
              {saving ? 'Adding…' : 'Add Blocklist'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Record Dialog */}
      <Dialog open={addRecordOpen} onOpenChange={setAddRecordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add DNS Record</DialogTitle>
            <DialogDescription>Create a custom local DNS record.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Name (domain)</Label>
              <Input
                placeholder="myservice.local"
                value={recordForm.name}
                onChange={(e) => setRecordForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <Input
                  placeholder="A"
                  value={recordForm.record_type}
                  onChange={(e) => setRecordForm((f) => ({ ...f, record_type: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Value</Label>
                <Input
                  placeholder="192.168.1.100"
                  value={recordForm.value}
                  onChange={(e) => setRecordForm((f) => ({ ...f, value: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRecordOpen(false)}>Cancel</Button>
            <Button onClick={handleAddRecord} disabled={saving}>
              {saving ? 'Adding…' : 'Add Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Blocklist Confirmation */}
      <AlertDialog open={deleteBlocklistId !== null} onOpenChange={(o) => { if (!o) setDeleteBlocklistId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Blocklist</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the blocklist. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteBlocklistId && handleDeleteBlocklist(deleteBlocklistId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Record Confirmation */}
      <AlertDialog open={deleteRecord !== null} onOpenChange={(o) => { if (!o) setDeleteRecord(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete DNS Record</AlertDialogTitle>
            <AlertDialogDescription>
              Delete record <span className="font-mono font-medium">{deleteRecord?.name}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteRecord && handleDeleteRecord(deleteRecord)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SecureLinkPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Shield className="h-6 w-6 text-blue-500" />
            </div>
            SecureLink
          </h1>
          <p className="mt-1 text-muted-foreground">
            Secure tunnels, relay servers and DNS management
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard" className="gap-2">
              <Activity className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="tunnels" className="gap-2">
              <Network className="h-4 w-4" />
              Tunnels
            </TabsTrigger>
            <TabsTrigger value="relays" className="gap-2">
              <Radio className="h-4 w-4" />
              Relays
            </TabsTrigger>
            <TabsTrigger value="dns" className="gap-2">
              <Globe className="h-4 w-4" />
              DNS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <DashboardTab />
          </TabsContent>

          <TabsContent value="tunnels" className="mt-6">
            <TunnelsTab />
          </TabsContent>

          <TabsContent value="relays" className="mt-6">
            <RelaysTab />
          </TabsContent>

          <TabsContent value="dns" className="mt-6">
            <DnsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
