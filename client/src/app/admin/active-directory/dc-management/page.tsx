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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Server,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Plus,
  CheckCircle,
  XCircle,
  ArrowRightLeft,
} from "lucide-react";
import { adApi } from "@/lib/api/active-directory";
import { useAdDomains } from "@/hooks/use-active-directory";
import { toast } from "sonner";
import type { AdDcSiteInfo } from "@/types/active-directory";

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

const DC_ROLE_COLORS: Record<string, string> = {
  primary_rwdc:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  rwdc: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  rodc: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
};

const DC_ROLE_LABELS: Record<string, string> = {
  primary_rwdc: "RWDC Primaire",
  rwdc: "RWDC",
  rodc: "RODC",
};

const DC_STATUS_COLORS: Record<string, string> = {
  online:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  degraded:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  offline:
    "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  provisioning:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
};

const DC_STATUS_LABELS: Record<string, string> = {
  online: "En ligne",
  degraded: "Degrade",
  offline: "Hors ligne",
  provisioning: "Provisionnement",
};

const FSMO_ROLES = [
  { key: "schema_master", label: "Schema Master" },
  { key: "domain_naming", label: "Domain Naming Master" },
  { key: "rid_master", label: "RID Master" },
  { key: "pdc_emulator", label: "PDC Emulator" },
  { key: "infrastructure_master", label: "Infrastructure Master" },
] as const;

type FsmoRoleKey = (typeof FSMO_ROLES)[number]["key"];

function DcRoleBadge({ role }: { role: string }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium ${DC_ROLE_COLORS[role] ?? "bg-muted text-muted-foreground"}`}
    >
      {DC_ROLE_LABELS[role] ?? role}
    </Badge>
  );
}

function DcStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium ${DC_STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {DC_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function DcManagementPage() {
  usePageTitle("Domain Controllers — Active Directory");

  const [domainId, setDomainId] = useState("");

  // Promote dialog
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteForm, setPromoteForm] = useState({
    hostname: "",
    ip: "",
    site_id: "",
    role: "rwdc",
  });
  const [promoting, setPromoting] = useState(false);

  // Transfer FSMO dialog
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferRole, setTransferRole] = useState<FsmoRoleKey>("pdc_emulator");
  const [transferDcId, setTransferDcId] = useState("");
  const [transferring, setTransferring] = useState(false);

  const {
    data: domains = [],
    isLoading: loadingDomains,
    isError: domainsError,
    refetch: refetchDomains,
  } = useAdDomains();

  const activeDomainId = domainId || domains[0]?.id || "";

  const {
    data: dcSites = [],
    isLoading: loadingDcs,
    refetch: refetchDcs,
  } = useQuery<AdDcSiteInfo[]>({
    queryKey: ["ad-dc-sites", activeDomainId],
    queryFn: async () => {
      const res = await adApi.sync.dcSites(activeDomainId);
      return res.data;
    },
    enabled: !!activeDomainId,
  });

  useEffect(() => {
    if (domains.length > 0 && !domainId) {
      setDomainId(domains[0].id);
    }
  }, [domains, domainId]);

  async function handlePromote() {
    if (!promoteForm.hostname.trim() || !promoteForm.ip.trim()) return;
    setPromoting(true);
    try {
      await adApi.sync.promoteDc(activeDomainId, {
        hostname: promoteForm.hostname.trim(),
        ip: promoteForm.ip.trim(),
        role: promoteForm.role,
        ...(promoteForm.site_id.trim()
          ? { site_id: promoteForm.site_id.trim() }
          : {}),
      });
      toast.success(`Controleur de domaine ${promoteForm.hostname} promu`);
      setPromoteOpen(false);
      setPromoteForm({ hostname: "", ip: "", site_id: "", role: "rwdc" });
      refetchDcs();
    } catch {
      toast.error("Echec de la promotion du controleur de domaine");
    } finally {
      setPromoting(false);
    }
  }

  async function handleDemote(dc: AdDcSiteInfo) {
    if (
      !window.confirm(
        `Retrograder le controleur "${dc.dc_hostname}" ? Cette operation necessite une intervention manuelle pour finaliser la demtion.`,
      )
    )
      return;
    try {
      await adApi.sync.demoteDc(dc.id);
      toast.success(`Retrogradation de ${dc.dc_hostname} initiee`);
      refetchDcs();
    } catch {
      toast.error("Echec de la retrogradation");
    }
  }

  async function handleTransferFsmo() {
    if (!transferDcId) return;
    setTransferring(true);
    try {
      await adApi.sync.transferFsmo(activeDomainId, {
        role: transferRole,
        dc_id: transferDcId,
      });
      const roleLabel =
        FSMO_ROLES.find((r) => r.key === transferRole)?.label ?? transferRole;
      toast.success(`Role ${roleLabel} transfere avec succes`);
      setTransferOpen(false);
      setTransferDcId("");
      refetchDcs();
    } catch {
      toast.error("Echec du transfert FSMO");
    } finally {
      setTransferring(false);
    }
  }

  const breadcrumb = [
    { label: "Administration", href: "/admin" },
    { label: "Active Directory", href: "/admin/active-directory" },
    { label: "Domain Controllers" },
  ];

  if (loadingDomains) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageBreadcrumb items={breadcrumb} />
          <PageHeader
            title="Domain Controllers"
            description="Topologie DC, roles FSMO et gestion des controleurs de domaine"
            icon={<Server className="h-5 w-5" />}
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
            title="Domain Controllers"
            description="Topologie DC, roles FSMO et gestion des controleurs de domaine"
            icon={<Server className="h-5 w-5" />}
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
          title="Domain Controllers"
          description="Topologie DC, roles FSMO et gestion des controleurs de domaine"
          icon={<Server className="h-5 w-5" />}
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
                onClick={() => refetchDcs()}
                disabled={loadingDcs}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loadingDcs ? "animate-spin" : ""}`}
                />
                Rafraichir
              </Button>
              {activeDomainId && (
                <Button size="sm" onClick={() => setPromoteOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Promouvoir un DC
                </Button>
              )}
            </div>
          }
        />

        {/* No domains */}
        {domains.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-4 opacity-20" />
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
            {/* DC Site Cards */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  Controleurs de domaine ({dcSites.length})
                </h3>
              </div>

              {loadingDcs ? (
                <div className="py-10 text-center text-muted-foreground">
                  <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin" />
                  Chargement...
                </div>
              ) : dcSites.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground text-sm">
                    <Server className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    Aucun controleur de domaine enregistre.
                    <br />
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setPromoteOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Promouvoir un DC
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dcSites.map((dc) => (
                    <Card key={dc.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="truncate">{dc.dc_hostname}</span>
                          </CardTitle>
                          <DcStatusBadge status={dc.dc_status} />
                        </div>
                        <CardDescription className="font-mono text-xs">
                          {dc.dc_ip}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Role</span>
                            <DcRoleBadge role={dc.dc_role} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Ecriture
                            </span>
                            {dc.is_writable ? (
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          {dc.last_heartbeat_at && (
                            <div className="text-xs text-muted-foreground pt-1 border-t border-border">
                              Derniere activite :{" "}
                              {formatDate(dc.last_heartbeat_at)}
                            </div>
                          )}
                          <div className="pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs h-7 text-destructive hover:text-destructive"
                              onClick={() => handleDemote(dc)}
                              disabled={dc.dc_role === "primary_rwdc"}
                            >
                              Retrograder
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* FSMO Roles */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4" />
                      Roles FSMO
                    </CardTitle>
                    <CardDescription>
                      Flexible Single Master Operations — 5 roles uniques
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTransferDcId(dcSites[0]?.id ?? "");
                      setTransferOpen(true);
                    }}
                    disabled={dcSites.length === 0}
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Transferer un role
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-b-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role FSMO</TableHead>
                        <TableHead>Titulaire actuel</TableHead>
                        <TableHead className="w-[120px] text-right">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {FSMO_ROLES.map((role) => {
                        // Find DC holding this role — in practice the backend
                        // would return this; we show the primary_rwdc as
                        // default holder when role data is not granular.
                        const holder =
                          dcSites.find(
                            (dc) =>
                              dc.dc_role === "primary_rwdc" || dc.is_primary,
                          ) ?? dcSites[0];
                        return (
                          <TableRow key={role.key}>
                            <TableCell className="font-medium text-sm">
                              {role.label}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {holder ? (
                                <span className="flex items-center gap-1.5">
                                  <Server className="h-3.5 w-3.5" />
                                  {holder.dc_hostname}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={dcSites.length < 2}
                                onClick={() => {
                                  setTransferRole(role.key);
                                  setTransferDcId(
                                    dcSites.find((dc) => !dc.is_primary)?.id ??
                                      dcSites[0]?.id ??
                                      "",
                                  );
                                  setTransferOpen(true);
                                }}
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                                Transferer
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Promote DC Dialog */}
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Promouvoir un controleur de domaine</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dc-hostname">
                Nom d&apos;hote <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dc-hostname"
                placeholder="dc02.corp.local"
                value={promoteForm.hostname}
                onChange={(e) =>
                  setPromoteForm((f) => ({ ...f, hostname: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dc-ip">
                Adresse IP <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dc-ip"
                placeholder="192.168.1.2"
                value={promoteForm.ip}
                onChange={(e) =>
                  setPromoteForm((f) => ({ ...f, ip: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dc-site">Site (optionnel)</Label>
              <Input
                id="dc-site"
                placeholder="ID du site AD"
                value={promoteForm.site_id}
                onChange={(e) =>
                  setPromoteForm((f) => ({ ...f, site_id: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dc-role">Role</Label>
              <Select
                value={promoteForm.role}
                onValueChange={(v) =>
                  setPromoteForm((f) => ({ ...f, role: v }))
                }
              >
                <SelectTrigger id="dc-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rwdc">
                    RWDC — Read-Write Domain Controller
                  </SelectItem>
                  <SelectItem value="rodc">
                    RODC — Read-Only Domain Controller
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPromoteOpen(false)}
              disabled={promoting}
            >
              Annuler
            </Button>
            <Button
              onClick={handlePromote}
              disabled={
                !promoteForm.hostname.trim() ||
                !promoteForm.ip.trim() ||
                promoting
              }
            >
              {promoting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Promouvoir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer FSMO Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transferer un role FSMO</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Role a transferer</Label>
              <Select
                value={transferRole}
                onValueChange={(v) => setTransferRole(v as FsmoRoleKey)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FSMO_ROLES.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Controleur de domaine cible</Label>
              <Select value={transferDcId} onValueChange={setTransferDcId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner un DC" />
                </SelectTrigger>
                <SelectContent>
                  {dcSites
                    .filter((dc) => dc.is_writable)
                    .map((dc) => (
                      <SelectItem key={dc.id} value={dc.id}>
                        {dc.dc_hostname} ({dc.dc_ip})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Seuls les DC inscriptibles (RWDC) peuvent recevoir un role FSMO.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferOpen(false)}
              disabled={transferring}
            >
              Annuler
            </Button>
            <Button
              onClick={handleTransferFsmo}
              disabled={!transferDcId || transferring}
            >
              {transferring && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Transferer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
