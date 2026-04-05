"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  /** Error title (bold heading) */
  title?: string;
  /** Error description / detail message */
  message?: string;
  /** Additional description line (kept for backward compat) */
  description?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Additional className */
  className?: string;
}

/**
 * Standardized error display component.
 * Shows an alert icon, a title, an optional description, and an optional retry button.
 *
 * @example
 * ```tsx
 * <ErrorState
 *   title="Impossible de charger les données"
 *   message="Vérifiez votre connexion et réessayez."
 *   onRetry={refetch}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Minimal usage
 * <ErrorState onRetry={refetch} />
 * ```
 */
export function ErrorState({
  title = "Une erreur est survenue",
  message,
  description,
  onRetry,
  className,
}: ErrorStateProps) {
  const detail = message ?? description;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-12 px-6 text-center",
        className,
      )}
    >
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {detail && (
          <p className="text-xs text-muted-foreground max-w-sm">{detail}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Réessayer
        </Button>
      )}
    </div>
  );
}
