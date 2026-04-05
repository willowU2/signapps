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
import { Globe, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAdDomains,
  useAdDnsZones,
  useAdDnsRecords,
} from "@/hooks/use-active-directory";
import type { AdDnsRecord } from "@/types/active-directory";

// =============================================================================
// DnsTabContent
// =============================================================================

const TYPE_COLORS: Record<string, string> = {
  A: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  AAAA: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  SRV: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CNAME:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  TXT: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  MX: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  NS: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  PTR: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

function formatRdata(record: AdDnsRecord): string {
  const r = record.rdata;
  switch (record.record_type) {
    case "SRV":
      return `${r.priority} ${r.weight} ${r.port} ${r.target}`;
    case "MX":
      return `${r.preference} ${r.exchange}`;
    case "A":
    case "AAAA":
      return String(r.ip || "");
    case "CNAME":
    case "PTR":
    case "NS":
      return String(r.target || "");
    case "TXT":
      return String(r.text || "");
    default:
      return JSON.stringify(r);
  }
}

export function DnsTabContent({
  nodeId: _nodeId,
  nodeType: _nodeType,
}: {
  nodeId: string;
  nodeType: string;
}) {
  const {
    data: domains = [],
    isLoading: domainsLoading,
    isError: domainsError,
  } = useAdDomains();
  const domainId = domains[0]?.id || "";
  const {
    data: zones = [],
    isLoading: zonesLoading,
    isError: zonesError,
  } = useAdDnsZones(domainId);
  const zoneId = zones[0]?.id || "";
  const {
    data: records = [],
    isLoading: recordsLoading,
    isError: recordsError,
  } = useAdDnsRecords(zoneId);

  if (
    domainsLoading ||
    (domainId && zonesLoading) ||
    (zoneId && recordsLoading)
  ) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Chargement...</span>
      </div>
    );
  }

  if (domainsError || zonesError || recordsError) {
    return (
      <div className="text-center text-destructive py-8">
        <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Erreur lors du chargement des donnees DNS</p>
      </div>
    );
  }

  if (!domainId) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucun domaine AD configure</p>
      </div>
    );
  }

  if (!zoneId) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucune zone DNS configuree pour ce domaine</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {zones[0]?.zone_name}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {records.length} record(s)
        </Badge>
      </div>
      {records.length === 0 ? (
        <div className="text-center text-muted-foreground py-6">
          <Globe className="h-6 w-6 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Aucun enregistrement DNS</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nom</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Donnees</TableHead>
                <TableHead className="text-xs">TTL</TableHead>
                <TableHead className="text-xs">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r: AdDnsRecord) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs font-mono">{r.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px]",
                        TYPE_COLORS[r.record_type] || "",
                      )}
                    >
                      {r.record_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground max-w-[200px] truncate">
                    {formatRdata(r)}
                  </TableCell>
                  <TableCell className="text-xs">{r.ttl}s</TableCell>
                  <TableCell>
                    <Badge
                      variant={r.is_static ? "outline" : "secondary"}
                      className="text-[10px]"
                    >
                      {r.is_static ? "Statique" : "Dynamique"}
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
