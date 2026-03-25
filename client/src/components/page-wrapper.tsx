'use client';

import { Suspense, ReactNode } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { PageSkeleton } from '@/components/page-skeleton';

interface PageWrapperProps {
  children: ReactNode;
  cards?: number;
  rows?: number;
  fallback?: ReactNode;
}

/**
 * Combines ErrorBoundary + Suspense + PageSkeleton for consistent page loading UX.
 * Use this to wrap page content that fetches data.
 */
export function PageWrapper({ children, cards = 3, rows = 5, fallback }: PageWrapperProps) {
  return (
    <ErrorBoundary>
      <Suspense fallback={fallback || <PageSkeleton cards={cards} rows={rows} />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
