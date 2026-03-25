'use client';

import { Eye, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface GuestBadgeProps {
  /** Whether the current viewer is a guest */
  isGuest?: boolean;
  /** Permission level of the guest */
  permission?: 'read' | 'comment';
  /** Expiry date of the guest access */
  expiresAt?: string | null;
  /** Size variant */
  size?: 'sm' | 'md';
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function GuestBadge({
  isGuest = true,
  permission = 'read',
  expiresAt,
  size = 'md',
  className,
}: GuestBadgeProps) {
  if (!isGuest) return null;

  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

  if (isExpired) {
    return (
      <Badge
        variant="destructive"
        className={cn(
          'gap-1',
          size === 'sm' && 'text-[10px] h-5 px-1.5',
          className
        )}
      >
        <UserX className={cn('shrink-0', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
        Acces expire
      </Badge>
    );
  }

  const label = permission === 'read' ? 'Invite - Lecture seule' : 'Invite - Lecture + Commentaires';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={cn(
              'gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
              size === 'sm' && 'text-[10px] h-5 px-1.5',
              className
            )}
          >
            <Eye
              className={cn(
                'shrink-0',
                size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'
              )}
            />
            Invite
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{label}</p>
            {expiresAt && (
              <p className="text-xs text-muted-foreground">
                Expire le {new Date(expiresAt).toLocaleDateString()}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Acces sans connexion via lien partage
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default GuestBadge;
