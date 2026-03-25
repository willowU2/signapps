'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { WebhookManager } from '@/components/admin/webhook-manager';
import { Webhook } from 'lucide-react';

export default function WebhooksPage() {
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Webhook className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Webhook Management</h1>
        </div>
        <WebhookManager />
      </div>
    </AppLayout>
  );
}
