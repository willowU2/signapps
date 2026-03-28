'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataMasking } from '@/components/data/data-masking';
import { GdprDeletionWorkflow } from '@/components/data/gdpr-deletion-workflow';
import { PiiDetector } from '@/components/data/pii-detector';
import { DataAnonymization } from '@/components/data/data-anonymization';
import { EyeOff, Shield, ShieldAlert, Wand2 } from 'lucide-react';

export default function DataManagementPage() {
  return (
    <AppLayout>
      <div className="w-full space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Data Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Data masking, GDPR deletion workflows, PII detection, and anonymization tools
          </p>
        </div>

        <Tabs defaultValue="masking">
          <TabsList className="flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="masking" className="gap-1.5 text-xs">
              <EyeOff className="h-3.5 w-3.5" />Masking
            </TabsTrigger>
            <TabsTrigger value="gdpr" className="gap-1.5 text-xs">
              <Shield className="h-3.5 w-3.5" />GDPR Deletion
            </TabsTrigger>
            <TabsTrigger value="pii" className="gap-1.5 text-xs">
              <ShieldAlert className="h-3.5 w-3.5" />PII Detector
            </TabsTrigger>
            <TabsTrigger value="anon" className="gap-1.5 text-xs">
              <Wand2 className="h-3.5 w-3.5" />Anonymization
            </TabsTrigger>
          </TabsList>

          <TabsContent value="masking" className="mt-4"><DataMasking /></TabsContent>
          <TabsContent value="gdpr" className="mt-4"><GdprDeletionWorkflow /></TabsContent>
          <TabsContent value="pii" className="mt-4"><PiiDetector /></TabsContent>
          <TabsContent value="anon" className="mt-4"><DataAnonymization /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
