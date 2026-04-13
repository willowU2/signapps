"use client";

import SlidesDashboard from "@/components/slides/dashboard";
import { usePageTitle } from "@/hooks/use-page-title";
import { AppLayout } from "@/components/layout/app-layout";

export default function SlidesPage() {
  usePageTitle("Présentations");
  return (
    <AppLayout>
      <div
        data-testid="slides-root"
        className="flex-1 flex flex-col min-h-0 overflow-hidden glass-panel rounded-2xl shadow-premium border border-border/50"
      >
        <SlidesDashboard />
      </div>
    </AppLayout>
  );
}
