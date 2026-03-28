'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { BackupScheduleConfig } from '@/components/admin/backup-schedule-config';
import { Database } from 'lucide-react';
import { usePageTitle } from '@/hooks/use-page-title';

export default function BackupAdminPage() {
  usePageTitle('Sauvegardes');
  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Backup Configuration</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Schedule automatic backups and configure retention policies.
            </p>
          </div>
        </div>

        <BackupScheduleConfig />
      </div>
    </AppLayout>
  );
}
