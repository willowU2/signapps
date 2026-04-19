"use client";

/**
 * Admin — Org Ops dashboard (S1 W5 Task 34).
 *
 * Three panels:
 *   1. AD sync activity — last entries from org_ad_sync_log grouped
 *      by run_id.
 *   2. Provisioning queue — org_provisioning_log rows in failed /
 *      pending_retry state, with a per-row retry button.
 *   3. Active grants — current non-revoked, non-expired rows from
 *      org_access_grants with a per-row revoke button.
 *
 * Backend: signapps-org (port 3026). API client: @/lib/api/org-ops.
 */

import type * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { Loader2, RefreshCw, Ban, Activity, Users, Link2 } from "lucide-react";
import {
  orgOpsApi,
  type AdSyncLogEntry,
  type ProvisioningLogEntry,
  type AccessGrantView,
} from "@/lib/api/org-ops";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function statusBadge(status: string): React.ReactElement {
  const lower = status.toLowerCase();
  if (lower === "ok" || lower === "succeeded") {
    return <Badge variant="default">{status}</Badge>;
  }
  if (lower === "skipped" || lower === "pending_retry") {
    return <Badge variant="secondary">{status}</Badge>;
  }
  return <Badge variant="destructive">{status}</Badge>;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Admin Org Ops dashboard.
 */
export default function OrgOpsPage(): React.ReactElement {
  usePageTitle("Org Ops — Admin");

  const [tenantId, setTenantId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [adRuns, setAdRuns] = useState<AdSyncLogEntry[]>([]);
  const [pending, setPending] = useState<ProvisioningLogEntry[]>([]);
  const [grants, setGrants] = useState<AccessGrantView[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [adRes, pendingRes] = await Promise.all([
        orgOpsApi.adSyncRuns({ limit: 50 }),
        orgOpsApi.provisioningPending({ limit: 100 }),
      ]);
      setAdRuns(adRes.data ?? []);
      setPending(pendingRes.data ?? []);
      if (tenantId) {
        const grantRes = await orgOpsApi.activeGrants(tenantId);
        setGrants(grantRes.data ?? []);
      } else {
        setGrants([]);
      }
    } catch (err) {
      toast.error("Impossible de charger les données Org Ops");
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Group AD rows by run_id for the first panel.
  const runs = useMemo(() => {
    const byRun = new Map<string, AdSyncLogEntry[]>();
    for (const row of adRuns) {
      const list = byRun.get(row.run_id) ?? [];
      list.push(row);
      byRun.set(row.run_id, list);
    }
    return Array.from(byRun.entries())
      .sort(
        ([, a], [, b]) =>
          new Date(b[0]?.created_at ?? 0).getTime() -
          new Date(a[0]?.created_at ?? 0).getTime(),
      )
      .slice(0, 10);
  }, [adRuns]);

  const retry = async (id: string) => {
    try {
      await orgOpsApi.provisioningRetry(id);
      toast.success("Retry planifié");
      void refresh();
    } catch (err) {
      toast.error("Retry échoué");
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  const revoke = async (id: string) => {
    try {
      await orgOpsApi.revokeGrant(id);
      toast.success("Grant révoqué");
      void refresh();
    } catch (err) {
      toast.error("Révocation échouée");
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Org Ops"
        description="Activité AD, file d'attente de provisioning, grants actifs"
        actions={
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="Tenant UUID (pour les grants)"
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            />
            <Button
              variant="outline"
              onClick={() => void refresh()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Rafraîchir
            </Button>
          </div>
        }
      />

      <div className="grid gap-6">
        {/* ───── AD sync activity ───── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Activité AD sync
            </CardTitle>
            <CardDescription>
              Derniers cycles de synchronisation Active Directory groupés par
              run.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>Entrées</TableHead>
                  <TableHead>OK</TableHead>
                  <TableHead>Erreurs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      {loading ? "Chargement…" : "Aucun cycle récent"}
                    </TableCell>
                  </TableRow>
                ) : (
                  runs.map(([runId, rows]) => {
                    const first = rows[rows.length - 1];
                    const okCount = rows.filter(
                      (r) => r.status === "ok",
                    ).length;
                    const errCount = rows.filter(
                      (r) => r.status === "error",
                    ).length;
                    return (
                      <TableRow key={runId}>
                        <TableCell className="font-mono text-xs">
                          {shortId(runId)}
                        </TableCell>
                        <TableCell>
                          {formatDate(first?.created_at ?? null)}
                        </TableCell>
                        <TableCell>{rows.length}</TableCell>
                        <TableCell>
                          <Badge variant="default">{okCount}</Badge>
                        </TableCell>
                        <TableCell>
                          {errCount > 0 ? (
                            <Badge variant="destructive">{errCount}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ───── Provisioning queue ───── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> File de provisioning
            </CardTitle>
            <CardDescription>
              Rows en échec ou en attente de retry. Le bouton « Retry » republie
              l'événement pour le consommateur concerné.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personne</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tentatives</TableHead>
                  <TableHead>Créé</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground"
                    >
                      {loading
                        ? "Chargement…"
                        : "Aucun provisioning en attente"}
                    </TableCell>
                  </TableRow>
                ) : (
                  pending.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">
                        {shortId(row.person_id)}
                      </TableCell>
                      <TableCell>{row.topic}</TableCell>
                      <TableCell>{row.service}</TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                      <TableCell>{row.attempts}</TableCell>
                      <TableCell>{formatDate(row.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void retry(row.id)}
                        >
                          <RefreshCw className="mr-1 h-3 w-3" /> Retry
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ───── Active grants ───── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" /> Grants actifs
            </CardTitle>
            <CardDescription>
              Liens d'accès HMAC non révoqués et non expirés pour le tenant
              sélectionné. Saisir un UUID ci-dessus pour charger.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Ressource</TableHead>
                  <TableHead>Expire</TableHead>
                  <TableHead>Dernière utilisation</TableHead>
                  <TableHead>Créé</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!tenantId ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      Aucun tenant sélectionné
                    </TableCell>
                  </TableRow>
                ) : grants.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      {loading ? "Chargement…" : "Aucun grant actif"}
                    </TableCell>
                  </TableRow>
                ) : (
                  grants.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-mono text-xs">
                        {shortId(g.id)}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{g.resource_type}</span>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {shortId(g.resource_id)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {g.expires_at ? (
                          formatDate(g.expires_at)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(g.last_used_at)}</TableCell>
                      <TableCell>{formatDate(g.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => void revoke(g.id)}
                        >
                          <Ban className="mr-1 h-3 w-3" /> Révoquer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
