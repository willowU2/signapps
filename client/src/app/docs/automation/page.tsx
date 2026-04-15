"use client";

// Document Automation page — 269–276

import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database,
  Zap,
  FileText,
  Package,
  GitBranch,
  Stamp,
  Hash,
  Calendar,
} from "lucide-react";
import { DocMergeFields } from "@/components/documents/doc-merge-fields";
import { FormToDocMapper } from "@/components/documents/form-to-doc";
import { PdfFormFiller } from "@/components/documents/pdf-form-filler";
import { BulkPdfGenerator } from "@/components/documents/bulk-pdf-generator";
import { DocWorkflowStatus } from "@/components/documents/doc-workflow-status";
import { DigitalStampConfig } from "@/components/documents/digital-stamp";
import { DocNumberingSchemes } from "@/components/documents/doc-numbering";
import { DocExpiryAlerts } from "@/components/documents/doc-expiry-alerts";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/use-page-title";

export default function DocumentAutomationPage() {
  usePageTitle("Automatisation documents");
  return (
    <AppLayout>
      <div className="w-full space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Document Automation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Merge fields, form-to-doc, PDF filling, bulk generation, workflows,
            stamps, numbering, and expiry tracking.
          </p>
        </div>

        <Tabs defaultValue="merge-fields">
          <TabsList className="flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="merge-fields" className="gap-1 text-xs">
              <Database className="h-3.5 w-3.5" /> Merge Fields
            </TabsTrigger>
            <TabsTrigger value="form-to-doc" className="gap-1 text-xs">
              <Zap className="h-3.5 w-3.5" /> Form→Doc
            </TabsTrigger>
            <TabsTrigger value="pdf-fill" className="gap-1 text-xs">
              <FileText className="h-3.5 w-3.5" /> PDF Fill
            </TabsTrigger>
            <TabsTrigger value="bulk-pdf" className="gap-1 text-xs">
              <Package className="h-3.5 w-3.5" /> Bulk PDF
            </TabsTrigger>
            <TabsTrigger value="workflow" className="gap-1 text-xs">
              <GitBranch className="h-3.5 w-3.5" /> Workflow
            </TabsTrigger>
            <TabsTrigger value="stamp" className="gap-1 text-xs">
              <Stamp className="h-3.5 w-3.5" /> Stamp
            </TabsTrigger>
            <TabsTrigger value="numbering" className="gap-1 text-xs">
              <Hash className="h-3.5 w-3.5" /> Numbering
            </TabsTrigger>
            <TabsTrigger value="expiry" className="gap-1 text-xs">
              <Calendar className="h-3.5 w-3.5" /> Expiry
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="merge-fields">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Insert DB-backed variables into document templates. Click a
                  field to insert its token.
                </p>
                <DocMergeFields
                  onInsert={(token) => toast.info(`Token copié : ${token}`)}
                />
              </div>
            </TabsContent>

            <TabsContent value="form-to-doc">
              <FormToDocMapper />
            </TabsContent>

            <TabsContent value="pdf-fill">
              <PdfFormFiller />
            </TabsContent>

            <TabsContent value="bulk-pdf">
              <BulkPdfGenerator />
            </TabsContent>

            <TabsContent value="workflow">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Example document workflow. In production, pass real documentId
                  and history from the document context.
                </p>
                <DocWorkflowStatus
                  documentId="demo-doc"
                  currentStep="draft"
                  history={[]}
                  onTransition={async (id, step, comment) => {
                    toast.success(
                      `Moved to ${step}${comment ? ` · ${comment}` : ""}`,
                    );
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="stamp">
              <DigitalStampConfig />
            </TabsContent>

            <TabsContent value="numbering">
              <DocNumberingSchemes />
            </TabsContent>

            <TabsContent value="expiry">
              <DocExpiryAlerts />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}
