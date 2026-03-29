'use client';

import Link from 'next/link';
import { AlertTriangle, Ban, Search, ServerCrash, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type HttpErrorCode = 401 | 403 | 404 | 500;

interface HttpErrorPageProps {
  code?: HttpErrorCode;
  onRetry?: () => void;
  className?: string;
}

const ERROR_CONFIG: Record<HttpErrorCode, {
  icon: React.ElementType;
  iconClass: string;
  bgClass: string;
  title: string;
  description: string;
}> = {
  401: {
    icon: Ban,
    iconClass: 'text-yellow-600',
    bgClass: 'bg-yellow-50 dark:bg-yellow-900/20',
    title: 'Non authentifié',
    description: 'Vous devez être connecté pour accéder à cette page.',
  },
  403: {
    icon: Ban,
    iconClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    title: 'Accès refusé',
    description: 'Vous n\'avez pas les permissions nécessaires pour accéder à cette ressource.',
  },
  404: {
    icon: Search,
    iconClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
    title: 'Page non trouvée',
    description: 'La page que vous recherchez n\'existe pas ou a été déplacée.',
  },
  500: {
    icon: ServerCrash,
    iconClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    title: 'Erreur serveur',
    description: 'Une erreur inattendue s\'est produite. Nos équipes ont été notifiées.',
  },
};

/**
 * COH-064/065/066/067 — HttpErrorPage: standardized HTTP error pages
 * Handles 401 (login redirect), 403 (access denied), 404, 500 with retry
 */
export function HttpErrorPage({ code = 500, onRetry, className }: HttpErrorPageProps) {
  const config = ERROR_CONFIG[code];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex min-h-[60vh] flex-col items-center justify-center p-6 text-center',
        className,
      )}
    >
      <div className="space-y-6 max-w-sm">
        <div className={cn('mx-auto flex h-20 w-20 items-center justify-center rounded-full', config.bgClass)}>
          <Icon className={cn('h-10 w-10', config.iconClass)} />
        </div>
        <div className="space-y-2">
          <p className="text-4xl font-bold text-muted-foreground">{code}</p>
          <h2 className="text-xl font-semibold">{config.title}</h2>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          {code === 401 ? (
            <Link href="/login">
              <Button>Se connecter</Button>
            </Link>
          ) : (
            <>
              <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Button>
              {onRetry && (
                <Button variant="outline" onClick={onRetry} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Réessayer
                </Button>
              )}
              <Link href="/dashboard">
                <Button className="gap-2">
                  <Home className="h-4 w-4" />
                  Tableau de bord
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
