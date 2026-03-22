'use client';

import { Globe } from 'lucide-react';

export function SimultaneousTranslationStub() {
  return (
    <div className="w-full max-w-md mx-auto p-6 bg-card border border-input rounded-lg shadow-sm">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-4 bg-muted rounded-full">
            <Globe className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Traduction Simultanée
        </h2>
        <p className="text-sm text-muted-foreground">
          Coming soon. Real-time translation during meetings and conversations in multiple languages.
        </p>
      </div>
    </div>
  );
}
