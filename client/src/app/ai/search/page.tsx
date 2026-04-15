"use client";

import { MultimodalSearch } from "@/components/ai/multimodal-search";
import { usePageTitle } from "@/hooks/use-page-title";

export default function AiSearchPage() {
  usePageTitle("Recherche IA");
  return (
    <div className="w-full py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recherche IA</h1>
        <p className="text-muted-foreground">
          Recherche multimodale dans vos documents, images et fichiers audio
        </p>
      </div>

      {/* Search component */}
      <MultimodalSearch />
    </div>
  );
}
