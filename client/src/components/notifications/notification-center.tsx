'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Bell,
  Container,
  Shield,
  HardDrive,
  User,
  Info,
  AlertTriangle,
  CheckCircle,
  X,
  BellOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useNotificationStore,
  useNotifications,
  useUnreadNotificationCount,
  useNotificationActions,
  type AppNotification,
  type NotificationType,
  type NotificationStatus,
} from '@/stores/notification-store';

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function getTypeIcon(type: NotificationType) {
  switch (type) {
    case 'container':
      return Container;
    case 'security':
      return Shield;
    case 'storage':
      return HardDrive;
    case 'user':
      return User;
    default:
      return Info;
  }
}

function StatusIcon({ status }: { status: NotificationStatus }) {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
    case 'warning':
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
    case 'error':
      return <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />;
    default:
      return <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
  }
}

// ─── Time formatter ───────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

// ─── Single notification row ──────────────────────────────────────────────────

interface NotificationItemProps {
  notification: AppNotification;
  onRead: (id: string) => void;
  onRemove: (id: string) => void;
}

function NotificationItem({ notification, onRead, onRemove }: NotificationItemProps) {
  const TypeIcon = getTypeIcon(notification.type);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onRead(notification.id)}
      onKeyDown={(e) => e.key === 'Enter' && onRead(notification.id)}
      className={cn(
        'relative flex gap-3 px-4 py-3 cursor-pointer transition-colors outline-none',
        'hover:bg-muted/50 focus-visible:bg-muted/50',
        !notification.read && 'bg-primary/5'
      )}
    >
      {/* Unread dot */}
      {!notification.read && (
        <span
          aria-label="Non lu"
          className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary"
        />
      )}

      {/* Type icon bubble */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <TypeIcon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <StatusIcon status={notification.status} />
          <p className="text-sm font-medium leading-snug truncate">
            {notification.title}
          </p>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {notification.description}
        </p>
        <p className="text-[11px] text-muted-foreground/70">
          {formatRelativeTime(notification.timestamp)}
        </p>
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Supprimer la notification"
        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 self-start mt-0.5"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(notification.id);
        }}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <BellOff className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Aucune notification</p>
      <p className="text-xs text-muted-foreground/70">
        Vous serez notifié ici lors d'événements importants.
      </p>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 px-4 py-3 animate-pulse">
          <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2 py-0.5">
            <div className="h-3 rounded bg-muted w-3/4" />
            <div className="h-2.5 rounded bg-muted w-full" />
            <div className="h-2 rounded bg-muted w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * NotificationCenter
 *
 * Bell icon button that opens a dropdown panel listing real-time notifications.
 * State is managed via the Zustand `useNotificationStore`. Listens for SSE
 * events dispatched on `window` by `useNotificationsSSE` so the list stays
 * in sync without polling.
 *
 * Usage:
 *   <NotificationCenter />
 */
export function NotificationCenter() {
  const isOpen = useNotificationStore((s) => s.isOpen);
  const isLoading = useNotificationStore((s) => s.isLoading);
  const notifications = useNotifications();
  const unreadCount = useUnreadNotificationCount();
  const { setOpen, markAsRead, markAllAsRead, remove, fetchNotifications, pushSSENotification } =
    useNotificationActions();

  // Initial load
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Listen for real-time SSE events dispatched by useNotificationsSSE
  useEffect(() => {
    const handleNewNotification = (e: Event) => {
      const detail = (e as CustomEvent<{ title?: string; message?: string; user_id?: string }>)
        .detail ?? {};
      pushSSENotification({
        id: `sse-${Date.now()}`,
        title: detail.title ?? 'Nouvelle notification',
        description: detail.message ?? '',
        type: 'system',
        status: 'info',
        timestamp: new Date(),
        read: false,
      });
    };

    window.addEventListener('new-notification', handleNewNotification);
    return () => window.removeEventListener('new-notification', handleNewNotification);
  }, [pushSSENotification]);

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className={cn(
                'absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center',
                'rounded-full bg-primary text-[10px] font-semibold text-primary-foreground',
                'ring-2 ring-background'
              )}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[360px] p-0 shadow-lg"
        align="end"
        sideOffset={8}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unreadCount > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllAsRead}
            >
              Marquer tout comme lu
            </Button>
          )}
        </div>

        <Separator />

        {/* ── Body ── */}
        <ScrollArea className="h-[340px]">
          {isLoading ? (
            <LoadingSkeleton />
          ) : notifications.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="group divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={markAsRead}
                  onRemove={remove}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
