'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { ContainerResources } from '@/components/admin/container-resources';
import { Box } from 'lucide-react';
import { usePageTitle } from '@/hooks/use-page-title';

export default function ContainerResourcesPage() {
  usePageTitle('Ressources conteneurs');
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Box className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Container Resources</h1>
        </div>
        <ContainerResources />
      </div>
    </AppLayout>
  );
}
