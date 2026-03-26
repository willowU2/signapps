'use client';

import { MultimodalSearch } from '@/components/ai/multimodal-search';

export default function AiSearchPage() {
  return (
    <div className="container max-w-5xl py-6 space-y-6">
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
