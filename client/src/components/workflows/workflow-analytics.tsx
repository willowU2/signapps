"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Clock } from "lucide-react";
import type { Workflow } from "@/app/workflows/page";

interface WorkflowAnalyticsProps {
  workflow: Workflow;
  onClose: () => void;
}

// Simulate analytics data from localStorage or generate synthetic data
function generateAnalytics(workflow: Workflow) {
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun"];

  // Per-state average time (simulated)
  const stateMetrics = workflow.states.map((s, i) => ({
    name: s.name,
    color: s.color,
    avgDays: Math.round(1 + Math.random() * 7),
    rejectionRate: i === 1 ? 23 : Math.round(Math.random() * 15),
  }));

  // Find bottleneck
  const bottleneck = stateMetrics.reduce((a, b) =>
    a.avgDays > b.avgDays ? a : b,
  );

  // Monthly comparison data
  const monthlyData = months.map((m) => ({
    month: m,
    completed: Math.round(3 + Math.random() * 15),
    rejected: Math.round(Math.random() * 5),
  }));

  return { stateMetrics, bottleneck, monthlyData };
}

export function WorkflowAnalytics({
  workflow,
  onClose,
}: WorkflowAnalyticsProps) {
  const analytics = useMemo(() => generateAnalytics(workflow), [workflow]);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Analytiques — {workflow.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Bottleneck alert */}
          <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Goulot d&apos;étranglement détecté
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                L&apos;état{" "}
                <strong>&ldquo;{analytics.bottleneck.name}&rdquo;</strong> prend
                en moyenne <strong>{analytics.bottleneck.avgDays} jours</strong>{" "}
                — le plus long de la chaîne.
              </p>
            </div>
          </div>

          {/* Per-state metrics */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Durée moyenne par état
            </h3>
            <div className="space-y-2">
              {analytics.stateMetrics.map((m) => (
                <div key={m.name} className="flex items-center gap-3">
                  <span
                    className="w-24 shrink-0 text-xs font-medium px-2 py-1 rounded-full text-white text-center truncate"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.name}
                  </span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (m.avgDays / 10) * 100)}%`,
                        backgroundColor: m.color,
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                    {m.avgDays}j moy.
                  </span>
                  {m.rejectionRate > 0 && (
                    <Badge variant="destructive" className="text-xs shrink-0">
                      {m.rejectionRate}% rejet
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Monthly chart */}
          <div>
            <h3 className="text-sm font-semibold mb-3">
              Comparaison mensuelle
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={analytics.monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                />
                <Bar dataKey="completed" name="Complétés" radius={[4, 4, 0, 0]}>
                  {analytics.monthlyData.map((_, i) => (
                    <Cell key={i} fill="#22c55e" />
                  ))}
                </Bar>
                <Bar dataKey="rejected" name="Rejetés" radius={[4, 4, 0, 0]}>
                  {analytics.monthlyData.map((_, i) => (
                    <Cell key={i} fill="#ef4444" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 justify-center mt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-sm bg-green-500" />
                Complétés
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-sm bg-red-500" />
                Rejetés
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
