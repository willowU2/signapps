"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StorageRulesSettings } from "@/components/admin/storage-rules-settings";
import { AiIndexingSettings } from "@/components/admin/ai-indexing-settings";
import { WebDavConfig } from "@/components/admin/webdav-config";
import { ShieldAlert, HardDrive, BrainCircuit, Network } from "lucide-react";
import { usePageTitle } from '@/hooks/use-page-title';

export default function AdminStorageSettingsPage() {
  usePageTitle('Stockage');
  const [activeTab, setActiveTab] = useState("storage-rules");

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 pb-24 w-full">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Storage & Indexing</h1>
          <p className="text-muted-foreground">
            Manage how files are physically routed in storage backends and specify exactly which folders should be synchronized with the AI Vector database.
          </p>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-6 h-12 w-full justify-start bg-muted/50 p-1">
                <TabsTrigger
                  value="storage-rules"
                  className="flex items-center gap-2 rounded-md px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <HardDrive className="h-4 w-4" />
                  Storage Rules
                </TabsTrigger>
                <TabsTrigger
                  value="ai-indexing"
                  className="flex items-center gap-2 rounded-md px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <BrainCircuit className="h-4 w-4" />
                  AI Indexing
                </TabsTrigger>
                <TabsTrigger
                  value="webdav"
                  className="flex items-center gap-2 rounded-md px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Network className="h-4 w-4" />
                  WebDAV
                </TabsTrigger>
              </TabsList>

              <TabsContent value="storage-rules" className="space-y-4 m-0">
                <div className="bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 border p-4 rounded-lg flex gap-3 text-sm items-start mb-6">
                  <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Administrative Rules applied on upload</p>
                    <p>
                      Storage rules dictate where new files are placed (on specific disk backends or S3 buckets) depending on their file type and MIME representation. Modifications here <b>do not retroactively move existing files</b>.
                    </p>
                  </div>
                </div>
                <StorageRulesSettings />
              </TabsContent>

              <TabsContent value="ai-indexing" className="space-y-4 m-0">
                 <div className="bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400 border p-4 rounded-lg flex gap-3 text-sm items-start mb-6">
                  <BrainCircuit className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Vector Database Synchronization</p>
                    <p>
                      By default, new files are not fed to the LLM. Define folder paths and criteria below to ensure specific documents are chunked and available for RAG (Retrieval Augmented Generation).
                    </p>
                  </div>
                </div>
                <AiIndexingSettings />
              </TabsContent>

              <TabsContent value="webdav" className="space-y-4 m-0">
                <WebDavConfig />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
