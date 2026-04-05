"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Rocket, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { adApi } from "@/lib/api/active-directory";
import type {
  AdDomain,
  DeployProfile,
  DeployHistory,
} from "@/types/active-directory";

// =============================================================================
// Status badge configuration
// =============================================================================

type DeployStatus = DeployHistory["status"];

const STATUS_CONFIG: Record<
  DeployStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "En attente",
    className:
      "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  },
  booting: {
    label: "Demarrage",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  installing: {
    label: "Installation",
    className:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  configuring: {
    label: "Configuration",
    className:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  completed: {
    label: "Termine",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  failed: {
    label: "Echec",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

function StatusBadge({ status }: { status: DeployStatus }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-700",
  };
  return (
    <Badge variant="secondary" className={cn("text-[10px]", config.className)}>
      {config.label}
    </Badge>
  );
}

// =============================================================================
// Helper: format datetime
// =============================================================================

function formatDt(value?: string): string {
  if (!value) return "\u2014";
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =============================================================================
// ProfileCard
// =============================================================================

function ProfileCard({ profile }: { profile: DeployProfile }) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-tight">
            {profile.is_default && (
              <Star className="inline h-3 w-3 mr-1 text-yellow-500 fill-yellow-500" />
            )}
            {profile.name}
          </CardTitle>
          <div className="flex items-center gap-1 shrink-0">
            {profile.os_type && (
              <Badge variant="outline" className="text-[10px]">
                {profile.os_type}
                {profile.os_version ? ` ${profile.os_version}` : ""}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-1.5">
        {profile.description && (
          <p className="text-xs text-muted-foreground">{profile.description}</p>
        )}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {profile.target_ou && (
            <span>
              <span className="font-medium text-foreground">OU : </span>
              <span className="font-mono">{profile.target_ou}</span>
            </span>
          )}
          <span>
            <span className="font-medium text-foreground">Paquets : </span>
            {profile.packages.length}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// ProfilesSection
// =============================================================================

function ProfilesSection({ profiles }: { profiles: DeployProfile[] }) {
  if (profiles.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-6">
        <Rocket className="h-6 w-6 mx-auto mb-2 opacity-30" />
        <p className="text-xs">Aucun profil de deploiement</p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {profiles.map((p) => (
        <ProfileCard key={p.id} profile={p} />
      ))}
    </div>
  );
}

// =============================================================================
// RecentDeploymentsSection
// =============================================================================

interface HistoryRow extends DeployHistory {
  profileName: string;
}

function RecentDeploymentsSection({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-6">
        <Rocket className="h-6 w-6 mx-auto mb-2 opacity-30" />
        <p className="text-xs">Aucun deploiement recent</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Hote</TableHead>
            <TableHead className="text-xs">Profil</TableHead>
            <TableHead className="text-xs">Statut</TableHead>
            <TableHead className="text-xs">Debut</TableHead>
            <TableHead className="text-xs">Fin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="text-xs font-mono">
                {row.hostname ?? "\u2014"}
              </TableCell>
              <TableCell className="text-xs">{row.profileName}</TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDt(row.started_at)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {row.completed_at ? (
                  formatDt(row.completed_at)
                ) : row.error_message ? (
                  <span
                    className="text-destructive truncate max-w-[160px] block"
                    title={row.error_message}
                  >
                    {row.error_message}
                  </span>
                ) : (
                  "\u2014"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// =============================================================================
// DeploymentTabContent
// =============================================================================

export function DeploymentTabContent({
  nodeId,
  nodeType,
}: {
  nodeId: string;
  nodeType: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [profiles, setProfiles] = useState<DeployProfile[]>([]);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    (async () => {
      try {
        // 1. Get domains
        const domainsRes = await adApi.domains.list();
        const domains: AdDomain[] = domainsRes.data ?? [];
        if (cancelled) return;

        if (domains.length === 0) {
          setProfiles([]);
          setHistoryRows([]);
          setLoading(false);
          return;
        }

        // 2. Get profiles for all domains
        const allProfiles: DeployProfile[] = [];
        await Promise.all(
          domains.map(async (d) => {
            try {
              const res = await adApi.deploy.profiles(d.id);
              allProfiles.push(...(res.data ?? []));
            } catch {
              // Domain may not have deploy profiles
            }
          }),
        );
        if (cancelled) return;

        // 3. Filter by node type
        let filtered = allProfiles;
        if (
          nodeType === "department" ||
          nodeType === "service" ||
          nodeType === "team"
        ) {
          const matched = allProfiles.filter(
            (p) => p.target_ou && p.target_ou === nodeId,
          );
          if (matched.length > 0) filtered = matched;
        }

        setProfiles(filtered);

        // 4. Get history for each profile
        const rows: HistoryRow[] = [];
        await Promise.all(
          filtered.map(async (p) => {
            try {
              const res = await adApi.deploy.history(p.id);
              (res.data ?? []).forEach((h: DeployHistory) => {
                rows.push({ ...h, profileName: p.name });
              });
            } catch {
              // History may not exist yet
            }
          }),
        );
        if (cancelled) return;

        rows.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setHistoryRows(rows);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nodeId, nodeType]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Chargement...</span>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="text-center text-destructive py-8">
        <Rocket className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Erreur lors du chargement des deploiements</p>
      </div>
    );
  }

  // ── No profiles ──
  if (profiles.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Rocket className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucun profil de deploiement</p>
        <p className="text-xs mt-1">
          Configurez un domaine AD pour activer les deploiements
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Profiles section ── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Profils de deploiement
          </h3>
          <Badge variant="outline" className="text-xs">
            {profiles.length}
          </Badge>
        </div>
        <ProfilesSection profiles={profiles} />
      </section>

      {/* ── Recent deployments section ── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Deploiements recents
          </h3>
          <Badge variant="outline" className="text-xs">
            {historyRows.length}
          </Badge>
        </div>
        <RecentDeploymentsSection rows={historyRows} />
      </section>
    </div>
  );
}
