'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePageTitle } from '@/hooks/use-page-title';

/**
 * Webhook Management — redirects to the Settings page "webhooks" tab.
 * Full CRUD for webhooks (URL, events, secret) lives in /settings?tab=webhooks.
 */
export default function WebhooksPage() {
  usePageTitle('Webhooks');
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings?tab=webhooks');
  }, [router]);

  return null;
}
