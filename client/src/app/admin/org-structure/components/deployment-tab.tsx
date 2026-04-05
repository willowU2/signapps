"use client";

import React from "react";
import { useQueries } from "@tanstack/react-query";
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
import { useAdDomains, useDeployProfiles } from "@/hooks/use-active-directory";
import { adApi } from "@/lib/api/active-directory";
import type { DeployProfile, DeployHistory } from "@/types/active-directory";

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
  if (!value) return "—";
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
                {row.hostname ?? "—"}
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
                  "—"
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
  nodeId: _nodeId,
  nodeType,
}: {
  nodeId: string;
  nodeType: string;
}) {
  // Step 1: load domains
  const {
    data: domains = [],
    isLoading: domainsLoading,
    isError: domainsError,
  } = useAdDomains();
  const domainId = domains[0]?.id ?? "";

  // Step 2: load profiles for the first domain
  const {
    data: allProfiles = [],
    isLoading: profilesLoading,
    isError: profilesError,
  } = useDeployProfiles(domainId);

  // Step 3: filter profiles according to node type
  const profiles: DeployProfile[] = React.useMemo(() => {
    if (nodeType === "computer") {
      // For computer nodes: show the specific profile(s) applied (all by default,
      // server can filter by hostname in the future)
      return allProfiles;
    }
    if (
      nodeType === "department" ||
      nodeType === "service" ||
      nodeType === "team"
    ) {
      // Show profiles whose target_ou matches the nodeId, or all if none match
      const matched = allProfiles.filter(
        (p) => p.target_ou && p.target_ou === _nodeId,
      );
      return matched.length > 0 ? matched : allProfiles;
    }
    // root / group nodes: show all profiles
    return allProfiles;
  }, [allProfiles, nodeType, _nodeId]);

  // Step 4: fetch history for every visible profile in parallel
  const historyQueries = useQueries({
    queries: profiles.map((p) => ({
      queryKey: ["deploy-history", p.id],
      queryFn: async () => {
        const res = await adApi.deploy.history(p.id);
        return res.data;
      },
      enabled: !!p.id,
    })),
  });

  const historyLoading = historyQueries.some((q) => q.isLoading);
  const historyError = historyQueries.some((q) => q.isError);

  // Flatten history rows, annotated with their profile name, sorted by created_at desc
  const historyRows: HistoryRow[] = React.useMemo(() => {
    const rows: HistoryRow[] = [];
    historyQueries.forEach((q, i) => {
      const profileName = profiles[i]?.name ?? "—";
      (q.data ?? []).forEach((h: DeployHistory) => {
        rows.push({ ...h, profileName });
      });
    });
    rows.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return rows;
  }, [historyQueries, profiles]);

  // ── Loading state ──
  if (domainsLoading || (domainId && profilesLoading)) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Chargement...</span>
      </div>
    );
  }

  // ── Error state ──
  if (domainsError || profilesError || historyError) {
    return (
      <div className="text-center text-destructive py-8">
        <Rocket className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Erreur lors du chargement des deploiements</p>
      </div>
    );
  }

  // ── No domain configured ──
  if (!domainId) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Rocket className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Aucun domaine AD configure</p>
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
          {historyLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <Badge variant="outline" className="text-xs">
              {historyRows.length}
            </Badge>
          )}
        </div>
        {historyLoading ? (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-xs">Chargement de l&apos;historique...</span>
          </div>
        ) : (
          <RecentDeploymentsSection rows={historyRows} />
        )}
      </section>
    </div>
  );
}
