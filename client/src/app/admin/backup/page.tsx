'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { BackupScheduleConfig } from '@/components/admin/backup-schedule-config';
import { Database } from 'lucide-react';
import { usePageTitle } from '@/hooks/use-page-title';
import { PageHeader } from '@/components/ui/page-header';

export default function BackupAdminPage() {
  usePageTitle('Sauvegardes');
  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <PageHeader
          title="Configuration des sauvegardes"
          description="Planifiez les sauvegardes automatiques et configurez les politiques de rétention."
          icon={<Database className="h-5 w-5" />}
        />

        <BackupScheduleConfig />
      </div>
    </AppLayout>
  );
}
