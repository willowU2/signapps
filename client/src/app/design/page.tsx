"use client";

import DesignDashboard from "@/components/design/design-dashboard";
import { usePageTitle } from "@/hooks/use-page-title";
import { AppLayout } from "@/components/layout/app-layout";

export default function DesignPage() {
  usePageTitle("Design");
  return (
    <AppLayout>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden glass-panel rounded-2xl shadow-premium border border-border/50">
        <DesignDashboard />
      </div>
    </AppLayout>
  );
}
