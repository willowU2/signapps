"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getUsers,
  getSystemMetrics,
  type User,
  type SystemMetrics,
  isAdmin,
} from "@/lib/api-admin";
import { useServiceHealth } from "@/hooks/use-service-health";
import { Users, Activity, HardDrive, Cpu, ShieldCheck } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";

export default function AdminDashboard() {
  usePageTitle("Administration");
  const [users, setUsers] = useState<User[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const { data: healthData } = useServiceHealth();

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch((err) => console.warn(err));
    getSystemMetrics()
      .then(setMetrics)
      .catch((err) => console.warn(err));
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Tableau de bord admin"
          icon={<ShieldCheck className="h-5 w-5 text-primary" />}
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Utilisateurs totaux
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground">
                Actifs et inactifs
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Utilisation CPU
              </CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.cpu_usage?.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Système global</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Utilisation mémoire
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.memory_usage?.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Système global</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Utilisation disque
              </CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.disk_usage?.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Volume racine</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity / Logs placeholder */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Utilisateurs récents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.slice(0, 5).map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user.display_name || user.username}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {user.email || "-"}
                      </p>
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-xs ${isAdmin(user) ? "bg-primary/10 text-primary" : "bg-muted"}`}
                    >
                      {isAdmin(user) ? "Admin" : "Utilisateur"}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>État du système</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {healthData?.slice(0, 5).map((service) => (
                  <div key={service.name} className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${service.status === "online" ? "bg-green-500" : "bg-red-500"}`}
                    />
                    <span className="text-sm">
                      {service.name} :{" "}
                      {service.status === "online" ? "En ligne" : "Hors ligne"}
                    </span>
                  </div>
                ))}
                {!healthData && (
                  <div className="text-sm text-muted-foreground animate-pulse">
                    Vérification de l&apos;état du système...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
