"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useServiceHealth } from "@/hooks/use-service-health";
import { Activity, CheckCircle2, XCircle, Clock } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

export default function ApiHealthPage() {
  usePageTitle("API Health");
  const { data: services, isLoading } = useServiceHealth();

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Activity className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">API Health</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Statut en temps réel des services de la plateforme</p>
          </div>
        </div>

        {isLoading && (
          <div className="text-sm text-muted-foreground animate-pulse">Vérification des services...</div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services?.map((service) => {
            const isOnline = service.status === "online";
            return (
              <Card key={service.name} className={`border-l-4 ${isOnline ? "border-l-green-500" : "border-l-red-500"}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{service.name}</CardTitle>
                  {isOnline
                    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                    : <XCircle className="h-4 w-4 text-red-500" />
                  }
                </CardHeader>
                <CardContent>
                  <div className={`text-lg font-bold ${isOnline ? "text-green-600" : "text-red-600"}`}>
                    {isOnline ? "En ligne" : "Hors ligne"}
                  </div>
                  {service.responseTime !== undefined && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      Latence : {service.responseTime}ms
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {!isLoading && (!services || services.length === 0) && (
            <div className="col-span-full text-center py-10 text-muted-foreground">
              Aucun service supervisé trouvé.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
