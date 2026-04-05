"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { ContainerResources } from "@/components/admin/container-resources";
import { Box } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";

export default function ContainerResourcesPage() {
  usePageTitle("Ressources conteneurs");
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          title="Container Resources"
          icon={<Box className="h-5 w-5 text-primary" />}
        />
        <ContainerResources />
      </div>
    </AppLayout>
  );
}
