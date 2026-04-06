"use client";

import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Network,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  Plus,
  Trash2,
  Bookmark,
  Pencil,
} from "lucide-react";
import {
  useAdDomains,
  useDhcpScopes,
  useDhcpLeases,
} from "@/hooks/use-active-directory";
import { adApi } from "@/lib/api/active-directory";
import { toast } from "sonner";
import type { DhcpScope, DhcpReservation } from "@/types/active-directory";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Leases Panel ──────────────────────────────────────────────────────────────

function LeasesPanel({
  scope,
  onBack,
}: {
  scope: DhcpScope;
  onBack: () => void;
}) {
  const { data: leases = [], isLoading } = useDhcpLeases(scope.id);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <div>
            <CardTitle>
              Baux actifs — {scope.name}{" "}
              <span className="font-mono text-sm font-normal text-muted-foreground">
                ({scope.subnet})
              </span>
            </CardTitle>
            <CardDescription>
              Plage : {scope.range_start} — {scope.range_end}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">
            <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin" />
            Chargement...
          </div>
        ) : leases.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            <Network className="h-10 w-10 mx-auto mb-3 opacity-20" />
            Aucun bail actif pour cette plage.
          </div>
        ) : (
          <div className="rounded-b-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adresse IP</TableHead>
                  <TableHead>Adresse MAC</TableHead>
                  <TableHead>Hostname</TableHead>
                  <TableHead className="w-[160px]">Debut</TableHead>
                  <TableHead className="w-[160px]">Fin</TableHead>
                  <TableHead className="w-[80px]">Actif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leases.map((lease) => (
                  <TableRow key={lease.id}>
                    <TableCell className="font-mono text-sm">
                      {lease.ip_address}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {lease.mac_address}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lease.hostname ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(lease.lease_start)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(lease.lease_end)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          lease.is_active
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 text-[10px]"
                            : "bg-muted text-muted-foreground text-[10px]"
                        }
                      >
                        {lease.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Reservations Panel ────────────────────────────────────────────────────────

function ReservationsPanel({
  scope,
  onBack,
}: {
  scope: DhcpScope;
  onBack: () => void;
}) {
  const [reservations, setReservations] = useState<DhcpReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newReservation, setNewReservation] = useState({
    mac_address: "",
    ip_address: "",
    hostname: "",
    description: "",
  });

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const res = await adApi.dhcp.reservations(scope.id);
      setReservations(res.data);
    } catch {
      toast.error("Erreur lors du chargement des réservations");
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    void fetchReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.id]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await adApi.dhcp.createReservation(scope.id, {
        mac_address: newReservation.mac_address,
        ip_address: newReservation.ip_address,
        hostname: newReservation.hostname || undefined,
        description: newReservation.description || undefined,
      });
      toast.success("Réservation créée avec succès");
      setCreateOpen(false);
      setNewReservation({
        mac_address: "",
        ip_address: "",
        hostname: "",
        description: "",
      });
      void fetchReservations();
    } catch {
      toast.error("Erreur lors de la création de la réservation");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (reservation: DhcpReservation) => {
    if (
      !window.confirm(
        `Supprimer la réservation pour ${reservation.mac_address} (${reservation.ip_address}) ?`,
      )
    ) {
      return;
    }
    try {
      await adApi.dhcp.deleteReservation(reservation.id);
      toast.success("Réservation supprimée");
      void fetchReservations();
    } catch {
      toast.error("Erreur lors de la suppression de la réservation");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Retour
              </Button>
              <div>
                <CardTitle>
                  Réservations — {scope.name}{" "}
                  <span className="font-mono text-sm font-normal text-muted-foreground">
                    ({scope.subnet})
                  </span>
                </CardTitle>
                <CardDescription>
                  Plage : {scope.range_start} — {scope.range_end}
                </CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle réservation
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin" />
              Chargement...
            </div>
          ) : reservations.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Bookmark className="h-10 w-10 mx-auto mb-3 opacity-20" />
              Aucune réservation pour cette étendue.
            </div>
          ) : (
            <div className="rounded-b-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Adresse MAC</TableHead>
                    <TableHead>Adresse IP</TableHead>
                    <TableHead>Hostname</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">
                        {r.mac_address}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {r.ip_address}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.hostname ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.description ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(r)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Reservation Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle réservation DHCP</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="res-mac">Adresse MAC</Label>
              <Input
                id="res-mac"
                placeholder="AA:BB:CC:DD:EE:FF"
                value={newReservation.mac_address}
                onChange={(e) =>
                  setNewReservation((s) => ({
                    ...s,
                    mac_address: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="res-ip">Adresse IP</Label>
              <Input
                id="res-ip"
                placeholder="192.168.1.50"
                value={newReservation.ip_address}
                onChange={(e) =>
                  setNewReservation((s) => ({
                    ...s,
                    ip_address: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="res-hostname">Hostname (optionnel)</Label>
              <Input
                id="res-hostname"
                placeholder="ex: PC-COMPTA-01"
                value={newReservation.hostname}
                onChange={(e) =>
                  setNewReservation((s) => ({ ...s, hostname: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="res-desc">Description (optionnel)</Label>
              <Input
                id="res-desc"
                placeholder="ex: Imprimante RDC"
                value={newReservation.description}
                onChange={(e) =>
                  setNewReservation((s) => ({
                    ...s,
                    description: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                creating ||
                !newReservation.mac_address ||
                !newReservation.ip_address
              }
            >
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DhcpPage() {
  usePageTitle("DHCP — Active Directory");

  const [domainId, setDomainId] = useState("");
  const [selectedScope, setSelectedScope] = useState<DhcpScope | null>(null);
  const [selectedReservationScope, setSelectedReservationScope] =
    useState<DhcpScope | null>(null);

  // Edit scope dialog state
  const [editScopeOpen, setEditScopeOpen] = useState(false);
  const [editingScope, setEditingScope] = useState<DhcpScope | null>(null);
  const [editScopeData, setEditScopeData] = useState({
    name: "",
    gateway: "",
    lease_duration_hours: "24",
    pxe_server: "",
    pxe_bootfile: "",
  });
  const [editingScopeLoading, setEditingScopeLoading] = useState(false);

  // Create scope dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newScope, setNewScope] = useState({
    name: "",
    subnet: "",
    range_start: "",
    range_end: "",
    gateway: "",
    lease_duration_hours: "24",
  });

  const {
    data: domains = [],
    isLoading: loadingDomains,
    isError: domainsError,
    refetch: refetchDomains,
  } = useAdDomains();

  const activeDomainId = domainId || domains[0]?.id || "";

  const {
    data: scopes = [],
    isLoading: loadingScopes,
    refetch: refetchScopes,
  } = useDhcpScopes(activeDomainId);

  const handleDomainChange = (v: string) => {
    setDomainId(v);
    setSelectedScope(null);
    setSelectedReservationScope(null);
  };

  const handleCreateScope = async () => {
    if (!activeDomainId) return;
    setCreating(true);
    try {
      await adApi.dhcp.createScope(activeDomainId, {
        name: newScope.name,
        subnet: newScope.subnet,
        range_start: newScope.range_start,
        range_end: newScope.range_end,
        gateway: newScope.gateway || undefined,
        lease_duration_hours: parseInt(newScope.lease_duration_hours, 10),
      });
      toast.success("Étendue créée avec succès");
      setCreateOpen(false);
      setNewScope({
        name: "",
        subnet: "",
        range_start: "",
        range_end: "",
        gateway: "",
        lease_duration_hours: "24",
      });
      refetchScopes();
    } catch {
      toast.error("Erreur lors de la création de l'étendue");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEditScope = (scope: DhcpScope, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingScope(scope);
    setEditScopeData({
      name: scope.name,
      gateway: scope.gateway ?? "",
      lease_duration_hours: String(scope.lease_duration_hours),
      pxe_server:
        (scope as DhcpScope & { pxe_server?: string }).pxe_server ?? "",
      pxe_bootfile:
        (scope as DhcpScope & { pxe_bootfile?: string }).pxe_bootfile ?? "",
    });
    setEditScopeOpen(true);
  };

  const handleUpdateScope = async () => {
    if (!editingScope) return;
    setEditingScopeLoading(true);
    try {
      await adApi.dhcp.updateScope(editingScope.id, {
        name: editScopeData.name,
        gateway: editScopeData.gateway || undefined,
        lease_duration_hours: parseInt(editScopeData.lease_duration_hours, 10),
        ...(editScopeData.pxe_server
          ? { pxe_server: editScopeData.pxe_server }
          : {}),
        ...(editScopeData.pxe_bootfile
          ? { pxe_bootfile: editScopeData.pxe_bootfile }
          : {}),
      });
      toast.success(`Étendue "${editScopeData.name}" mise à jour`);
      setEditScopeOpen(false);
      setEditingScope(null);
      refetchScopes();
    } catch {
      toast.error("Erreur lors de la mise à jour de l'étendue");
    } finally {
      setEditingScopeLoading(false);
    }
  };

  const handleDeleteScope = async (scope: DhcpScope, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Supprimer l'étendue "${scope.name}" (${scope.subnet}) ? Cette action est irréversible.`,
      )
    ) {
      return;
    }
    try {
      await adApi.dhcp.deleteScope(scope.id);
      toast.success(`Étendue "${scope.name}" supprimée`);
      refetchScopes();
    } catch {
      toast.error("Erreur lors de la suppression de l'étendue");
    }
  };

  if (loadingDomains) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <PageBreadcrumb
            items={[
              { label: "Administration", href: "/admin" },
              { label: "Active Directory", href: "/admin/active-directory" },
              { label: "DHCP" },
            ]}
          />
          <PageHeader
            title="DHCP"
            description="Gestion des étendues et baux DHCP"
            icon={<Network className="h-5 w-5" />}
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
          <PageBreadcrumb
            items={[
              { label: "Administration", href: "/admin" },
              { label: "Active Directory", href: "/admin/active-directory" },
              { label: "DHCP" },
            ]}
          />
          <PageHeader
            title="DHCP"
            description="Gestion des étendues et baux DHCP"
            icon={<Network className="h-5 w-5" />}
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
        <PageBreadcrumb
          items={[
            { label: "Administration", href: "/admin" },
            { label: "Active Directory", href: "/admin/active-directory" },
            { label: "DHCP" },
          ]}
        />
        <PageHeader
          title="DHCP"
          description="Gestion des étendues et baux DHCP"
          icon={<Network className="h-5 w-5" />}
          actions={
            <div className="flex items-center gap-2">
              {domains.length > 0 && (
                <Select
                  value={activeDomainId}
                  onValueChange={handleDomainChange}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Sélectionner un domaine" />
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
              {activeDomainId && (
                <Button
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  disabled={loadingScopes}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle etendue
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchScopes()}
                disabled={loadingScopes}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loadingScopes ? "animate-spin" : ""}`}
                />
                Rafraichir
              </Button>
            </div>
          }
        />

        {/* Domain selector (body area) */}
        {domains.length > 1 && !selectedScope && !selectedReservationScope && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Domaine</Label>
            <Select value={activeDomainId} onValueChange={handleDomainChange}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Sélectionner un domaine" />
              </SelectTrigger>
              <SelectContent>
                {domains.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.dns_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Empty state — no domains */}
        {domains.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Network className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium">
                Aucun domaine Active Directory configure
              </p>
              <p className="text-sm mt-1">
                Configurez d&apos;abord un domaine depuis la page Active
                Directory.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Leases panel when a scope is selected */}
        {selectedScope ? (
          <LeasesPanel
            scope={selectedScope}
            onBack={() => setSelectedScope(null)}
          />
        ) : selectedReservationScope ? (
          <ReservationsPanel
            scope={selectedReservationScope}
            onBack={() => setSelectedReservationScope(null)}
          />
        ) : (
          /* Scopes table */
          activeDomainId && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Etendues DHCP</CardTitle>
                <CardDescription>
                  {scopes.length} étendue(s) — cliquez sur une ligne pour
                  afficher les baux
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingScopes ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="h-5 w-5 mx-auto mb-2 animate-spin" />
                    Chargement...
                  </div>
                ) : scopes.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    <Network className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    Aucune étendue DHCP pour ce domaine.
                  </div>
                ) : (
                  <div className="rounded-b-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom</TableHead>
                          <TableHead>Sous-réseau</TableHead>
                          <TableHead>Plage</TableHead>
                          <TableHead>Passerelle</TableHead>
                          <TableHead className="w-[120px]">
                            Durée bail
                          </TableHead>
                          <TableHead className="w-[80px]">Actif</TableHead>
                          <TableHead className="w-[80px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scopes.map((scope) => (
                          <TableRow
                            key={scope.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedScope(scope)}
                          >
                            <TableCell className="font-medium">
                              {scope.name}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {scope.subnet}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">
                              {scope.range_start} — {scope.range_end}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {scope.gateway ?? (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {scope.lease_duration_hours}h
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  scope.is_active
                                    ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 text-[10px]"
                                    : "bg-muted text-muted-foreground text-[10px]"
                                }
                              >
                                {scope.is_active ? "Actif" : "Inactif"}
                              </Badge>
                            </TableCell>
                            <TableCell
                              onClick={(e) => e.stopPropagation()}
                              className="text-right"
                            >
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  title="Réservations"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedReservationScope(scope);
                                  }}
                                >
                                  <Bookmark className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  title="Modifier l'étendue"
                                  onClick={(e) => handleOpenEditScope(scope, e)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => handleDeleteScope(scope, e)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* Create Scope Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle étendue DHCP</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="scope-name">Nom</Label>
              <Input
                id="scope-name"
                placeholder="ex: LAN-Bureau"
                value={newScope.name}
                onChange={(e) =>
                  setNewScope((s) => ({ ...s, name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="scope-subnet">Sous-réseau</Label>
              <Input
                id="scope-subnet"
                placeholder="ex: 192.168.1.0/24"
                value={newScope.subnet}
                onChange={(e) =>
                  setNewScope((s) => ({ ...s, subnet: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="scope-range-start">Début de plage</Label>
                <Input
                  id="scope-range-start"
                  placeholder="192.168.1.100"
                  value={newScope.range_start}
                  onChange={(e) =>
                    setNewScope((s) => ({ ...s, range_start: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="scope-range-end">Fin de plage</Label>
                <Input
                  id="scope-range-end"
                  placeholder="192.168.1.200"
                  value={newScope.range_end}
                  onChange={(e) =>
                    setNewScope((s) => ({ ...s, range_end: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="scope-gateway">Passerelle (optionnel)</Label>
              <Input
                id="scope-gateway"
                placeholder="192.168.1.1"
                value={newScope.gateway}
                onChange={(e) =>
                  setNewScope((s) => ({ ...s, gateway: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="scope-lease">Durée du bail (heures)</Label>
              <Input
                id="scope-lease"
                type="number"
                min="1"
                placeholder="24"
                value={newScope.lease_duration_hours}
                onChange={(e) =>
                  setNewScope((s) => ({
                    ...s,
                    lease_duration_hours: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreateScope}
              disabled={
                creating ||
                !newScope.name ||
                !newScope.subnet ||
                !newScope.range_start ||
                !newScope.range_end
              }
            >
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Edit Scope Dialog */}
      <Dialog open={editScopeOpen} onOpenChange={setEditScopeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier l&apos;étendue DHCP</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-scope-name">Nom</Label>
              <Input
                id="edit-scope-name"
                placeholder="ex: LAN-Bureau"
                value={editScopeData.name}
                onChange={(e) =>
                  setEditScopeData((s) => ({ ...s, name: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-scope-gateway">Passerelle (optionnel)</Label>
              <Input
                id="edit-scope-gateway"
                placeholder="192.168.1.1"
                value={editScopeData.gateway}
                onChange={(e) =>
                  setEditScopeData((s) => ({ ...s, gateway: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-scope-lease">Durée du bail (heures)</Label>
              <Input
                id="edit-scope-lease"
                type="number"
                min="1"
                placeholder="24"
                value={editScopeData.lease_duration_hours}
                onChange={(e) =>
                  setEditScopeData((s) => ({
                    ...s,
                    lease_duration_hours: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-scope-pxe-server">
                Serveur PXE (optionnel)
              </Label>
              <Input
                id="edit-scope-pxe-server"
                placeholder="ex: 192.168.1.10"
                value={editScopeData.pxe_server}
                onChange={(e) =>
                  setEditScopeData((s) => ({
                    ...s,
                    pxe_server: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-scope-pxe-bootfile">
                Fichier boot PXE (optionnel)
              </Label>
              <Input
                id="edit-scope-pxe-bootfile"
                placeholder="ex: pxelinux.0"
                value={editScopeData.pxe_bootfile}
                onChange={(e) =>
                  setEditScopeData((s) => ({
                    ...s,
                    pxe_bootfile: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditScopeOpen(false)}
              disabled={editingScopeLoading}
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpdateScope}
              disabled={editingScopeLoading || !editScopeData.name}
            >
              {editingScopeLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Pencil className="h-4 w-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
