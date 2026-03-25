'use client';

import { useEffect } from 'react';
import { usePresenceStore, type UserPresence } from '@/stores/presence-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface PresenceAvatarsProps {
  /** Maximum number of avatars to display before showing "+N" */
  maxVisible?: number;
  /** Avatar size variant */
  size?: 'sm' | 'md';
  /** Extra CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Compact avatar stack showing who is currently viewing the same
 * document / page.  Designed to sit in the top-right of an editor header.
 */
export function PresenceAvatars({
  maxVisible = 4,
  size = 'sm',
  className,
}: PresenceAvatarsProps) {
  const users = usePresenceStore((s) => s.users);
  const currentUserId = usePresenceStore((s) => s.currentUserId);
  const clearInactiveUsers = usePresenceStore((s) => s.clearInactiveUsers);

  // Periodically prune stale users
  useEffect(() => {
    const interval = setInterval(() => {
      clearInactiveUsers(60_000);
    }, 30_000);
    return () => clearInterval(interval);
  }, [clearInactiveUsers]);

  const onlineUsers = Array.from(users.values()).filter(
    (u) => u.isOnline && u.userId !== currentUserId,
  );

  if (onlineUsers.length === 0) return null;

  const visible = onlineUsers.slice(0, maxVisible);
  const overflow = onlineUsers.length - maxVisible;

  const avatarCls = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-8 w-8 text-xs';

  return (
    <div
      className={cn('flex items-center -space-x-2', className)}
      aria-label={`${onlineUsers.length} utilisateur(s) en ligne`}
    >
      {visible.map((user) => (
        <PresenceAvatar key={user.userId} user={user} avatarCls={avatarCls} />
      ))}

      {overflow > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex items-center justify-center rounded-full bg-muted font-medium ring-2 ring-background cursor-default',
                avatarCls,
              )}
            >
              +{overflow}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {onlineUsers
              .slice(maxVisible)
              .map((u) => u.username)
              .join(', ')}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// ============================================================================
// Single avatar with tooltip
// ============================================================================

function PresenceAvatar({
  user,
  avatarCls,
}: {
  user: UserPresence;
  avatarCls: string;
}) {
  const initials = user.username
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar
          className={cn(
            'ring-2 ring-background cursor-default transition-transform hover:scale-110 hover:z-10',
            avatarCls,
          )}
        >
          <AvatarImage src={undefined} />
          <AvatarFallback
            className="font-medium text-white"
            style={{ backgroundColor: user.color }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {user.username}
        <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
      </TooltipContent>
    </Tooltip>
  );
}

export default PresenceAvatars;
