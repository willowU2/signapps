'use client';

import { useEffect } from 'react';
import { usePresenceStore, UserPresence } from '@/stores/presence-store';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
    user: UserPresence;
    size?: 'sm' | 'md' | 'lg';
}

function UserAvatar({ user, size = 'md' }: UserAvatarProps) {
    const sizeClasses = {
        sm: 'h-6 w-6 text-xs',
        md: 'h-8 w-8 text-sm',
        lg: 'h-10 w-10 text-base',
    };

    const initials = user.username
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div
            className={cn(
                'rounded-full flex items-center justify-center font-medium text-white ring-2 ring-background',
                sizeClasses[size]
            )}
            style={{ backgroundColor: user.color }}
            title={user.username}
        >
            {initials}
        </div>
    );
}

interface UserPresenceListProps {
    maxVisible?: number;
}

export function UserPresenceList({ maxVisible = 5 }: UserPresenceListProps) {
    const users = usePresenceStore((state) => state.users);
    const currentUserId = usePresenceStore((state) => state.currentUserId);
    const clearInactiveUsers = usePresenceStore((state) => state.clearInactiveUsers);

    // Clear inactive users every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            clearInactiveUsers(60000); // 1 minute timeout
        }, 30000);
        return () => clearInterval(interval);
    }, [clearInactiveUsers]);

    const onlineUsers = Array.from(users.values())
        .filter((u) => u.isOnline && u.userId !== currentUserId);

    const visibleUsers = onlineUsers.slice(0, maxVisible);
    const hiddenCount = onlineUsers.length - maxVisible;

    if (onlineUsers.length === 0) {
        return null;
    }

    return (
        <div className="flex items-center -space-x-2">
            {visibleUsers.map((user) => (
                <UserAvatar key={user.userId} user={user} />
            ))}
            {hiddenCount > 0 && (
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium ring-2 ring-background">
                    +{hiddenCount}
                </div>
            )}
        </div>
    );
}

interface ConnectionStatusProps {
    className?: string;
}

export function ConnectionStatus({ className }: ConnectionStatusProps) {
    const connectionStatus = usePresenceStore((state) => state.connectionStatus);
    const isSynced = usePresenceStore((state) => state.isSynced);
    const pendingChanges = usePresenceStore((state) => state.pendingChanges);

    const statusConfig = {
        connecting: {
            color: 'bg-yellow-500',
            text: 'Connecting...',
            pulse: true,
        },
        connected: {
            color: isSynced ? 'bg-green-500' : 'bg-yellow-500',
            text: isSynced ? 'Synced' : 'Syncing...',
            pulse: !isSynced,
        },
        disconnected: {
            color: 'bg-red-500',
            text: pendingChanges > 0 ? `Offline (${pendingChanges} pending)` : 'Offline',
            pulse: false,
        },
        reconnecting: {
            color: 'bg-yellow-500',
            text: 'Reconnecting...',
            pulse: true,
        },
    };

    const config = statusConfig[connectionStatus];

    return (
        <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
            <div className="relative">
                <div
                    className={cn('h-2 w-2 rounded-full', config.color)}
                />
                {config.pulse && (
                    <div
                        className={cn(
                            'absolute inset-0 h-2 w-2 rounded-full animate-ping',
                            config.color,
                            'opacity-75'
                        )}
                    />
                )}
            </div>
            <span>{config.text}</span>
        </div>
    );
}

interface RemoteCursorProps {
    user: UserPresence;
}

export function RemoteCursor({ user }: RemoteCursorProps) {
    if (!user.cursor) return null;

    return (
        <div
            className="pointer-events-none absolute z-50"
            style={{
                left: user.cursor.x,
                top: user.cursor.y,
                transform: 'translate(-2px, -2px)',
            }}
        >
            {/* Cursor */}
            <svg
                className="h-4 w-4"
                style={{ color: user.color }}
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35z" />
            </svg>
            {/* Username label */}
            <div
                className="absolute left-4 top-0 px-1.5 py-0.5 rounded text-xs text-white whitespace-nowrap"
                style={{ backgroundColor: user.color }}
            >
                {user.username}
            </div>
        </div>
    );
}

export function RemoteCursors() {
    const users = usePresenceStore((state) => state.users);
    const currentUserId = usePresenceStore((state) => state.currentUserId);

    const usersWithCursors = Array.from(users.values())
        .filter((u) => u.isOnline && u.userId !== currentUserId && u.cursor);

    return (
        <>
            {usersWithCursors.map((user) => (
                <RemoteCursor key={user.userId} user={user} />
            ))}
        </>
    );
}
