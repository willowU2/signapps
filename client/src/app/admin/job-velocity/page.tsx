"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { JobVelocity } from "@/components/admin/job-velocity";
import { Zap } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";

export default function JobVelocityPage() {
  usePageTitle("Velocite");
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          title="Job Velocity"
          icon={<Zap className="h-5 w-5 text-primary" />}
        />
        <JobVelocity />
      </div>
    </AppLayout>
  );
}
