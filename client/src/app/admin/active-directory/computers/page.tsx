"use client";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { Monitor } from "lucide-react";

export default function AdComputersPage() {
  usePageTitle("Ordinateurs — Active Directory");
  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Comptes ordinateurs"
          description="Machines jointes au domaine"
          icon={<Monitor className="h-5 w-5" />}
        />
        <div className="text-muted-foreground text-center py-12">
          Page Ordinateurs en cours de construction
        </div>
      </div>
    </AppLayout>
  );
}
