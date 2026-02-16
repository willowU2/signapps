/**
 * Notification Badge Component
 * Displays unread notification count in the header
 */

'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import useUnreadCount from '@/hooks/use-unread-count';

export interface NotificationBadgeProps {
  className?: string;
}

/**
 * Badge component to show unread notification count
 */
export function NotificationBadge({ className = '' }: NotificationBadgeProps) {
  const { unreadCount } = useUnreadCount(30000); // Poll every 30 seconds

  return (
    <div className={`relative ${className}`}>
      <Bell className="h-5 w-5 text-gray-700" />
      {unreadCount > 0 && (
        <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs">
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </div>
  );
}

export default NotificationBadge;
