/**
 * Real-time presence indicator component
 * Displays active users, their status, and what they're editing
 */

import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, Edit3, Eye, Clock } from 'lucide-react';

interface PresenceUser {
  user_id: string;
  username: string;
  status: 'join' | 'leave' | 'viewing' | 'editing' | 'idle';
  editing_item_id?: string;
  timestamp: number;
}

interface PresenceIndicatorProps {
  users: PresenceUser[];
  currentUserId?: string;
}

/**
 * Get status display text
 */
function getStatusLabel(status: string, editingItemId?: string): string {
  switch (status) {
    case 'viewing':
      return 'Viewing';
    case 'editing':
      return editingItemId ? `Editing...` : 'Editing';
    case 'idle':
      return 'Idle';
    case 'join':
      return 'Joined';
    case 'leave':
      return 'Left';
    default:
      return 'Online';
  }
}

/**
 * Get status color
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'viewing':
      return 'bg-blue-500';
    case 'editing':
      return 'bg-yellow-500';
    case 'idle':
      return 'bg-gray-400';
    case 'join':
    case 'leave':
      return 'bg-green-500';
    default:
      return 'bg-gray-300';
  }
}

/**
 * Get status icon
 */
function getStatusIcon(status: string) {
  switch (status) {
    case 'viewing':
      return <Eye className="h-3 w-3" />;
    case 'editing':
      return <Edit3 className="h-3 w-3" />;
    case 'idle':
      return <Clock className="h-3 w-3" />;
    default:
      return null;
  }
}

/**
 * Get user initials for avatar
 */
function getUserInitials(username: string): string {
  return username
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Single user presence badge
 */
function PresenceUserBadge({
  user,
  isCurrentUser,
}: {
  user: PresenceUser;
  isCurrentUser: boolean;
}) {
  const statusLabel = getStatusLabel(user.status, user.editing_item_id);
  const statusColor = getStatusColor(user.status);
  const statusIcon = getStatusIcon(user.status);

  const tooltip = `${user.username} - ${statusLabel}${
    user.editing_item_id ? ` (${user.editing_item_id})` : ''
  }`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Avatar className="h-7 w-7 border-2 border-white">
              <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-600 text-xs text-white">
                {getUserInitials(user.username)}
              </AvatarFallback>
            </Avatar>
            {/* Status indicator dot */}
            <div
              className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full ${statusColor} border border-white`}
              title={statusLabel}
            />
          </div>
          {isCurrentUser && (
            <Badge variant="secondary" className="text-xs">
              You
            </Badge>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Main presence indicator component
 */
export function PresenceIndicator({ users, currentUserId }: PresenceIndicatorProps) {
  // Filter out left users
  const activeUsers = users.filter((u) => u.status !== 'leave');

  if (activeUsers.length === 0) {
    return null;
  }

  const editingUsers = activeUsers.filter((u) => u.status === 'editing');
  const viewingUsers = activeUsers.filter((u) => u.status === 'viewing');

  return (
    <div className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 dark:from-blue-950/30 dark:to-indigo-950/30">
      {/* User avatars */}
      <div className="flex items-center gap-1">
        <Users className="h-4 w-4 text-muted-foreground" />
        <div className="flex -space-x-2">
          {activeUsers.slice(0, 3).map((user) => (
            <PresenceUserBadge
              key={user.user_id}
              user={user}
              isCurrentUser={user.user_id === currentUserId}
            />
          ))}
          {activeUsers.length > 3 && (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold dark:bg-gray-700">
              +{activeUsers.length - 3}
            </div>
          )}
        </div>
      </div>

      {/* Status summary */}
      <div className="flex gap-2 text-xs text-muted-foreground">
        {editingUsers.length > 0 && (
          <span className="flex items-center gap-1">
            <Edit3 className="h-3 w-3" />
            {editingUsers.length} editing
          </span>
        )}
        {viewingUsers.length > 0 && (
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {viewingUsers.length} viewing
          </span>
        )}
      </div>

      {/* Live indicator pulse */}
      <div className="ml-auto flex items-center gap-1">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs font-medium text-green-700 dark:text-green-400">
          Live
        </span>
      </div>
    </div>
  );
}

/**
 * Compact presence indicator (for headers)
 */
export function CompactPresenceIndicator({
  users,
  currentUserId,
}: PresenceIndicatorProps) {
  const activeUsers = users.filter((u) => u.status !== 'leave');

  if (activeUsers.length === 0) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-muted-foreground">
            {activeUsers.length}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          {activeUsers.map((user) => (
            <div key={user.user_id} className="text-xs">
              {user.username}{' '}
              <span className="text-muted-foreground">
                ({getStatusLabel(user.status)})
              </span>
              {user.user_id === currentUserId && ' (you)'}
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Editing indicator for specific item
 */
export function ItemEditingIndicator({
  users,
  itemId,
}: {
  users: PresenceUser[];
  itemId: string;
}) {
  const editingUsers = users.filter(
    (u) => u.status === 'editing' && u.editing_item_id === itemId
  );

  if (editingUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded bg-yellow-50 px-2 py-1 text-xs dark:bg-yellow-950/30">
      <Edit3 className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
      <span className="text-yellow-700 dark:text-yellow-300">
        {editingUsers.map((u) => u.username).join(', ')} editing...
      </span>
    </div>
  );
}
