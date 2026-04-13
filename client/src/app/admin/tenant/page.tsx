"use client";

import { TenantSettingsPage } from "@/lib/tenant";
import { AdminOnly } from "@/lib/permissions";
import { usePageTitle } from '@/hooks/use-page-title';
import { AppLayout } from "@/components/layout/app-layout";

export default function AdminTenantPage() {
  usePageTitle('Tenant');
  return (
    <AppLayout>
      <AdminOnly fallback={
        <div className="container py-6">
          <p className="text-muted-foreground">
            Vous n'avez pas les permissions pour accéder à cette page.
          </p>
        </div>
      }>
        <div className="w-full py-6">
          <TenantSettingsPage />
        </div>
      </AdminOnly>
    </AppLayout>
  );
}
