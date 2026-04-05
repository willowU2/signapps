"use client";

import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Database, Table2, Search, Lock } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";

export default function DbExplorerPage() {
  usePageTitle("DB Explorer");

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          title="DB Explorer"
          description="Explorez la structure et les données de la base"
          icon={<Database className="h-5 w-5 text-primary" />}
        />

        <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-4">
          <Lock className="h-16 w-16 mx-auto text-muted-foreground/40" />
          <h2 className="text-xl font-semibold">Accès restreint</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            L&apos;explorateur de base de données est en cours de développement.
            Seuls les super-administrateurs pourront accéder à cette
            fonctionnalité.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <Table2 className="h-5 w-5 text-blue-500 mb-1" />
              <CardTitle className="text-sm">Navigation de tables</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Parcourez les tables et leurs schémas.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Search className="h-5 w-5 text-purple-500 mb-1" />
              <CardTitle className="text-sm">Requêtes SQL</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Exécutez des requêtes en lecture seule.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Database className="h-5 w-5 text-green-500 mb-1" />
              <CardTitle className="text-sm">Export de données</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Exportez les résultats en CSV ou JSON.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
