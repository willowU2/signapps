"use client";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { FileText } from "lucide-react";

export default function AdGpoPage() {
  usePageTitle("GPO — Active Directory");
  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Strategies de groupe (GPO)"
          description="Group Policy Objects pour la configuration des postes"
          icon={<FileText className="h-5 w-5" />}
        />
        <div className="text-muted-foreground text-center py-12">
          Page GPO en cours de construction
        </div>
      </div>
    </AppLayout>
  );
}
