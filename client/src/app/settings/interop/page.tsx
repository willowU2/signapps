"use client";

import { useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

import { UnifiedInteropSettings } from "@/components/interop/unified-settings";
import { CrossModuleAnalytics } from "@/components/interop/unified-settings";
import { DataSyncRules } from "@/components/interop/data-sync-permissions";
import { CrossModuleTemplates } from "@/components/interop/data-sync-permissions";
import { CrossModuleApiKeys } from "@/components/interop/cross-module-api";
import { ModuleHealthDashboard } from "@/components/interop/unified-notifications";
import { ActivityDigestSettings } from "@/components/interop/cross-module-comments";
import { UnifiedExportDialog } from "@/components/interop/cross-module-export-import";
import { SmartImport } from "@/components/interop/cross-module-export-import";
import { AutomationWorkflows } from "@/components/crosslinks/AutomationWorkflows";

export default function InteropSettingsPage() {
  usePageTitle("Interopérabilité");
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Interopérabilité</h1>
          <p className="text-muted-foreground mt-1">
            Configurez les connexions entre modules, automatisations et
            intégrations externes.
          </p>
        </div>

        <Tabs defaultValue="settings" className="space-y-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 w-full h-auto sm:h-9">
            <TabsTrigger value="settings" className="text-xs">
              Paramètres
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs">
              Analytics
            </TabsTrigger>
            <TabsTrigger value="sync" className="text-xs">
              Sync & Templates
            </TabsTrigger>
            <TabsTrigger value="api" className="text-xs">
              API & Santé
            </TabsTrigger>
            <TabsTrigger value="data" className="text-xs">
              Données
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Comportement global</CardTitle>
                <CardDescription>
                  Activez ou désactivez les connexions automatiques entre
                  modules.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UnifiedInteropSettings />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Digest d'activité</CardTitle>
                <CardDescription>
                  Recevez un résumé de toutes les activités par email.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityDigestSettings />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Automatisations</CardTitle>
                <CardDescription>
                  Règles déclencheur → action entre modules.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AutomationWorkflows />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Métriques multi-modules
                </CardTitle>
                <CardDescription>
                  Vue d'ensemble de l'activité à travers tous les modules.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CrossModuleAnalytics />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sync" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Règles de synchronisation
                </CardTitle>
                <CardDescription>
                  Les changements dans un module se propagent aux modules liés.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataSyncRules />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Templates multi-modules
                </CardTitle>
                <CardDescription>
                  Créez des éléments dans plusieurs modules simultanément.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CrossModuleTemplates />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Clés API</CardTitle>
                <CardDescription>
                  Accès programmatique à l'API unifiée SignApps.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CrossModuleApiKeys />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Santé des services</CardTitle>
                <CardDescription>
                  État en temps réel de tous les microservices.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ModuleHealthDashboard />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Export unifié</CardTitle>
                <CardDescription>
                  Exportez vos données de plusieurs modules en une seule fois.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setExportOpen(true)} className="gap-2">
                  <Download className="w-4 h-4" />
                  Exporter mes données
                </Button>
                <UnifiedExportDialog
                  open={exportOpen}
                  onClose={() => setExportOpen(false)}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Import intelligent</CardTitle>
                <CardDescription>
                  Importez n'importe quel fichier — le module cible est détecté
                  automatiquement.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SmartImport />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
