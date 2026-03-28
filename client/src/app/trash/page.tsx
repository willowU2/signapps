'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { UnifiedTrash } from '@/components/crosslinks/UnifiedTrash';
import { Trash2 } from 'lucide-react';

export default function TrashRoute() {
  return (
    <AppLayout>
      <div className="w-full py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Trash2 className="w-6 h-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">Corbeille</h1>
            <p className="text-sm text-muted-foreground">Éléments supprimés dans tous les modules — restaurez ou purgez</p>
          </div>
        </div>
        <UnifiedTrash />
      </div>
    </AppLayout>
  );
}
