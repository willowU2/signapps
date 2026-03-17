"use client";

import { TenantSettingsPage } from "@/lib/tenant";
import { AdminOnly } from "@/lib/permissions";

export default function AdminTenantPage() {
  return (
    <AdminOnly fallback={
      <div className="container py-6">
        <p className="text-muted-foreground">
          Vous n'avez pas les permissions pour accéder à cette page.
        </p>
      </div>
    }>
      <div className="container max-w-4xl py-6">
        <TenantSettingsPage />
      </div>
    </AdminOnly>
  );
}
