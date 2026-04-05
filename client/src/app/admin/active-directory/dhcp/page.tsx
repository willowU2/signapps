"use client";

import { useState } from "react";
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
import {
  Network,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import {
  useAdDomains,
  useDhcpScopes,
  useDhcpLeases,
} from "@/hooks/use-active-directory";
import type { DhcpScope } from "@/types/active-directory";

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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DhcpPage() {
  usePageTitle("DHCP — Active Directory");

  const [domainId, setDomainId] = useState("");
  const [selectedScope, setSelectedScope] = useState<DhcpScope | null>(null);

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
        {domains.length > 1 && !selectedScope && (
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
    </AppLayout>
  );
}
