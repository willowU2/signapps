'use client';

import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  /** Message to show below the spinner */
  message?: string;
  /** Size variant */
  size?: 'sm' | 'default' | 'lg';
  /** Fill the content area (centered) */
  fullPage?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-4 w-4 border',
  default: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-2',
};

/**
 * COH-069 — LoadingSpinner: standardized centered loading indicator
 * Usage: <LoadingSpinner /> or <LoadingSpinner message="Chargement..." />
 */
export function LoadingSpinner({
  message = 'Chargement...',
  size = 'default',
  fullPage = false,
  className,
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label={message}
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-muted-foreground',
        fullPage ? 'min-h-[50vh]' : 'py-12',
        className,
      )}
    >
      <span
        className={cn(
          'animate-spin rounded-full border-current border-t-transparent',
          SIZE_CLASSES[size],
        )}
      />
      {message && <span className="text-sm">{message}</span>}
    </div>
  );
}
