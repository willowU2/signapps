"use client";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { Shield } from "lucide-react";

export default function AdSecurityPage() {
  usePageTitle("Securite — Active Directory");
  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Securite AD"
          description="Audit, politiques de mot de passe et delegations"
          icon={<Shield className="h-5 w-5" />}
        />
        <div className="text-muted-foreground text-center py-12">
          Page Securite en cours de construction
        </div>
      </div>
    </AppLayout>
  );
}
