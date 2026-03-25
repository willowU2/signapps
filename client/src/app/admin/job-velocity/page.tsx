'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { JobVelocity } from '@/components/admin/job-velocity';
import { Zap } from 'lucide-react';

export default function JobVelocityPage() {
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Job Velocity</h1>
        </div>
        <JobVelocity />
      </div>
    </AppLayout>
  );
}
