"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiMarketplace } from "@/components/api-platform/api-marketplace";
import { ApiHealthStatus } from "@/components/api-platform/api-health-status";
import { ApiChangelog } from "@/components/api-platform/api-changelog";
import { WebhookEventCatalog } from "@/components/api-platform/webhook-event-catalog";
import { SdkGeneration } from "@/components/api-platform/sdk-generation";
import { ShoppingBag, Activity, GitCommit, Webhook, Code } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { usePageTitle } from "@/hooks/use-page-title";

export default function ApiPlatformPage() {
  usePageTitle("Plateforme API");
  return (
    <AppLayout>
      <div className="w-full space-y-4">
        <PageHeader
          title="API Platform"
          description="Marketplace, health monitoring, changelogs, webhooks, and SDK generation"
          icon={<Code className="h-5 w-5 text-primary" />}
        />

        <Tabs defaultValue="marketplace">
          <TabsList className="flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="marketplace" className="gap-1.5 text-xs">
              <ShoppingBag className="h-3.5 w-3.5" />
              Marketplace
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-1.5 text-xs">
              <Activity className="h-3.5 w-3.5" />
              Health
            </TabsTrigger>
            <TabsTrigger value="changelog" className="gap-1.5 text-xs">
              <GitCommit className="h-3.5 w-3.5" />
              Changelog
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-1.5 text-xs">
              <Webhook className="h-3.5 w-3.5" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="sdk" className="gap-1.5 text-xs">
              <Code className="h-3.5 w-3.5" />
              SDKs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="marketplace" className="mt-4">
            <ApiMarketplace />
          </TabsContent>

          <TabsContent value="health" className="mt-4">
            <ApiHealthStatus />
          </TabsContent>

          <TabsContent value="changelog" className="mt-4">
            <ApiChangelog />
          </TabsContent>

          <TabsContent value="webhooks" className="mt-4">
            <WebhookEventCatalog />
          </TabsContent>

          <TabsContent value="sdk" className="mt-4">
            <SdkGeneration />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
