'use client';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export type OnlineStatus = 'online' | 'offline' | 'away' | 'busy';

interface AvatarWithStatusProps {
  src?: string | null;
  fallback: string;
  status?: OnlineStatus;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  alt?: string;
}

const STATUS_DOT: Record<OnlineStatus, string> = {
  online:  'bg-green-500',
  offline: 'bg-gray-400',
  away:    'bg-yellow-500',
  busy:    'bg-red-500',
};

const STATUS_LABEL: Record<OnlineStatus, string> = {
  online:  'En ligne',
  offline: 'Hors ligne',
  away:    'Absent',
  busy:    'Occupé',
};

/**
 * COH-049 — AvatarWithStatus: avatar + online/offline dot indicator
 */
export function AvatarWithStatus({
  src,
  fallback,
  status,
  size = 'default',
  className,
  alt,
}: AvatarWithStatusProps) {
  return (
    <div className={cn('relative inline-flex shrink-0', className)}>
      <Avatar size={size}>
        {src && <AvatarImage src={src} alt={alt ?? fallback} />}
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      {status && (
        <span
          aria-label={STATUS_LABEL[status]}
          title={STATUS_LABEL[status]}
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-background',
            STATUS_DOT[status],
            size === 'sm'      ? 'h-2 w-2' :
            size === 'lg'      ? 'h-3.5 w-3.5' :
                                 'h-2.5 w-2.5',
          )}
        />
      )}
    </div>
  );
}
