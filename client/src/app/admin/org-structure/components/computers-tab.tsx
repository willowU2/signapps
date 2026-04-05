"use client";

import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Monitor } from "lucide-react";
import { useAdDomains, useAdComputers } from "@/hooks/use-active-directory";
import type { ComputerAccount } from "@/types/active-directory";

// =============================================================================
// ComputersTabContent
// =============================================================================

export function ComputersTabContent({ nodeId: _nodeId }: { nodeId: string }) {
  const {
    data: domains = [],
    isLoading: domainsLoading,
    isError: domainsError,
  } = useAdDomains();
  const domainId = domains[0]?.id ?? "";
  const {
    data: computers = [],
    isLoading: computersLoading,
    isError: computersError,
  } = useAdComputers(domainId);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return computers;
    const q = search.toLowerCase();
    return computers.filter(
      (c: ComputerAccount) =>
        c.name.toLowerCase().includes(q) ||
        (c.dns_hostname ?? "").toLowerCase().includes(q),
    );
  }, [computers, search]);

  if (domainsLoading || (domainId && computersLoading)) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Chargement...</span>
      </div>
    );
  }

  if (domainsError || computersError) {
    return (
      <div className="text-center text-destructive py-8">
        <Monitor className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Erreur lors du chargement des données AD</p>
      </div>
    );
  }

  if (!domainId) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Monitor className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucun domaine AD configure</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Rechercher un ordinateur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm max-w-xs"
        />
        <Badge variant="outline" className="text-xs">
          {filtered.length} machine(s)
        </Badge>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-6">
          <Monitor className="h-6 w-6 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Aucun ordinateur dans cette OU</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nom</TableHead>
                <TableHead className="text-xs">Hostname DNS</TableHead>
                <TableHead className="text-xs">OS</TableHead>
                <TableHead className="text-xs">Derniere connexion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: ComputerAccount) => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm font-medium">
                    {c.name}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {c.dns_hostname ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {c.os ?? "Inconnu"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.last_logon
                      ? new Date(c.last_logon).toLocaleDateString("fr-FR")
                      : "Jamais"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
