'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  Container,
  Shield,
  HardDrive,
  User,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  Loader2,
} from 'lucide-react';
import { notificationsApi, type NotificationRecord } from '@/lib/api/calendar';

interface Notification {
  id: string;
  type: 'container' | 'security' | 'storage' | 'user' | 'system';
  title: string;
  message: string;
  status: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
}

function mapApiToNotification(record: NotificationRecord): Notification {
  // Map notification_type to UI type
  const typeMap: Record<string, Notification['type']> = {
    event_reminder: 'system',
    event_invitation: 'user',
    attendee_rsvp: 'user',
    task_assigned: 'system',
    task_completed: 'system',
    daily_digest: 'system',
    weekly_digest: 'system',
    container: 'container',
    security: 'security',
    storage: 'storage',
  };

  // Map status to UI status
  const statusMap: Record<string, Notification['status']> = {
    pending: 'info',
    sent: 'success',
    failed: 'error',
    delivered: 'success',
  };

  return {
    id: record.id,
    type: typeMap[record.notification_type] || 'system',
    title: record.notification_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    message: record.recipient_address ? `Envoyé à ${record.recipient_address}` : `Via ${record.channel}`,
    status: statusMap[record.status] || 'info',
    timestamp: new Date(record.created_at),
    read: record.status === 'sent' || record.status === 'delivered',
  };
}

export function NotificationPopover() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await notificationsApi.getHistory({ limit: 20 });
      const mapped = response.data.notifications.map(mapApiToNotification);
      setNotifications(mapped);
    } catch (err) {
      console.debug('Failed to load notifications:', err);
      // Keep empty on error - database is source of truth
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Refresh when popover opens
  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open, loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIcon = (type: Notification['type']) => {
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
  };

  const getStatusIcon = (status: Notification['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b p-3">
          <h4 className="font-semibold">Notifications</h4>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Loader2 className="h-8 w-8 text-muted-foreground mb-2 animate-spin" />
              <p className="text-sm text-muted-foreground">Chargement...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Aucune notification</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = getIcon(notification.type);
                return (
                  <div
                    key={notification.id}
                    className={`relative flex gap-3 p-3 hover:bg-muted/50 cursor-pointer ${
                      !notification.read ? 'bg-muted/30' : ''
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(notification.status)}
                          <p className="text-sm font-medium leading-none">
                            {notification.title}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNotification(notification.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(notification.timestamp)}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="absolute left-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={clearAll}
            >
              Clear all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
