'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { CveDashboard } from '@/components/admin/cve-dashboard';
import { ShieldAlert } from 'lucide-react';

export default function CvePage() {
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">CVE Dashboard</h1>
        </div>
        <CveDashboard />
      </div>
    </AppLayout>
  );
}
