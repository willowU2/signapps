"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiRequestLogger } from "@/components/admin/api-request-logger";
import { WebSocketDebugger } from "@/components/admin/websocket-debugger";
import { MockServer } from "@/components/admin/mock-server";
import { DbQueryExplorer } from "@/components/admin/db-query-explorer";
import { ServiceRestartPanel } from "@/components/admin/service-restart-panel";
import {
  Code,
  Activity,
  Wifi,
  Server,
  Database,
  RefreshCw,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";

export default function DeveloperToolsPage() {
  usePageTitle("Outils developpeur");
  return (
    <AppLayout>
      <div className="w-full space-y-4">
        <PageHeader
          title="Developer Tools"
          description="Advanced tools for API debugging, service management, and database inspection"
          icon={<Code className="h-5 w-5 text-primary" />}
        />

        <Tabs defaultValue="logger">
          <TabsList className="flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="logger" className="gap-1.5 text-xs">
              <Activity className="h-3.5 w-3.5" />
              API Logger
            </TabsTrigger>
            <TabsTrigger value="ws" className="gap-1.5 text-xs">
              <Wifi className="h-3.5 w-3.5" />
              WebSocket
            </TabsTrigger>
            <TabsTrigger value="mock" className="gap-1.5 text-xs">
              <Server className="h-3.5 w-3.5" />
              Mock Server
            </TabsTrigger>
            <TabsTrigger value="db" className="gap-1.5 text-xs">
              <Database className="h-3.5 w-3.5" />
              DB Explorer
            </TabsTrigger>
            <TabsTrigger value="restart" className="gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              Services
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logger" className="mt-4">
            <ApiRequestLogger />
          </TabsContent>

          <TabsContent value="ws" className="mt-4">
            <WebSocketDebugger />
          </TabsContent>

          <TabsContent value="mock" className="mt-4">
            <MockServer />
          </TabsContent>

          <TabsContent value="db" className="mt-4">
            <DbQueryExplorer />
          </TabsContent>

          <TabsContent value="restart" className="mt-4">
            <ServiceRestartPanel />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
