"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { UserActivity } from "@/components/admin/user-activity";
import { Users } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";

export default function UserActivityPage() {
  usePageTitle("Activite utilisateurs");
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          title="User Activity Report"
          icon={<Users className="h-5 w-5 text-primary" />}
        />
        <UserActivity />
      </div>
    </AppLayout>
  );
}
