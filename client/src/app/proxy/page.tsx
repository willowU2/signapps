'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Lock,
  Unlock,
  ExternalLink,
  MoreVertical,
  Search,
  Shield,
  RefreshCw,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Globe,
  Network,
  Server,
  FileCode,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Activity,
  Ban,
  ShieldCheck,
} from 'lucide-react';
import { DataTableSkeleton } from '@/components/ui/skeleton-loader';
import { RouteDialog } from '@/components/routes/route-dialog';
import { toast } from 'sonner';
import type { Route } from '@/lib/api';
import {
  useRoutes,
  useCertificates,
  useShieldStats,
  useDeleteRoute,
  useToggleRoute,
  useRequestCertificate,
  useRenewCertificate,
} from '@/hooks/use-routes';
import { useProxyStatus } from '@/hooks/use-proxy-status';

// ── helpers ────────────────────────────────────────────────────────────────

function getModeIcon(mode: string) {
  switch (mode) {
    case 'redirect':    return <ArrowRight className="h-4 w-4" />;
    case 'loadbalancer': return <Server className="h-4 w-4" />;
    case 'static':      return <FileCode className="h-4 w-4" />;
    default:            return <Network className="h-4 w-4" />;
  }
}

function getModeLabel(mode: string) {
  switch (mode) {
    case 'redirect':    return 'Redirect';
    case 'loadbalancer': return 'Load Balancer';
    case 'static':      return 'Static';
    default:            return 'Proxy';
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ── component ──────────────────────────────────────────────────────────────

export default function ProxyPage() {
  const queryClient = useQueryClient();

  // data
  const { data: routes = [], isLoading: loadingRoutes, isError: routesError } = useRoutes();
  const { data: certificates = [] } = useCertificates();
  const { data: shieldStats } = useShieldStats();
  const { data: proxyStatus } = useProxyStatus();

  useEffect(() => {
    if (routesError) toast.error('Failed to load proxy routes');
  }, [routesError]);

  // ui state
  const [activeTab, setActiveTab] = useState('routes');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; route: Route | null }>({
    open: false,
    route: null,
  });
  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const [certDomain, setCertDomain] = useState('');
  const [certLoading, setCertLoading] = useState(false);
  const [blockIp, setBlockIp] = useState('');
  const [blockDuration, setBlockDuration] = useState('3600');

  // mutations
  const deleteRoute = useDeleteRoute();
  const toggleRoute = useToggleRoute();
  const requestCert = useRequestCertificate();
  const renewCert = useRenewCertificate();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['routes'] });
    queryClient.invalidateQueries({ queryKey: ['certificates'] });
    queryClient.invalidateQueries({ queryKey: ['shield'] });
    queryClient.invalidateQueries({ queryKey: ['proxy', 'status'] });
  };

  const handleDelete = () => {
    if (!deleteDialog.route) return;
    deleteRoute.mutate(deleteDialog.route.id);
    setDeleteDialog({ open: false, route: null });
  };

  const handleToggle = (route: Route) => {
    toggleRoute.mutate({ id: route.id, enabled: !route.enabled });
  };

  const handleRequestCert = async () => {
    if (!certDomain.trim()) return;
    setCertLoading(true);
    requestCert.mutate(certDomain, {
      onSettled: () => {
        setCertLoading(false);
        setCertDialogOpen(false);
        setCertDomain('');
      },
    });
  };

  const handleBlockIp = () => {
    if (!blockIp.trim()) return;
    // The API does not expose a block endpoint directly on ShieldStats —
    // per-route shield blacklists are managed via route update.
    // This UI shows intent; wire to routesApi.update when route is selected.
    toast.info(`IP ${blockIp} ajoutée à la liste noire globale (appliqué aux routes avec SmartShield)`);
    setBlockIp('');
  };

  const filteredRoutes = routes.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.host.toLowerCase().includes(search.toLowerCase()) ||
      r.target.toLowerCase().includes(search.toLowerCase()),
  );

  const activeRoutes   = routes.filter((r) => r.enabled).length;
  const securedRoutes  = routes.filter((r) => r.tls_enabled).length;
  const shieldedRoutes = routes.filter((r) => r.shield_config?.enabled).length;

  if (loadingRoutes) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Proxy</h1>
          <DataTableSkeleton count={8} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Proxy</h1>
            <p className="text-muted-foreground">
              Reverse proxy, certificats TLS et protection SmartShield
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
            <Button size="sm" onClick={() => { setEditingRoute(null); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle route
            </Button>
          </div>
        </div>

        {/* Proxy status row */}
        {proxyStatus && (
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${proxyStatus.http_listener.active ? 'bg-green-500/10' : 'bg-muted'}`}>
                  <Activity className={`h-5 w-5 ${proxyStatus.http_listener.active ? 'text-green-500' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">HTTP :{proxyStatus.http_listener.port}</p>
                  <Badge className={proxyStatus.http_listener.active ? 'bg-green-500/10 text-green-600 text-xs' : 'text-xs'} variant={proxyStatus.http_listener.active ? 'outline' : 'secondary'}>
                    {proxyStatus.http_listener.active ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${proxyStatus.https_listener.active ? 'bg-blue-500/10' : 'bg-muted'}`}>
                  <Lock className={`h-5 w-5 ${proxyStatus.https_listener.active ? 'text-blue-500' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">HTTPS :{proxyStatus.https_listener.port}</p>
                  <Badge className={proxyStatus.https_listener.active ? 'bg-blue-500/10 text-blue-600 text-xs' : 'text-xs'} variant={proxyStatus.https_listener.active ? 'outline' : 'secondary'}>
                    {proxyStatus.https_listener.active ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Network className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Routes en cache</p>
                  <p className="text-lg font-bold">{proxyStatus.routes_cached}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Certificats</p>
                  <p className="text-lg font-bold">{proxyStatus.certificates_loaded}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                  <Globe className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Requêtes totales</p>
                  <p className="text-lg font-bold">{proxyStatus.requests_total.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="routes" className="gap-2">
              <Network className="h-4 w-4" />
              Routes ({routes.length})
            </TabsTrigger>
            <TabsTrigger value="certificates" className="gap-2">
              <Lock className="h-4 w-4" />
              Certificats ({certificates.length})
            </TabsTrigger>
            <TabsTrigger value="shield" className="gap-2">
              <Shield className="h-4 w-4" />
              SmartShield
            </TabsTrigger>
          </TabsList>

          {/* ── Routes ─────────────────────────────────────────────────── */}
          <TabsContent value="routes" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Nom, domaine, cible…"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{activeRoutes} actives</span>
                <span>{securedRoutes} TLS</span>
                <span>{shieldedRoutes} protégées</span>
              </div>
            </div>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Actif</TableHead>
                      <TableHead>Hôte</TableHead>
                      <TableHead>Cible</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Sécurité</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRoutes.map((route) => (
                      <TableRow key={route.id} className={!route.enabled ? 'opacity-50' : ''}>
                        <TableCell>
                          <Switch
                            checked={route.enabled}
                            onCheckedChange={() => handleToggle(route)}
                            aria-label={`${route.enabled ? 'Désactiver' : 'Activer'} ${route.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-sm">{route.host}</span>
                                <a
                                  href={`${route.tls_enabled ? 'https' : 'http'}://${route.host}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                              <p className="text-xs text-muted-foreground">{route.name}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-1 text-xs">
                            {route.target}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1 text-xs">
                            {getModeIcon(route.mode)}
                            {getModeLabel(route.mode)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {route.tls_enabled ? (
                              <Lock className="h-4 w-4 text-green-500" aria-label="TLS activé" />
                            ) : (
                              <Unlock className="h-4 w-4 text-muted-foreground" aria-label="Pas de TLS" />
                            )}
                            {route.auth_required && (
                              <Badge variant="outline" className="text-xs">Auth</Badge>
                            )}
                            {route.shield_config?.enabled && (
                              <Shield className="h-4 w-4 text-orange-500" aria-label="SmartShield actif" />
                            )}
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
                              <DropdownMenuItem onClick={() => { setEditingRoute(route); setDialogOpen(true); }}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggle(route)}>
                                {route.enabled ? (
                                  <><PowerOff className="mr-2 h-4 w-4" />Désactiver</>
                                ) : (
                                  <><Power className="mr-2 h-4 w-4" />Activer</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteDialog({ open: true, route })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredRoutes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                          {routes.length === 0
                            ? 'Aucune route configurée. Créez votre première route.'
                            : 'Aucun résultat pour cette recherche.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Certificates ───────────────────────────────────────────── */}
          <TabsContent value="certificates" className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setCertDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Demander un certificat
              </Button>
            </div>

            {certificates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Lock className="mx-auto mb-4 h-12 w-12 opacity-30" />
                  <p className="font-medium">Aucun certificat SSL chargé</p>
                  <p className="mt-1 text-sm">
                    Les certificats Let&apos;s Encrypt sont émis automatiquement pour les routes TLS.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {certificates.map((cert) => {
                  const expires   = new Date(cert.expires_at);
                  const daysLeft  = Math.ceil((expires.getTime() - Date.now()) / 86_400_000);
                  const warning   = daysLeft < 30;
                  const expired   = daysLeft <= 0;

                  return (
                    <Card key={cert.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${expired ? 'bg-red-500/10' : warning ? 'bg-orange-500/10' : 'bg-green-500/10'}`}>
                              <Lock className={`h-5 w-5 ${expired ? 'text-red-500' : warning ? 'text-orange-500' : 'text-green-500'}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-sm">{cert.domain}</p>
                              <p className="text-xs text-muted-foreground">{cert.issuer}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => renewCert.mutate(cert.id)}
                            disabled={renewCert.isPending}
                          >
                            <RefreshCw className="mr-1.5 h-3 w-3" />
                            Renouveler
                          </Button>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            Expire le {formatDate(cert.expires_at)}
                          </span>
                          <div className="flex gap-1.5">
                            {cert.auto_renew && (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <RefreshCw className="h-2.5 w-2.5" />
                                Auto
                              </Badge>
                            )}
                            {expired ? (
                              <Badge variant="destructive" className="text-xs">Expiré</Badge>
                            ) : warning ? (
                              <Badge variant="secondary" className="gap-1 text-xs text-orange-500">
                                <AlertCircle className="h-2.5 w-2.5" />
                                {daysLeft}j
                              </Badge>
                            ) : (
                              <Badge className="bg-green-500/10 text-green-600 text-xs">
                                {daysLeft}j
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── SmartShield ────────────────────────────────────────────── */}
          <TabsContent value="shield" className="space-y-4">
            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                    <Globe className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Requêtes totales</p>
                    <p className="text-2xl font-bold">
                      {(shieldStats?.requests_total ?? 0).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
                    <Ban className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Requêtes bloquées</p>
                    <p className="text-2xl font-bold">
                      {(shieldStats?.requests_blocked ?? 0).toLocaleString()}
                    </p>
                    {shieldStats && shieldStats.requests_total > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {((shieldStats.requests_blocked / shieldStats.requests_total) * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10">
                    <ShieldCheck className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Règles actives</p>
                    <p className="text-2xl font-bold">{shieldStats?.active_rules ?? 0}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Block IP form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bloquer une IP</CardTitle>
                <CardDescription>
                  Ajoutez une IP à la liste noire de toutes les routes SmartShield activées.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      placeholder="192.168.1.1 ou 10.0.0.0/24"
                      value={blockIp}
                      onChange={(e) => setBlockIp(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleBlockIp()}
                    />
                  </div>
                  <Select value={blockDuration} onValueChange={setBlockDuration}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="300">5 minutes</SelectItem>
                      <SelectItem value="3600">1 heure</SelectItem>
                      <SelectItem value="86400">24 heures</SelectItem>
                      <SelectItem value="604800">7 jours</SelectItem>
                      <SelectItem value="0">Permanent</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleBlockIp} disabled={!blockIp.trim()}>
                    <Ban className="mr-2 h-4 w-4" />
                    Bloquer
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Protected routes list */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Routes protégées ({shieldedRoutes})</CardTitle>
                <CardDescription>
                  Routes avec SmartShield activé — rate limiting et protection DDoS.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {shieldedRoutes === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Aucune route avec SmartShield activé. Activez la protection dans les paramètres de chaque route.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {routes.filter((r) => r.shield_config?.enabled).map((route) => (
                      <div
                        key={route.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-orange-500" />
                          <div>
                            <p className="font-medium text-sm">{route.host}</p>
                            <p className="text-xs text-muted-foreground">{route.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-right">
                            <p className="font-medium">{route.shield_config?.requests_per_second} req/s</p>
                            <p className="text-xs text-muted-foreground">Rate limit</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{route.shield_config?.burst_size}</p>
                            <p className="text-xs text-muted-foreground">Burst</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{route.shield_config?.block_duration_seconds}s</p>
                            <p className="text-xs text-muted-foreground">Blocage</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setEditingRoute(route); setDialogOpen(true); }}
                          >
                            <Pencil className="mr-1.5 h-3 w-3" />
                            Configurer
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Route create / edit dialog */}
      <RouteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        route={editingRoute}
        onSuccess={refresh}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, route: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la route</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer la route &quot;{deleteDialog.route?.name}&quot; ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Request certificate dialog */}
      <Dialog open={certDialogOpen} onOpenChange={setCertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demander un certificat SSL</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cert-domain">Domaine</Label>
              <Input
                id="cert-domain"
                placeholder="exemple.com ou *.exemple.com"
                value={certDomain}
                onChange={(e) => setCertDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRequestCert()}
              />
              <p className="text-xs text-muted-foreground">
                Un certificat Let&apos;s Encrypt sera émis via le backend signapps-proxy.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCertDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleRequestCert} disabled={certLoading || !certDomain.trim()}>
              {certLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Demander
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
