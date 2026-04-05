"use client";

import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getClient, ServiceName } from "@/lib/api/factory";
import { usePageTitle } from "@/hooks/use-page-title";

interface Migration {
  version: string;
  description: string;
  applied_at: string | null;
  status: "applied" | "pending" | "failed";
}

interface ServiceMigrations {
  service: string;
  migrations: Migration[];
  error?: string;
}

const SERVICES_WITH_DB = [
  { name: "identity", service: ServiceName.IDENTITY },
  { name: "storage", service: ServiceName.STORAGE },
  { name: "mail", service: ServiceName.MAIL },
  { name: "calendar", service: ServiceName.CALENDAR },
  { name: "contacts", service: ServiceName.CONTACTS },
  { name: "scheduler", service: ServiceName.SCHEDULER },
];

const STATUS_CONFIG = {
  applied: {
    icon: CheckCircle2,
    color: "text-green-500",
    bg: "bg-green-500/10",
    label: "Appliquée",
  },
  pending: {
    icon: Clock,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    label: "En attente",
  },
  failed: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-500/10",
    label: "Échouée",
  },
};

export default function MigrationStatusPage() {
  usePageTitle("Migrations");

  const {
    data = [],
    isLoading: loading,
    refetch,
  } = useQuery<ServiceMigrations[]>({
    queryKey: ["admin-migrations"],
    queryFn: async () => {
      const results: ServiceMigrations[] = [];
      for (const svc of SERVICES_WITH_DB) {
        try {
          const client = getClient(svc.service);
          const res = await client.get<Migration[]>("/migrations/status");
          results.push({ service: svc.name, migrations: res.data || [] });
        } catch {
          results.push({
            service: svc.name,
            migrations: [],
            error: "Service indisponible",
          });
        }
      }
      return results;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const totalApplied = data.reduce(
    (sum, s) => sum + s.migrations.filter((m) => m.status === "applied").length,
    0,
  );
  const totalPending = data.reduce(
    (sum, s) => sum + s.migrations.filter((m) => m.status === "pending").length,
    0,
  );

  return (
    <AppLayout>
      <div className="w-full space-y-6">
        <PageHeader
          title="Migrations"
          description="État des migrations de base de données par service"
          icon={<Database className="h-5 w-5 text-primary" />}
          actions={
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Rafraîchir
            </Button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-green-600">
                {totalApplied}
              </p>
              <p className="text-xs text-muted-foreground">Appliquées</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-yellow-600">
                {totalPending}
              </p>
              <p className="text-xs text-muted-foreground">En attente</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold">{data.length}</p>
              <p className="text-xs text-muted-foreground">Services</p>
            </CardContent>
          </Card>
        </div>

        {/* Per-service */}
        {data.map((svc) => (
          <Card key={svc.service}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base capitalize">
                  {svc.service}
                </CardTitle>
                {svc.error ? (
                  <Badge variant="destructive">{svc.error}</Badge>
                ) : (
                  <Badge variant="secondary">
                    {svc.migrations.length} migrations
                  </Badge>
                )}
              </div>
            </CardHeader>
            {svc.migrations.length > 0 && (
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {svc.migrations.map((m) => {
                    const cfg = STATUS_CONFIG[m.status];
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={m.version}
                        className="flex items-center gap-3 py-1.5 text-sm"
                      >
                        <Icon className={`h-4 w-4 ${cfg.color} shrink-0`} />
                        <span className="font-mono text-xs text-muted-foreground w-32 shrink-0">
                          {m.version}
                        </span>
                        <span className="flex-1 truncate">{m.description}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}
                        >
                          {cfg.label}
                        </span>
                        {m.applied_at && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(m.applied_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
