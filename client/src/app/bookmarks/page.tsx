"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { BookmarksPage } from "@/components/crosslinks/CrossModuleFavorites";
import { Star } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

export default function BookmarksRoute() {
  usePageTitle("Favoris");
  return (
    <AppLayout>
      <div className="w-full py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Star className="w-6 h-6 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold">Favoris</h1>
            <p className="text-sm text-muted-foreground">
              Vos éléments marqués comme favoris dans tous les modules
            </p>
          </div>
        </div>
        <BookmarksPage />
      </div>
    </AppLayout>
  );
}
