'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Webhook Management — redirects to the Settings page "webhooks" tab.
 * Full CRUD for webhooks (URL, events, secret) lives in /settings?tab=webhooks.
 */
export default function WebhooksPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings?tab=webhooks');
  }, [router]);

  return null;
}
