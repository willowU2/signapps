'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { AiCostTracker } from '@/components/admin/ai-cost-tracker';
import { Brain } from 'lucide-react';
import { usePageTitle } from '@/hooks/use-page-title';
import { PageHeader } from '@/components/ui/page-header';

export default function AiCostPage() {
  usePageTitle('Couts IA');
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          title="Coûts IA"
          description="Suivi des coûts d'utilisation des modèles IA"
          icon={<Brain className="h-5 w-5" />}
        />
        <AiCostTracker />
      </div>
    </AppLayout>
  );
}
