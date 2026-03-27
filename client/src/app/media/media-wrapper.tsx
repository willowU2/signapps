"use client";

import dynamic from 'next/dynamic';

export const MediaContent = dynamic(() => import('./media-content'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
      Loading Media Tools…
    </div>
  ),
});
