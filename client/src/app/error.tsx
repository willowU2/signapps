'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Copy, Check } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.warn('Application error:', error);
  }, [error]);

  const copyError = async () => {
    const errorText = [
      `Error: ${error.message}`,
      error.digest ? `Digest: ${error.digest}` : '',
      `URL: ${window.location.href}`,
      `Date: ${new Date().toISOString()}`,
      error.stack ? `\nStack:\n${error.stack}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(errorText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = errorText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md">
        {/* Error Icon */}
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-12 w-12 text-destructive" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Erreur inattendue</h1>
          <p className="text-muted-foreground">
            Une erreur inattendue s&apos;est produite. Veuillez recharger la page ou retourner au tableau de bord.
          </p>
        </div>

        {/* Error details */}
        <div className="rounded-lg border bg-muted/50 p-4 text-left">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-destructive">Détails de l&apos;erreur</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyError}
              className="h-7 px-2 text-xs"
            >
              {copied ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  Copié
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" />
                  Copier l&apos;erreur
                </>
              )}
            </Button>
          </div>
          <code className="text-xs text-muted-foreground break-all block">
            {error.message}
          </code>
          {error.digest && (
            <p className="text-xs text-muted-foreground mt-2">
              Digest: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Recharger la page
          </Button>
          <Button variant="outline" onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Réessayer
          </Button>
          <Link href="/dashboard">
            <Button>
              <Home className="mr-2 h-4 w-4" />
              Tableau de bord
            </Button>
          </Link>
        </div>

        {/* Help text */}
        <p className="text-sm text-muted-foreground">
          Si le problème persiste, copiez l&apos;erreur et contactez le support.
        </p>
      </div>
    </div>
  );
}
