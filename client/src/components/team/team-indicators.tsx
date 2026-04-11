"use client";

import { Users, CheckSquare, Plane, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeamSummary } from "@/hooks/use-my-team";

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Skeleton KPI card ─────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
        <Skeleton className="mt-1 h-3 w-24" />
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TeamIndicators() {
  const { data, isLoading } = useTeamSummary();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const summary = data ?? {
    total_members: 0,
    active_members: 0,
    on_leave: 0,
    remote: 0,
    pending_actions: 0,
    upcoming_reviews: 0,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Taille de l'équipe"
          value={summary.total_members}
          icon={Users}
          description={`${summary.active_members} actifs`}
        />
        <KpiCard
          title="Tâches actives"
          value={summary.active_members}
          icon={CheckSquare}
          description="En cours ce mois"
        />
        <KpiCard
          title="En congé aujourd'hui"
          value={summary.on_leave}
          icon={Plane}
          description={`${summary.remote} en télétravail`}
        />
        <KpiCard
          title="Approbations en attente"
          value={summary.pending_actions}
          icon={Clock}
          description="Demandes à traiter"
        />
      </div>

      {/* Placeholder chart area */}
      <Card className="border-dashed">
        <CardContent className="flex h-64 items-center justify-center text-muted-foreground">
          <p className="text-sm">Graphiques à venir</p>
        </CardContent>
      </Card>
    </div>
  );
}
