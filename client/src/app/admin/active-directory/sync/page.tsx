"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  Server,
  Users,
  FolderTree,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Hourglass,
  RotateCcw,
  GitMerge,
} from "lucide-react";
import { adApi } from "@/lib/api/active-directory";
import { toast } from "sonner";
import type {
  AdSyncQueueStats,
  AdSyncEvent,
  AdOu,
  AdUserAccountInfo,
  AdDcSiteInfo,
  ReconcileReport,
} from "@/types/active-directory";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SYNC_STATUS_COLORS: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  processing:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  completed:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  failed:
    "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  dead: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  retry:
    "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  synced:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  error:
    "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  orphan:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
};

const SYNC_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  processing: "En cours",
  completed: "Termine",
  failed: "Echec",
  dead: "Mort",
  retry: "Relance",
  synced: "Synchronise",
  error: "Erreur",
  orphan: "Orphelin",
  disabled: "Desactive",
};

function SyncBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium ${SYNC_STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {SYNC_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

// ── Stats Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
}

function StatCard({ label, value, icon, colorClass }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <div className={colorClass}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdSyncPage() {
  usePageTitle("Synchronisation AD");

  const [domainId, setDomainId] = useState("");
  const [reconciling, setReconciling] = useState(false);

  // Load domains
  const {
    data: domains = [],
    isLoading: loadingDomains,
    isError: domainsError,
    refetch: refetchDomains,
  } = useQuery({
    queryKey: ["ad-domains"],
    queryFn: async () => {
      const res = await adApi.domains.list();
      return res.data;
    },
    staleTime: 60_000,
  });

  const activeDomainId = domainId || domains[0]?.id || "";

  // Queue stats — auto-refresh every 10 seconds
  const {
    data: queueStats,
    isLoading: loadingStats,
    refetch: refetchStats,
  } = useQuery<AdSyncQueueStats>({
    queryKey: ["ad-sync-stats", activeDomainId],
    queryFn: async () => {
      const res = await adApi.sync.queueStats(activeDomainId);
      return res.data;
    },
    enabled: !!activeDomainId,
    refetchInterval: 10_000,
  });

  // Sync events
  const {
    data: events = [],
    isLoading: loadingEvents,
    refetch: refetchEvents,
  } = useQuery<AdSyncEvent[]>({
    queryKey: ["ad-sync-events", activeDomainId],
    queryFn: async () => {
      const res = await adApi.sync.events(activeDomainId);
      return res.data;
    },
    enabled: !!activeDomainId,
    refetchInterval: 10_000,
  });

  // AD OUs
  const {
    data: ous = [],
    isLoading: loadingOus,
    refetch: refetchOus,
  } = useQuery<AdOu[]>({
    queryKey: ["ad-ous", activeDomainId],
    queryFn: async () => {
      const res = await adApi.sync.ous(activeDomainId);
      return res.data;
    },
    enabled: !!activeDomainId,
  });

  // AD Users
  const {
    data: users = [],
    isLoading: loadingUsers,
    refetch: refetchUsers,
  } = useQuery<AdUserAccountInfo[]>({
    queryKey: ["ad-users", activeDomainId],
    queryFn: async () => {
      const res = await adApi.sync.users(activeDomainId);
      return res.data;
    },
    enabled: !!activeDomainId,
  });

  // DC Sites
  const {
    data: dcSites = [],
    isLoading: loadingDcSites,
    refetch: refetchDcSites,
  } = useQuery<AdDcSiteInfo[]>({
    queryKey: ["ad-dc-sites", activeDomainId],
    queryFn: async () => {
      const res = await adApi.sync.dcSites(activeDomainId);
      return res.data;
    },
    enabled: !!activeDomainId,
  });

  function handleRefreshAll() {
    refetchStats();
    refetchEvents();
    refetchOus();
    refetchUsers();
    refetchDcSites();
  }

  async function handleReconcile() {
    setReconciling(true);
    try {
      const res = await adApi.sync.reconcile();
      const report = res.data as ReconcileReport;
      const parts: string[] = [];
      if (report.ous_created)
        parts.push(`${report.ous_created} OU(s) creee(s)`);
      if (report.ous_updated)
        parts.push(`${report.ous_updated} OU(s) mise(s) a jour`);
      if (report.users_created)
        parts.push(`${report.users_created} utilisateur(s) cree(s)`);
      if (report.users_updated)
        parts.push(`${report.users_updated} utilisateur(s) mis a jour`);
      if (report.users_disabled)
        parts.push(`${report.users_disabled} utilisateur(s) desactive(s)`);
      const summary =
        parts.length > 0 ? parts.join(", ") : "Aucun changement detecte";
      toast.success(`Reconciliation terminee — ${summary}`);
      handleRefreshAll();
    } catch {
      toast.error("Echec de la reconciliation");
    } finally {
      setReconciling(false);
    }
  }

  // Auto-set domain when domains load
  useEffect(() => {
    if (domains.length > 0 && !domainId) {
      setDomainId(domains[0].id);
    }
  }, [domains, domainId]);

  const isLoadingAny =
    loadingStats ||
    loadingEvents ||
    loadingOus ||
    loadingUsers ||
    loadingDcSites;

  const breadcrumb = [
    { label: "Administration", href: "/admin" },
    { label: "Active Directory", href: "/admin/active-directory" },
    { label: "Synchronisation" },
  ];

  if (loadingDomains) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageBreadcrumb items={breadcrumb} />
          <PageHeader
            title="Synchronisation AD"
            description="Etat de la file de synchronisation org vers Active Directory"
            icon={<RefreshCw className="h-5 w-5" />}
          />
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (domainsError) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageBreadcrumb items={breadcrumb} />
          <PageHeader
            title="Synchronisation AD"
            description="Etat de la file de synchronisation org vers Active Directory"
            icon={<RefreshCw className="h-5 w-5" />}
          />
          <div className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-sm font-medium">Erreur de chargement</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => refetchDomains()}
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Reessayer
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumb items={breadcrumb} />
        <PageHeader
          title="Synchronisation AD"
          description="Etat de la file de synchronisation org vers Active Directory"
          icon={<RefreshCw className="h-5 w-5" />}
          actions={
            <div className="flex items-center gap-2">
              {domains.length > 0 && (
                <Select value={activeDomainId} onValueChange={setDomainId}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Selectionner un domaine" />
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.dns_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleReconcile}
                disabled={reconciling || !activeDomainId}
              >
                {reconciling ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <GitMerge className="h-4 w-4 mr-2" />
                )}
                Reconcilier
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshAll}
                disabled={isLoadingAny}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isLoadingAny ? "animate-spin" : ""}`}
                />
                Rafraichir
              </Button>
            </div>
          }
        />

        {/* No domains */}
        {domains.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium">
                Aucun domaine Active Directory configure
              </p>
              <p className="text-sm mt-1">
                Configurez un domaine depuis la page Active Directory.
              </p>
            </CardContent>
          </Card>
        )}

        {activeDomainId && (
          <>
            {/* Queue Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard
                label="En attente"
                value={queueStats?.pending ?? 0}
                icon={<Hourglass className="h-4 w-4" />}
                colorClass="text-amber-500"
              />
              <StatCard
                label="En cours"
                value={queueStats?.processing ?? 0}
                icon={<Activity className="h-4 w-4" />}
                colorClass="text-blue-500"
              />
              <StatCard
                label="Termines"
                value={queueStats?.completed ?? 0}
                icon={<CheckCircle className="h-4 w-4" />}
                colorClass="text-emerald-500"
              />
              <StatCard
                label="Echecs"
                value={queueStats?.failed ?? 0}
                icon={<XCircle className="h-4 w-4" />}
                colorClass="text-red-500"
              />
              <StatCard
                label="Relances"
                value={queueStats?.retry ?? 0}
                icon={<RotateCcw className="h-4 w-4" />}
                colorClass="text-orange-500"
              />
            </div>

            {/* Recent Sync Events */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Evenements recents
                    </CardTitle>
                    <CardDescription>
                      {events.length} evenement(s) — rafraichissement
                      automatique
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingEvents ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin" />
                    Chargement...
                  </div>
                ) : events.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm">
                    <Clock className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    Aucun evenement dans la file.
                  </div>
                ) : (
                  <div className="rounded-b-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[140px]">Type</TableHead>
                          <TableHead className="w-[100px]">Statut</TableHead>
                          <TableHead className="w-[60px] text-right">
                            Prio
                          </TableHead>
                          <TableHead className="w-[60px] text-right">
                            Essais
                          </TableHead>
                          <TableHead>Message d&apos;erreur</TableHead>
                          <TableHead className="w-[140px]">Cree le</TableHead>
                          <TableHead className="w-[140px]">Traite le</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {events.map((ev) => (
                          <TableRow key={ev.id}>
                            <TableCell>
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {ev.event_type}
                              </code>
                            </TableCell>
                            <TableCell>
                              <SyncBadge status={ev.status} />
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {ev.priority}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {ev.attempts}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[260px] truncate">
                              {ev.error_message ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(ev.created_at)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {ev.processed_at
                                ? formatDate(ev.processed_at)
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AD OUs */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <FolderTree className="h-4 w-4" />
                  Unites Organisationnelles (OUs)
                </CardTitle>
                <CardDescription>
                  {ous.length} OU(s) synchronisee(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingOus ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin" />
                    Chargement...
                  </div>
                ) : ous.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm">
                    <FolderTree className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    Aucune OU synchronisee pour ce domaine.
                  </div>
                ) : (
                  <div className="rounded-b-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Distinguished Name</TableHead>
                          <TableHead className="w-[120px]">Statut</TableHead>
                          <TableHead className="w-[80px]">Mail dist.</TableHead>
                          <TableHead className="w-[160px]">
                            Derniere sync
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ous.map((ou) => (
                          <TableRow key={ou.id}>
                            <TableCell className="font-mono text-xs max-w-[400px] truncate">
                              {ou.distinguished_name}
                            </TableCell>
                            <TableCell>
                              <SyncBadge status={ou.sync_status} />
                            </TableCell>
                            <TableCell>
                              {ou.mail_distribution_enabled ? (
                                <CheckCircle className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {ou.last_synced_at
                                ? formatDate(ou.last_synced_at)
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AD Users */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Comptes Utilisateurs AD
                </CardTitle>
                <CardDescription>
                  {users.length} compte(s) provisionne(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingUsers ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin" />
                    Chargement...
                  </div>
                ) : users.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground text-sm">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    Aucun compte utilisateur synchronise.
                  </div>
                ) : (
                  <div className="rounded-b-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>SAM</TableHead>
                          <TableHead>UPN</TableHead>
                          <TableHead>Mail</TableHead>
                          <TableHead className="w-[100px]">Statut</TableHead>
                          <TableHead className="w-[80px]">Actif</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium text-sm">
                              <div>{u.display_name}</div>
                              {u.title && (
                                <div className="text-xs text-muted-foreground">
                                  {u.title}
                                  {u.department ? ` — ${u.department}` : ""}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {u.sam_account_name}
                              </code>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {u.user_principal_name}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {u.mail ?? "—"}
                            </TableCell>
                            <TableCell>
                              <SyncBadge status={u.sync_status} />
                            </TableCell>
                            <TableCell>
                              {u.is_enabled ? (
                                <CheckCircle className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* DC Sites */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Server className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium text-sm">
                  Controleurs de domaine ({dcSites.length})
                </h3>
              </div>
              {loadingDcSites ? (
                <div className="py-8 text-center text-muted-foreground">
                  <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin" />
                  Chargement...
                </div>
              ) : dcSites.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-muted-foreground text-sm">
                    <Server className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    Aucun controleur de domaine enregistre.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dcSites.map((dc) => (
                    <Card key={dc.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Server className="h-4 w-4 text-muted-foreground" />
                            {dc.dc_hostname}
                          </CardTitle>
                          <SyncBadge status={dc.dc_status} />
                        </div>
                        <CardDescription className="font-mono text-xs">
                          {dc.dc_ip}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Role</span>
                            <Badge variant="outline" className="text-[10px]">
                              {dc.dc_role}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Ecriture
                            </span>
                            <span>
                              {dc.is_writable ? (
                                <CheckCircle className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </span>
                          </div>
                          {dc.is_primary && (
                            <div className="mt-1">
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-primary/10 text-primary border-primary/20"
                              >
                                Primaire
                              </Badge>
                            </div>
                          )}
                          {dc.last_heartbeat_at && (
                            <div className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border">
                              Derniere activite :{" "}
                              {formatDate(dc.last_heartbeat_at)}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
