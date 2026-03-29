'use client';

// Feature 20: Notification center widget

import { useState } from 'react';
import { Bell, BellOff, Check, Trash2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClient, ServiceName } from '@/lib/api/factory';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import type { WidgetRenderProps } from '@/lib/dashboard/types';

interface Notification {
  id: string;
  title: string;
  body: string;
  module: string;
  url?: string;
  read: boolean;
  createdAt: string;
}

export function WidgetNotificationCenter({ widget }: Partial<WidgetRenderProps> = {}) {
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const client = getClient(ServiceName.IDENTITY);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications-widget'],
    queryFn: async () => {
      try {
        const { data } = await client.get<Notification[]>('/notifications', { params: { limit: 30 } });
        return data;
      } catch { return []; }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await client.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications-widget'] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => { await client.post('/notifications/read-all'); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications-widget'] }),
  });

  const notifications = data ?? [];
  const unreadCount = notifications.filter(n => !n.read).length;
  const shown = showUnreadOnly ? notifications.filter(n => !n.read) : notifications;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-primary" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-4 text-xs px-1">{unreadCount}</Badge>
            )}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost" size="sm" className="h-6 text-xs px-2"
              onClick={() => setShowUnreadOnly(v => !v)}
            >
              {showUnreadOnly ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
            </Button>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => markAllRead.mutate()}>
                <Check className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full px-3 pb-3">
          {isLoading ? (
            <div className="space-y-2 pt-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-sm text-muted-foreground">
              <Bell className="w-6 h-6 mb-1 opacity-30" />
              {showUnreadOnly ? 'Toutes les notifications sont lues' : 'Aucune notification'}
            </div>
          ) : (
            <div className="space-y-0.5 pt-1">
              {shown.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-2 p-2 rounded-lg group ${!n.read ? 'bg-primary/5' : 'hover:bg-muted/40'}`}
                >
                  {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                  <div className={`flex-1 min-w-0 ${n.read ? 'pl-3.5' : ''}`}>
                    <p className="text-xs font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {n.url && (
                      <Link href={n.url}>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </Link>
                    )}
                    {!n.read && (
                      <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => markRead.mutate(n.id)}>
                        <Check className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
