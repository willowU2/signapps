'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * OAuth callback landing page.
 *
 * The Rust backend redirects here after a successful OAuth token exchange:
 *   /social/oauth/callback?oauth_success=true&platform=twitter&account_id=UUID
 *
 * If opened as a popup (window.opener exists) it posts a message to the parent
 * window then closes itself. Otherwise it redirects to the accounts page.
 */
export default function OAuthCallbackPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    const success = searchParams.get('oauth_success') === 'true';
    const platform = searchParams.get('platform') ?? '';
    const accountId = searchParams.get('account_id') ?? '';
    const error = searchParams.get('oauth_error');

    if (success) {
      setStatus('success');
      if (window.opener) {
        // Popup flow: notify parent and close
        window.opener.postMessage(
          { type: 'oauth-success', platform, accountId },
          window.location.origin,
        );
        window.close();
      } else {
        // Full-page redirect flow
        window.location.href = `/social/accounts?connected=true&platform=${encodeURIComponent(platform)}`;
      }
    } else {
      setStatus('error');
      const desc = error ?? 'unknown_error';
      if (window.opener) {
        window.opener.postMessage(
          { type: 'oauth-error', platform, error: desc },
          window.location.origin,
        );
        window.close();
      } else {
        window.location.href = `/social/accounts?oauth_error=${encodeURIComponent(desc)}&platform=${encodeURIComponent(platform)}`;
      }
    }
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-3">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground text-sm">Connecting account…</p>
          </>
        )}
        {status === 'success' && (
          <p className="text-green-600 font-medium">Account connected! Closing…</p>
        )}
        {status === 'error' && (
          <p className="text-destructive font-medium">Connection failed. Redirecting…</p>
        )}
      </div>
    </div>
  );
}
