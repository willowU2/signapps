/**
 * SO3 — Headcount Dashboard (`/admin/headcount`).
 *
 * Tenant-wide view : cards par OU avec filled/target/gap, bar chart via
 * Recharts, liste "open positions" aggregated.
 */
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import {
  orgApi,
  type OrgHeadcountPlan,
  type OrgHeadcountRollup,
} from "@/lib/api/org";
import type { OrgNode } from "@/types/org";
import { usePageTitle } from "@/hooks/use-page-title";

interface NodeRow {
  node: OrgNode;
  rollup: OrgHeadcountRollup | null;
  plan: OrgHeadcountPlan | null;
}

const STATUS_COLORS: Record<string, string> = {
  on_track: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  understaffed: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  over_plan: "bg-red-500/10 text-red-700 dark:text-red-400",
  no_plan: "bg-muted text-muted-foreground",
};

export default function HeadcountDashboardPage() {
  usePageTitle("Effectifs — Administration");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<NodeRow[]>([]);
  const [plans, setPlans] = useState<OrgHeadcountPlan[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const treesRes = await orgApi.trees.list();
      const roots = Array.isArray(treesRes.data) ? treesRes.data : [];

      // Flatten all nodes from first root's subtree.
      const allNodes: OrgNode[] = [];
      for (const root of roots) {
        try {
          const sub = await orgApi.trees.getFull(root.id);
          if (Array.isArray(sub.data)) allNodes.push(...sub.data);
        } catch {
          // ignore
        }
      }
      // Keep only top-level units (parent = root id).
      const rootIds = new Set(roots.map((r) => r.id));
      const topUnits = allNodes.filter(
        (n) =>
          rootIds.has(n.parent_id ?? "") &&
          n.node_type !== "root" &&
          n.is_active !== false,
      );

      // Fetch headcount for the tenant.
      const hcRes = await orgApi.headcount.list();
      const allPlans = hcRes.data?.plans ?? [];
      setPlans(allPlans);

      // For each top unit, compute rollup.
      const rowsOut: NodeRow[] = [];
      for (const node of topUnits) {
        try {
          const rollupRes = await orgApi.headcount.rollup(node.id);
          const nodePlan = allPlans.find((p) => p.node_id === node.id) ?? null;
          rowsOut.push({ node, rollup: rollupRes.data, plan: nodePlan });
        } catch {
          rowsOut.push({ node, rollup: null, plan: null });
        }
      }
      setRows(rowsOut);
    } catch (err) {
      toast.error(`Chargement dashboard: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        name: r.node.name,
        filled: r.rollup?.filled ?? 0,
        positions: r.rollup?.positions_sum ?? 0,
        target: r.rollup?.target ?? 0,
      })),
    [rows],
  );

  const totals = useMemo(() => {
    const filled = rows.reduce((s, r) => s + (r.rollup?.filled ?? 0), 0);
    const positions = rows.reduce(
      (s, r) => s + (r.rollup?.positions_sum ?? 0),
      0,
    );
    const target = rows.reduce((s, r) => s + (r.rollup?.target ?? 0), 0);
    const openPositions = Math.max(positions - filled, 0);
    return { filled, positions, target, openPositions };
  }, [rows]);

  if (loading) {
    return (
      <AppLayout>
        <div className="px-6 py-6 space-y-6">
          <PageHeader
            title="Effectifs"
            description="Vue synthétique des plans de recrutement et de l'occupation"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <LoadingState variant="skeleton" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-6 py-6 space-y-6">
        <PageHeader
          title="Effectifs"
          description="Vue synthétique des plans de recrutement et de l'occupation"
          icon={<TrendingUp className="h-5 w-5" />}
        />

        {/* Totals */}
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Occupés</div>
            <div className="text-2xl font-bold">{totals.filled}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Sièges ouverts</div>
            <div className="text-2xl font-bold">{totals.positions}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">
              Cible cumulée (+90j)
            </div>
            <div className="text-2xl font-bold">{totals.target}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">
              Postes à pourvoir
            </div>
            <div className="text-2xl font-bold text-amber-500">
              {totals.openPositions}
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium mb-3">Occupation par OU</h2>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="filled"
                  fill="hsl(var(--chart-1))"
                  name="Occupés"
                />
                <Bar
                  dataKey="positions"
                  fill="hsl(var(--chart-2))"
                  name="Sièges"
                />
                <Bar dataKey="target" fill="hsl(var(--chart-3))" name="Cible" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Per-OU cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => (
            <div
              key={r.node.id}
              className="rounded-lg border border-border bg-card p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{r.node.name}</h3>
                {r.rollup ? (
                  <Badge
                    className={STATUS_COLORS[r.rollup.status] ?? ""}
                    variant="secondary"
                  >
                    {r.rollup.status}
                  </Badge>
                ) : null}
              </div>
              {r.rollup ? (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Occupés</div>
                    <div className="font-bold">{r.rollup.filled}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Cible</div>
                    <div className="font-bold">{r.rollup.target ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Écart</div>
                    <div className="font-bold">
                      {r.rollup.gap === null
                        ? "—"
                        : r.rollup.gap > 0
                          ? `+${r.rollup.gap}`
                          : r.rollup.gap}
                    </div>
                  </div>
                </div>
              ) : null}
              {r.plan ? (
                <div className="text-xs text-muted-foreground">
                  Plan jusqu&apos;au {r.plan.target_date}
                  {r.plan.notes ? ` — ${r.plan.notes}` : ""}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Open positions list */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium mb-3">
            Plans d&apos;effectifs ({plans.length})
          </h2>
          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Aucun plan défini.
            </p>
          ) : (
            <ul className="space-y-2">
              {plans.map((p) => {
                const node = rows.find((r) => r.node.id === p.node_id);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-background p-2"
                  >
                    <div>
                      <span className="font-medium">
                        {node?.node.name ?? "(OU inconnue)"}
                      </span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        cible {p.target_head_count} · {p.target_date}
                      </span>
                    </div>
                    {p.notes ? (
                      <span className="text-xs text-muted-foreground">
                        {p.notes}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
