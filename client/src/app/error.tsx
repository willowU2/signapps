'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.debug('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md">
        {/* Error Icon */}
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-12 w-12 text-destructive" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Erreur serveur</h1>
          <p className="text-muted-foreground">
            Une erreur inattendue s'est produite. Veuillez réessayer ou retourner au tableau de bord.
          </p>
        </div>

        {/* Error details (development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="rounded-lg border bg-muted/50 p-4 text-left">
            <p className="text-sm font-medium text-destructive mb-2">Détails de l'erreur :</p>
            <code className="text-xs text-muted-foreground break-all">
              {error.message}
            </code>
            {error.digest && (
              <p className="text-xs text-muted-foreground mt-2">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
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
          Si le problème persiste, veuillez contacter le support.
        </p>
      </div>
    </div>
  );
}
