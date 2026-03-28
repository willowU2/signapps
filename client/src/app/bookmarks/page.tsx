'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { BookmarksPage } from '@/components/crosslinks/CrossModuleFavorites';
import { Star } from 'lucide-react';

export default function BookmarksRoute() {
  return (
    <AppLayout>
      <div className="container max-w-4xl py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Star className="w-6 h-6 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold">Favoris</h1>
            <p className="text-sm text-muted-foreground">Vos éléments marqués comme favoris dans tous les modules</p>
          </div>
        </div>
        <BookmarksPage />
      </div>
    </AppLayout>
  );
}
