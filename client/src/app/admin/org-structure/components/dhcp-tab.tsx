"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Loader2, Network } from "lucide-react";
import { adApi } from "@/lib/api/active-directory";
import type { DhcpScope, DhcpLease, AdDomain } from "@/types/active-directory";

// =============================================================================
// Types
// =============================================================================

interface ScopeWithLeases {
  scope: DhcpScope;
  leases: DhcpLease[];
}

// =============================================================================
// Helpers
// =============================================================================

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="secondary"
      className={
        active
          ? "text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "text-[10px] bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
      }
    >
      {active ? "Actif" : "Inactif"}
    </Badge>
  );
}

// =============================================================================
// LeasesTable — inner collapsible table for one scope
// =============================================================================

function LeasesTable({ leases }: { leases: DhcpLease[] }) {
  if (leases.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        <p className="text-xs">Aucun bail actif pour cette plage</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">Adresse IP</TableHead>
          <TableHead className="text-xs">Adresse MAC</TableHead>
          <TableHead className="text-xs">Nom d&apos;hote</TableHead>
          <TableHead className="text-xs">Debut bail</TableHead>
          <TableHead className="text-xs">Fin bail</TableHead>
          <TableHead className="text-xs">Actif</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leases.map((lease) => (
          <TableRow key={lease.id}>
            <TableCell className="text-xs font-mono">
              {lease.ip_address}
            </TableCell>
            <TableCell className="text-xs font-mono text-muted-foreground">
              {lease.mac_address}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {lease.hostname ?? "—"}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {formatDate(lease.lease_start)}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {formatDate(lease.lease_end)}
            </TableCell>
            <TableCell>
              <ActiveBadge active={lease.is_active} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// =============================================================================
// ScopeRow — collapsible row that reveals leases
// =============================================================================

function ScopeRow({ scopeWithLeases }: { scopeWithLeases: ScopeWithLeases }) {
  const [open, setOpen] = useState(false);
  const { scope, leases } = scopeWithLeases;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50 select-none">
          <TableCell>
            <div className="flex items-center gap-1.5">
              {open ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="text-xs font-medium">{scope.name}</span>
            </div>
          </TableCell>
          <TableCell className="text-xs font-mono">{scope.subnet}</TableCell>
          <TableCell className="text-xs font-mono text-muted-foreground">
            {scope.range_start} — {scope.range_end}
          </TableCell>
          <TableCell className="text-xs font-mono text-muted-foreground">
            {scope.gateway ?? "—"}
          </TableCell>
          <TableCell className="text-xs text-muted-foreground">
            {scope.lease_duration_hours}h
          </TableCell>
          <TableCell>
            <ActiveBadge active={scope.is_active} />
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <TableRow>
          <TableCell colSpan={6} className="p-0 bg-muted/30">
            <div className="px-6 py-2 border-t">
              <div className="flex items-center gap-2 mb-2 pt-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Baux actifs
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {leases.length}
                </Badge>
              </div>
              <LeasesTable leases={leases} />
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

// =============================================================================
// DhcpTabContent
// =============================================================================

export function DhcpTabContent({
  nodeId,
  nodeType,
}: {
  nodeId: string;
  nodeType: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopesWithLeases, setScopesWithLeases] = useState<ScopeWithLeases[]>(
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const domainsRes = await adApi.domains.list();
        const domains: AdDomain[] = domainsRes.data;

        if (!domains || domains.length === 0) {
          if (!cancelled) {
            setScopesWithLeases([]);
            setLoading(false);
          }
          return;
        }

        // Collect scopes across all domains
        const allScopes: DhcpScope[] = [];
        await Promise.all(
          domains.map(async (domain) => {
            try {
              const res = await adApi.dhcp.scopes(domain.id);
              allScopes.push(...(res.data ?? []));
            } catch {
              // Domain may not have DHCP enabled — skip silently
            }
          }),
        );

        // Filter scopes based on node context
        const filteredScopes = filterScopesForNode(allScopes, nodeId, nodeType);

        // Fetch leases for each filtered scope
        const results = await Promise.all(
          filteredScopes.map(async (scope): Promise<ScopeWithLeases> => {
            try {
              const res = await adApi.dhcp.leases(scope.id);
              const leases: DhcpLease[] = res.data ?? [];

              // For computer nodes: restrict leases to those matching the node
              if (nodeType === "computer") {
                const filtered = leases.filter(
                  (l) =>
                    l.hostname?.toLowerCase() === nodeId.toLowerCase() ||
                    l.hostname
                      ?.toLowerCase()
                      .startsWith(nodeId.toLowerCase() + "."),
                );
                return { scope, leases: filtered };
              }

              return { scope, leases };
            } catch {
              return { scope, leases: [] };
            }
          }),
        );

        if (!cancelled) {
          setScopesWithLeases(results);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Erreur de chargement DHCP",
          );
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [nodeId, nodeType]);

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Chargement DHCP...</span>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="text-center text-destructive py-8">
        <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Erreur lors du chargement des donnees DHCP</p>
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────────────

  if (scopesWithLeases.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucune plage DHCP configuree</p>
      </div>
    );
  }

  // ── Content ──────────────────────────────────────────────────────────────────

  const totalLeases = scopesWithLeases.reduce(
    (sum, s) => sum + s.leases.length,
    0,
  );

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {scopesWithLeases.length} plage(s)
        </Badge>
        <Badge variant="outline" className="text-xs">
          {totalLeases} bail(s)
        </Badge>
      </div>

      {/* Scopes table with expandable lease rows */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Plages DHCP
        </p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nom</TableHead>
                <TableHead className="text-xs">Sous-reseau</TableHead>
                <TableHead className="text-xs">Plage</TableHead>
                <TableHead className="text-xs">Passerelle</TableHead>
                <TableHead className="text-xs">Duree bail</TableHead>
                <TableHead className="text-xs">Actif</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scopesWithLeases.map((item) => (
                <ScopeRow key={item.scope.id} scopeWithLeases={item} />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// filterScopesForNode — scope selection logic per node type
// =============================================================================

function filterScopesForNode(
  scopes: DhcpScope[],
  nodeId: string,
  nodeType: string,
): DhcpScope[] {
  switch (nodeType) {
    case "site": // Show scopes associated with this site, fall back to all if none tagged
    {
      const siteScopes = scopes.filter((s) => s.site_id === nodeId);
      return siteScopes.length > 0 ? siteScopes : scopes;
    }

    case "computer":
      // For computer nodes we fetch all scopes, then filter leases inside ScopeRow
      return scopes;

    case "root":
    case "group":
    default:
      // Show everything
      return scopes;
  }
}
