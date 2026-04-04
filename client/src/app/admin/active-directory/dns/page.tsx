"use client";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { Globe } from "lucide-react";

export default function AdDnsPage() {
  usePageTitle("DNS — Active Directory");
  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Zones DNS"
          description="Gestion des zones et enregistrements DNS Active Directory"
          icon={<Globe className="h-5 w-5" />}
        />
        <div className="text-muted-foreground text-center py-12">
          Page DNS en cours de construction
        </div>
      </div>
    </AppLayout>
  );
}
