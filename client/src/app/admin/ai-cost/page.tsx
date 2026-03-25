'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { AiCostTracker } from '@/components/admin/ai-cost-tracker';
import { Brain } from 'lucide-react';

export default function AiCostPage() {
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">AI Cost Tracker</h1>
        </div>
        <AiCostTracker />
      </div>
    </AppLayout>
  );
}
