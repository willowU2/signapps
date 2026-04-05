"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Loader2 } from "lucide-react";
import { useAdDomains, useAdGpos } from "@/hooks/use-active-directory";
import type { GroupPolicyObject } from "@/types/active-directory";

// =============================================================================
// GpoTabContent
// =============================================================================

export function GpoTabContent({ nodeId: _nodeId }: { nodeId: string }) {
  const {
    data: domains = [],
    isLoading: domainsLoading,
    isError: domainsError,
  } = useAdDomains();
  const domainId = domains[0]?.id ?? "";
  const {
    data: gpos = [],
    isLoading: gposLoading,
    isError: gposError,
  } = useAdGpos(domainId);

  if (domainsLoading || (domainId && gposLoading)) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Chargement...</span>
      </div>
    );
  }

  if (domainsError || gposError) {
    return (
      <div className="text-center text-destructive py-8">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Erreur lors du chargement des donnees AD</p>
      </div>
    );
  }

  if (!domainId) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucun domaine AD configure</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {gpos.length} GPO(s)
        </Badge>
      </div>
      {gpos.length === 0 ? (
        <div className="text-center text-muted-foreground py-6">
          <FileText className="h-6 w-6 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Aucune strategie de groupe</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nom</TableHead>
                <TableHead className="text-xs">Version</TableHead>
                <TableHead className="text-xs">Machine</TableHead>
                <TableHead className="text-xs">User</TableHead>
                <TableHead className="text-xs">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gpos.map((g: GroupPolicyObject) => (
                <TableRow key={g.id}>
                  <TableCell className="text-sm font-medium">
                    {g.display_name}
                  </TableCell>
                  <TableCell className="text-xs">v{g.version}</TableCell>
                  <TableCell>
                    <Badge
                      variant={g.machine_enabled ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {g.machine_enabled ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={g.user_enabled ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {g.user_enabled ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={g.enabled ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {g.enabled ? "Active" : "Desactivee"}
                    </Badge>
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
