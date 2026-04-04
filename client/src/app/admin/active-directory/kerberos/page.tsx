"use client";
import { AppLayout } from "@/components/layout/app-layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { Key } from "lucide-react";

export default function AdKerberosPage() {
  usePageTitle("Kerberos — Active Directory");
  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Kerberos KDC"
          description="Gestion des principals, cles et tickets Kerberos"
          icon={<Key className="h-5 w-5" />}
        />
        <div className="text-muted-foreground text-center py-12">
          Page Kerberos en cours de construction
        </div>
      </div>
    </AppLayout>
  );
}
