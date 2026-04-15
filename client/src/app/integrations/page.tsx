"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TriggerBuilder } from "@/components/integrations/trigger-builder";
import { IFTTTRecipes } from "@/components/integrations/ifttt-recipes";
import { N8nConnector } from "@/components/integrations/n8n-connector";
import { WebhookConnector } from "@/components/integrations/webhook-connector";
import { SlackConnector } from "@/components/integrations/slack-connector";
import { TeamsConnector } from "@/components/integrations/teams-connector";
import { DiscordConnector } from "@/components/integrations/discord-connector";
import { RestApiConnector } from "@/components/integrations/rest-api-connector";
import { Plug } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

export default function IntegrationsPage() {
  usePageTitle("Integrations");
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Plug className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
            <p className="text-muted-foreground">
              Connect SignApps with external services and automate workflows
            </p>
          </div>
        </div>

        <Tabs defaultValue="triggers">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="triggers">Trigger Builder</TabsTrigger>
            <TabsTrigger value="recipes">IFTTT Recipes</TabsTrigger>
            <TabsTrigger value="n8n">n8n</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="slack">Slack</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="discord">Discord</TabsTrigger>
            <TabsTrigger value="rest">REST API</TabsTrigger>
          </TabsList>

          <TabsContent value="triggers">
            <TriggerBuilder />
          </TabsContent>
          <TabsContent value="recipes">
            <IFTTTRecipes />
          </TabsContent>
          <TabsContent value="n8n">
            <N8nConnector />
          </TabsContent>
          <TabsContent value="webhooks">
            <WebhookConnector />
          </TabsContent>
          <TabsContent value="slack">
            <SlackConnector />
          </TabsContent>
          <TabsContent value="teams">
            <TeamsConnector />
          </TabsContent>
          <TabsContent value="discord">
            <DiscordConnector />
          </TabsContent>
          <TabsContent value="rest">
            <RestApiConnector />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
