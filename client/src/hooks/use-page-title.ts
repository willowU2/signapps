'use client';

import { useEffect } from 'react';

/**
 * Sets the browser tab title for the current page.
 * Format: "<Page> — SignApps"
 */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} — SignApps`;
    return () => {
      document.title = 'SignApps';
    };
  }, [title]);
}
