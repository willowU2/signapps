'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTableSkeleton } from '@/components/ui/skeleton-loader';
import { Plus, Lock, Unlock, ExternalLink, MoreVertical, Search, Shield, RefreshCw, Pencil, Trash2, Power, PowerOff, Globe, ArrowRight, Copy, CheckCircle2, AlertCircle, Server, Network, FileCode, Asterisk, ListTree } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { Route } from '@/lib/api';
import { RouteDialog } from '@/components/routes/route-dialog';
import { toast } from 'sonner';
import {
  useRoutes,
  useCertificates,
  useShieldStats,
  useDeleteRoute,
  useToggleRoute,
  useRequestCertificate,
  useRenewCertificate,
} from '@/hooks/use-routes';

export default function RoutesPage() {
  const queryClient = useQueryClient();
  const { data: routes = [], isLoading: loading, isError: routesError } = useRoutes();
  const { data: certificates = [] } = useCertificates();
  const { data: shieldStats = null } = useShieldStats();

  useEffect(() => {
    if (routesError) toast.error('Impossible de charger les routes');
  }, [routesError]);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('routes');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; route: Route | null }>({
    open: false,
    route: null,
  });
  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const [certDomain, setCertDomain] = useState('');
  const [certLoading, setCertLoading] = useState(false);

  const deleteRouteMutation = useDeleteRoute();
  const toggleRouteMutation = useToggleRoute();
  const requestCertMutation = useRequestCertificate();
  const renewCertMutation = useRenewCertificate();

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['routes'] });
    queryClient.invalidateQueries({ queryKey: ['certificates'] });
    queryClient.invalidateQueries({ queryKey: ['shield'] });
  };

  const handleDelete = async () => {
    if (!deleteDialog.route) return;
    deleteRouteMutation.mutate(deleteDialog.route.id);
    setDeleteDialog({ open: false, route: null });
  };

  const handleEdit = (route: Route) => {
    setEditingRoute(route);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingRoute(null);
    setDialogOpen(true);
  };

  const handleToggle = (route: Route) => {
    toggleRouteMutation.mutate({ id: route.id, enabled: !route.enabled });
  };

  const handleRequestCertificate = async () => {
    if (!certDomain.trim()) return;
    setCertLoading(true);
    requestCertMutation.mutate(certDomain, {
      onSettled: () => {
        setCertLoading(false);
        setCertDialogOpen(false);
        setCertDomain('');
      },
    });
  };

  const handleRenewCertificate = (certId: string) => {
    renewCertMutation.mutate(certId);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié dans le presse-papier');
  };

  const filteredRoutes = routes.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.host.toLowerCase().includes(search.toLowerCase()) ||
      r.target.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'redirect':
        return <ArrowRight className="h-4 w-4" />;
      case 'loadbalancer':
        return <Server className="h-4 w-4" />;
      case 'static':
        return <FileCode className="h-4 w-4" />;
      default:
        return <Network className="h-4 w-4" />;
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'redirect':
        return 'Redirection';
      case 'loadbalancer':
        return 'Load Balancer';
      case 'static':
        return 'Statique';
      default:
        return 'Proxy';
    }
  };

  // Stats
  const activeRoutes = routes.filter((r) => r.enabled).length;
  const securedRoutes = routes.filter((r) => r.tls_enabled).length;
  const protectedRoutes = routes.filter((r) => r.shield_config?.enabled).length;
  // Group routes by domain
  const domains = [...new Set(routes.map((r) => {
    const parts = r.host.split('.');
    return parts.length >= 2 ? parts.slice(-2).join('.') : r.host;
  }))];

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Routes & Domaines</h1>
          </div>
          <DataTableSkeleton count={8} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Routes & Domaines</h1>
            <p className="text-muted-foreground">
              Gérez vos domaines, sous-domaines et reverse proxy
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refreshData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle Route
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Domaines</p>
                <p className="text-2xl font-bold">{domains.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Routes Actives</p>
                <p className="text-2xl font-bold">{activeRoutes} / {routes.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <Lock className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">SSL/TLS</p>
                <p className="text-2xl font-bold">{securedRoutes}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10">
                <Shield className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Protégées</p>
                <p className="text-2xl font-bold">{protectedRoutes}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content with Tabs */}
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
            <TabsTrigger value="domains" className="gap-2">
              <Globe className="h-4 w-4" />
              Domaines
            </TabsTrigger>
            <TabsTrigger value="shield" className="gap-2">
              <Shield className="h-4 w-4" />
              SmartShield
            </TabsTrigger>
          </TabsList>

          {/* Routes Tab */}
          <TabsContent value="routes" className="space-y-4">
            {/* Search */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, domaine ou cible..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Routes Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">État</TableHead>
                      <TableHead>Domaine</TableHead>
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
                          {route.enabled ? (
                            <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                              Actif
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Off</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{route.host}</span>
                                {route.host.startsWith('*.') && (
                                  <Badge variant="outline" className="gap-1 text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                                    <Asterisk className="h-3 w-3" />
                                    Wildcard
                                  </Badge>
                                )}
                                {route.dns_records && route.dns_records.length > 0 && (
                                  <span title={`${route.dns_records.length} enregistrement(s) DNS`}>
                                    <ListTree className="h-3.5 w-3.5 text-blue-500" />
                                  </span>
                                )}
                                <button
                                  onClick={() => copyToClipboard(route.host)}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
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
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {route.target}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            {getModeIcon(route.mode)}
                            {getModeLabel(route.mode)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {route.tls_enabled ? (
                              <span title={route.tls_config?.wildcard ? "SSL Wildcard active" : "SSL/TLS active"}>
                                <Lock className={`h-4 w-4 ${route.tls_config?.wildcard ? 'text-blue-500' : 'text-green-500'}`} />
                              </span>
                            ) : (
                              <span title="Pas de SSL">
                                <Unlock className="h-4 w-4 text-muted-foreground" />
                              </span>
                            )}
                            {route.tls_config?.wildcard && (
                              <Badge variant="outline" className="gap-1 text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                                Wildcard SSL
                              </Badge>
                            )}
                            {route.auth_required && (
                              <Badge variant="outline" className="gap-1 text-xs">
                                Auth
                              </Badge>
                            )}
                            {route.shield_config?.enabled && (
                              <span title="SmartShield active">
                                <Shield className="h-4 w-4 text-orange-500" />
                              </span>
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
                              <DropdownMenuItem onClick={() => handleEdit(route)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggle(route)}>
                                {route.enabled ? (
                                  <>
                                    <PowerOff className="mr-2 h-4 w-4" />
                                    Désactiver
                                  </>
                                ) : (
                                  <>
                                    <Power className="mr-2 h-4 w-4" />
                                    Activer
                                  </>
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
                        <TableCell colSpan={6} className="py-4">
                          {routes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center py-8 space-y-4">
                              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                                <Network className="h-8 w-8 text-primary/70" />
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-foreground">Aucune route configurée</h3>
                                <p className="text-sm text-muted-foreground mt-1">Créez votre première route pour exposer vos services</p>
                              </div>
                              <Button size="sm" onClick={handleCreate}>
                                <Plus className="mr-2 h-4 w-4" />
                                Nouvelle Route
                              </Button>
                            </div>
                          ) : (
                            <p className="text-center py-8 text-muted-foreground">Aucune route ne correspond à votre recherche</p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Certificates Tab */}
          <TabsContent value="certificates" className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setCertDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Demander un certificat
              </Button>
            </div>

            {certificates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun certificat SSL configuré</p>
                  <p className="text-sm mt-2">
                    Les certificats Let&apos;s Encrypt sont automatiquement demandés pour les routes avec TLS activé
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {certificates.map((cert) => {
                  const expiresAt = new Date(cert.expires_at);
                  const now = new Date();
                  const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  const isExpiringSoon = daysUntilExpiry < 30;

                  return (
                    <Card key={cert.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                              isExpiringSoon ? 'bg-orange-500/10' : 'bg-green-500/10'
                            }`}>
                              <Lock className={`h-5 w-5 ${
                                isExpiringSoon ? 'text-orange-500' : 'text-green-500'
                              }`} />
                            </div>
                            <div>
                              <p className="font-medium">{cert.domain}</p>
                              <p className="text-sm text-muted-foreground">
                                {cert.issuer}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRenewCertificate(cert.id)}
                          >
                            <RefreshCw className="mr-2 h-3 w-3" />
                            Renouveler
                          </Button>
                        </div>
                        <div className="mt-4 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Expire le {formatDate(cert.expires_at)}
                          </span>
                          <div className="flex items-center gap-2">
                            {cert.auto_renew && (
                              <Badge variant="outline" className="gap-1">
                                <RefreshCw className="h-3 w-3" />
                                Auto-renouvellement
                              </Badge>
                            )}
                            {isExpiringSoon && (
                              <Badge variant="secondary" className="gap-1 text-orange-500">
                                <AlertCircle className="h-3 w-3" />
                                {daysUntilExpiry} jours
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

          {/* Domains Tab */}
          <TabsContent value="domains" className="space-y-4">
            {(() => {
              // Group routes by domain
              const domainMap = new Map<string, typeof routes>();
              (routes || []).forEach(route => {
                const parts = route.host.split('.');
                const domain = parts.length >= 2
                  ? parts.slice(-2).join('.')
                  : route.host;
                if (!domainMap.has(domain)) {
                  domainMap.set(domain, []);
                }
                domainMap.get(domain)!.push(route);
              });

              if (domainMap.size === 0) {
                return (
                  <div className="py-12 text-center text-muted-foreground">
                    Aucune route configurée
                  </div>
                );
              }

              return Array.from(domainMap.entries()).map(([domain, domainRoutes]) => (
                <Card key={domain}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-lg">{domain}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {domainRoutes.length} route{domainRoutes.length > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {domainRoutes.some(r => r.tls_enabled) && (
                          <Badge className="bg-green-500/10 text-green-600">
                            SSL Active
                          </Badge>
                        )}
                        {domainRoutes.some(r => r.dns_records && r.dns_records.length > 0) && (
                          <Badge variant="outline">DNS</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {domainRoutes.map(route => (
                        <div
                          key={route.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-2 w-2 rounded-full ${route.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                            <div>
                              <p className="text-sm font-medium">{route.host}</p>
                              <p className="text-xs text-muted-foreground">
                                {route.mode} → {route.target}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={route.enabled ? 'default' : 'secondary'} className="text-xs">
                              {route.enabled ? 'Active' : 'Désactivée'}
                            </Badge>
                            {route.tls_enabled && (
                              <Badge variant="outline" className="text-xs">TLS</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {domainRoutes.some(r => r.dns_records && r.dns_records.length > 0) && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-medium mb-2">Enregistrements DNS</h4>
                        <div className="space-y-1">
                          {domainRoutes.flatMap(r => (r.dns_records || []).map((record, i) => (
                            <div key={`${r.id}-dns-${i}`} className="flex items-center gap-3 text-sm">
                              <Badge variant="outline" className="text-xs w-16 justify-center">{record.type}</Badge>
                              <span className="font-mono text-xs">{record.name}</span>
                              <span className="text-muted-foreground">&rarr;</span>
                              <span className="font-mono text-xs">{record.value}</span>
                            </div>
                          )))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ));
            })()}
          </TabsContent>

          {/* Shield Tab */}
          <TabsContent value="shield" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                      <Globe className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Requêtes</p>
                      <p className="text-2xl font-bold">
                        {(shieldStats?.requests_total ?? 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
                      <Shield className="h-6 w-6 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Requêtes Bloquées</p>
                      <p className="text-2xl font-bold">
                        {(shieldStats?.requests_blocked ?? 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10">
                      <AlertCircle className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Règles Actives</p>
                      <p className="text-2xl font-bold">
                        {shieldStats?.active_rules ?? 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Routes avec SmartShield</CardTitle>
                <CardDescription>
                  Routes protégées par le rate limiting et la protection DDoS
                </CardDescription>
              </CardHeader>
              <CardContent>
                {routes.filter(r => r.shield_config?.enabled).length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Aucune route avec SmartShield activé. Activez la protection dans les paramètres de chaque route.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {routes.filter(r => r.shield_config?.enabled).map((route) => (
                      <div
                        key={route.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-orange-500" />
                          <div>
                            <p className="font-medium">{route.host}</p>
                            <p className="text-sm text-muted-foreground">{route.name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-right">
                            <p className="font-medium">{route.shield_config?.requests_per_second} req/s</p>
                            <p className="text-muted-foreground">Rate limit</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{route.shield_config?.burst_size}</p>
                            <p className="text-muted-foreground">Burst</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(route)}
                          >
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

      {/* Route Dialog */}
      <RouteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        route={editingRoute}
        onSuccess={refreshData}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, route: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la route</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la route &quot;{deleteDialog.route?.name}&quot; ?
              Cette action est irréversible.
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

      {/* Request Certificate Dialog */}
      <Dialog open={certDialogOpen} onOpenChange={setCertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demander un certificat SSL</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domaine</Label>
              <Input
                id="domain"
                placeholder="exemple.com ou *.exemple.com"
                value={certDomain}
                onChange={(e) => setCertDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Un certificat Let&apos;s Encrypt sera émis pour ce domaine.
                Utilisez * pour un certificat wildcard.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCertDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleRequestCertificate} disabled={certLoading || !certDomain.trim()}>
              {certLoading && <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />}
              Demander
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
