'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { WebhookManager } from '@/components/social/webhook-manager';
import { ApiKeyManager } from '@/components/social/api-key-manager';
import { WorkspaceManager } from '@/components/social/workspace-manager';
import { TimeSlotManager } from '@/components/social/time-slot-manager';
import { ContentSetManager } from '@/components/social/content-set-manager';
import { Webhook, Key, Building2, Clock, Package } from 'lucide-react';

export default function SocialSettingsPage() {
  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage webhooks, API keys, workspaces, time slots, and content sets
        </p>
      </div>

      <Tabs defaultValue="webhooks" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="webhooks" className="gap-1.5">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-1.5">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="workspaces" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            Workspaces
          </TabsTrigger>
          <TabsTrigger value="time-slots" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Time Slots
          </TabsTrigger>
          <TabsTrigger value="content-sets" className="gap-1.5">
            <Package className="h-4 w-4" />
            Content Sets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks">
          <WebhookManager />
        </TabsContent>

        <TabsContent value="api-keys">
          <ApiKeyManager />
        </TabsContent>

        <TabsContent value="workspaces">
          <WorkspaceManager />
        </TabsContent>

        <TabsContent value="time-slots">
          <TimeSlotManager />
        </TabsContent>

        <TabsContent value="content-sets">
          <ContentSetManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
