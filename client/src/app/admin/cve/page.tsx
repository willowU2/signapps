"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { CveDashboard } from "@/components/admin/cve-dashboard";
import { ShieldAlert } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";

export default function CvePage() {
  usePageTitle("Vulnerabilites");
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          title="CVE Dashboard"
          icon={<ShieldAlert className="h-5 w-5 text-primary" />}
        />
        <CveDashboard />
      </div>
    </AppLayout>
  );
}
