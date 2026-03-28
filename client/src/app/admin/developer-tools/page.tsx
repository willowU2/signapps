'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiRequestLogger } from '@/components/admin/api-request-logger';
import { WebSocketDebugger } from '@/components/admin/websocket-debugger';
import { MockServer } from '@/components/admin/mock-server';
import { DbQueryExplorer } from '@/components/admin/db-query-explorer';
import { ServiceRestartPanel } from '@/components/admin/service-restart-panel';
import { Code, Activity, Wifi, Server, Database, RefreshCw } from 'lucide-react';

export default function DeveloperToolsPage() {
  return (
    <AppLayout>
      <div className="w-full space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Code className="h-6 w-6 text-primary" />
            Developer Tools
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Advanced tools for API debugging, service management, and database inspection
          </p>
        </div>

        <Tabs defaultValue="logger">
          <TabsList className="flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="logger" className="gap-1.5 text-xs">
              <Activity className="h-3.5 w-3.5" />API Logger
            </TabsTrigger>
            <TabsTrigger value="ws" className="gap-1.5 text-xs">
              <Wifi className="h-3.5 w-3.5" />WebSocket
            </TabsTrigger>
            <TabsTrigger value="mock" className="gap-1.5 text-xs">
              <Server className="h-3.5 w-3.5" />Mock Server
            </TabsTrigger>
            <TabsTrigger value="db" className="gap-1.5 text-xs">
              <Database className="h-3.5 w-3.5" />DB Explorer
            </TabsTrigger>
            <TabsTrigger value="restart" className="gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" />Services
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
