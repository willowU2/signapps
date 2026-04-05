"use client";

import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Store, Puzzle, Zap, Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { usePageTitle } from "@/hooks/use-page-title";

export default function ApiMarketplacePage() {
  usePageTitle("API Marketplace");

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          title="API Marketplace"
          description="Découvrez et activez des intégrations tierces"
          icon={<Store className="h-5 w-5 text-primary" />}
        />

        <div className="rounded-lg border bg-muted/30 p-8 text-center space-y-4">
          <Store className="h-16 w-16 mx-auto text-muted-foreground/40" />
          <h2 className="text-xl font-semibold">Bientôt disponible</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Le marketplace d&apos;intégrations API sera disponible
            prochainement. Vous pourrez connecter des services tiers directement
            à la plateforme SignApps.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <Puzzle className="h-5 w-5 text-blue-500 mb-1" />
              <CardTitle className="text-sm">
                Intégrations plug-and-play
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Connectez vos outils favoris en quelques clics.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Zap className="h-5 w-5 text-yellow-500 mb-1" />
              <CardTitle className="text-sm">
                Webhooks & Automatisations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Déclenchez des actions sur des événements métier.
              </CardDescription>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <Shield className="h-5 w-5 text-green-500 mb-1" />
              <CardTitle className="text-sm">OAuth sécurisé</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Toutes les connexions sont chiffrées et auditées.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
