'use client';

import { SpinnerInfinity } from 'spinners-react';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Container, Shield, HardDrive, User, AlertTriangle, CheckCircle, Info, X, Trash2, Check } from 'lucide-react';
import { notificationsApi, type NotificationRecord } from '@/lib/api/calendar';
import { playNotificationSound } from '@/components/notifications/notification-sounds';

interface Notification {
  id: string;
  type: 'container' | 'security' | 'storage' | 'user' | 'system';
  title: string;
  message: string;
  status: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
}

/** Map notification types to their target page */
function getNotificationHref(notification: Notification): string | null {
  switch (notification.type) {
    case 'container':
      return '/containers';
    case 'security':
      return '/security';
    case 'storage':
      return '/storage';
    case 'user':
      return '/identity';
    default:
      return null;
  }
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
    message: record.recipient_address ? `Envoye a ${record.recipient_address}` : `Via ${record.channel}`,
    status: statusMap[record.status] || 'info',
    timestamp: new Date(record.created_at),
    read: record.status === 'sent' || record.status === 'delivered',
  };
}

function getLocalActivityNotifications(): Notification[] {
  const now = new Date();
  const localNotifs: Notification[] = [];

  // Check localStorage for user-generated activity
  try {
    const history = JSON.parse(localStorage.getItem('signapps-recent-history') || '[]');
    if (history.length > 0) {
      const last = history[0];
      localNotifs.push({
        id: `local-history-${Date.now()}`,
        type: 'system',
        title: 'Navigation recente',
        message: `Derniere page visitee : ${last.title || last.path}`,
        status: 'info',
        timestamp: new Date(last.visitedAt || now),
        read: true,
      });
    }
  } catch {}

  // Check for recently saved preferences
  try {
    const prefs = localStorage.getItem('signapps-preferences');
    if (prefs) {
      localNotifs.push({
        id: `local-prefs-saved`,
        type: 'system',
        title: 'Preferences synchronisees',
        message: 'Vos preferences sont a jour sur cet appareil.',
        status: 'success',
        timestamp: new Date(now.getTime() - 60 * 60 * 1000),
        read: true,
      });
    }
  } catch {}

  // Always show a welcome notification
  localNotifs.push({
    id: 'local-welcome',
    type: 'system',
    title: 'Bienvenue sur SignApps',
    message: 'Votre espace de travail est pret. Explorez les modules depuis le menu lateral.',
    status: 'info',
    timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    read: false,
  });

  return localNotifs;
}

export function NotificationPopover() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [prevUnreadCount, setPrevUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await notificationsApi.getHistory({ limit: 20 });
      const mapped = response.data.notifications.map(mapApiToNotification);
      if (mapped.length > 0) {
        setNotifications(mapped);
        // Persist to localStorage for offline access
        try { localStorage.setItem('signapps-notifications-cache', JSON.stringify(mapped)); } catch {}
      } else {
        // Load cached or local notifications
        loadLocalNotifications();
      }
    } catch (err) {
      console.debug('Failed to load notifications:', err);
      loadLocalNotifications();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadLocalNotifications = () => {
    try {
      const cached = localStorage.getItem('signapps-notifications-cache');
      if (cached) {
        const parsed = JSON.parse(cached) as Notification[];
        setNotifications(parsed.map(n => ({ ...n, timestamp: new Date(n.timestamp) })));
        return;
      }
    } catch {}
    // Show local activity notifications from recent-history
    const localNotifs = getLocalActivityNotifications();
    setNotifications(localNotifs);
  };

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Refresh when popover opens
  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open, loadNotifications]);

  // Listen for real-time SSE notifications
  useEffect(() => {
    const handleNewNotification = () => {
      loadNotifications();
      // Play notification sound
      playNotificationSound('alert');
    };

    window.addEventListener('new-notification', handleNewNotification);
    return () => window.removeEventListener('new-notification', handleNewNotification);
  }, [loadNotifications]);

  // Play sound when new unread notifications arrive
  const unreadCount = notifications.filter((n) => !n.read).length;
  useEffect(() => {
    if (unreadCount > prevUnreadCount && prevUnreadCount >= 0) {
      playNotificationSound('alert');
    }
    setPrevUnreadCount(unreadCount);
  }, [unreadCount, prevUnreadCount]);

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

    if (minutes < 1) return "A l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    if (hours < 24) return `il y a ${hours} h`;
    return `il y a ${days} j`;
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
    try { localStorage.removeItem('signapps-notifications-cache'); } catch {}
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    const href = getNotificationHref(notification);
    if (href) {
      setOpen(false);
      router.push(href);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground animate-pulse ring-2 ring-background">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b p-3">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">Notifications</h4>
            {unreadCount > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={markAllAsRead}>
                Tout lu
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={clearAll}
                title="Tout effacer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-8 w-8 text-muted-foreground mb-2 " />
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
                const href = getNotificationHref(notification);
                return (
                  <div
                    key={notification.id}
                    className={`relative flex gap-3 p-3 hover:bg-muted/50 cursor-pointer group/item transition-colors ${
                      !notification.read ? 'bg-muted/30' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
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
                        <div className="flex gap-0.5 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              title="Marquer comme lu"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNotification(notification.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {formatTime(notification.timestamp)}
                        </p>
                        {href && (
                          <span className="text-[10px] text-primary/70">
                            Cliquer pour voir
                          </span>
                        )}
                      </div>
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
              Tout effacer
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
