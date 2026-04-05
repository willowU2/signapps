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
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { adApi } from "@/lib/api/active-directory";
import type { InfraCertificate, AdDomain } from "@/types/active-directory";

// =============================================================================
// CertificatesTabContent
// =============================================================================

const CERT_TYPE_COLORS: Record<string, string> = {
  root_ca: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  intermediate_ca:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  server: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  client:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  wildcard:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const CERT_TYPE_LABELS: Record<string, string> = {
  root_ca: "Root CA",
  intermediate_ca: "Intermediate CA",
  server: "Server",
  client: "Client",
  wildcard: "Wildcard",
};

const STATUS_COLORS: Record<string, string> = {
  active:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  expired: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  revoked:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
};

/** Node types that warrant a full CA overview (all certs across all domains). */
const CA_OVERVIEW_TYPES = new Set(["root", "group"]);

export function CertificatesTabContent({
  nodeId: _nodeId,
  nodeType,
}: {
  nodeId: string;
  nodeType: string;
}) {
  const [certificates, setCertificates] = useState<InfraCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(false);

      try {
        const domainsRes = await adApi.domains.list();
        const domains: AdDomain[] = domainsRes.data ?? [];

        if (domains.length === 0) {
          if (!cancelled) {
            setCertificates([]);
            setLoading(false);
          }
          return;
        }

        const showAll = CA_OVERVIEW_TYPES.has(nodeType);

        const results = await Promise.all(
          domains.map((d) => adApi.certificates.list(d.id)),
        );

        const all = results.flatMap((r) => r.data ?? []);

        const filtered = showAll
          ? all
          : all.filter(
              (c) =>
                c.cert_type !== "root_ca" && c.cert_type !== "intermediate_ca",
            );

        if (!cancelled) {
          setCertificates(filtered);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [nodeType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Chargement...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-destructive py-8">
        <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Erreur lors du chargement des certificats</p>
      </div>
    );
  }

  if (certificates.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucun certificat pour ce noeud</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {certificates.length} certificat(s)
        </Badge>
        {CA_OVERVIEW_TYPES.has(nodeType) && (
          <Badge variant="secondary" className="text-xs">
            Vue CA globale
          </Badge>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Sujet</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Statut</TableHead>
              <TableHead className="text-xs">Emetteur</TableHead>
              <TableHead className="text-xs">Expire</TableHead>
              <TableHead className="text-xs text-center">
                Renouvellement auto
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certificates.map((cert: InfraCertificate) => (
              <TableRow key={cert.id}>
                <TableCell className="text-xs font-medium font-mono max-w-[180px] truncate">
                  {cert.subject}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px]",
                      CERT_TYPE_COLORS[cert.cert_type] ?? "",
                    )}
                  >
                    {CERT_TYPE_LABELS[cert.cert_type] ?? cert.cert_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px]",
                      STATUS_COLORS[cert.status] ?? "",
                    )}
                  >
                    {cert.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono max-w-[160px] truncate">
                  {cert.issuer}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(cert.not_after).toLocaleDateString("fr-FR")}
                </TableCell>
                <TableCell className="text-center">
                  {cert.auto_renew ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
