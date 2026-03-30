'use client';

// Idea 48: Cross-module notifications — one notification center for everything
// Idea 49: Module health dashboard — admin view of all module statuses

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, RefreshCw, CheckCheck, Activity, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { checkAllServicesHealth, ServiceName, type HealthCheckResult } from '@/lib/api/factory';
import { getClient } from '@/lib/api/factory';
import { notificationsApi } from '@/lib/api/notifications';

const notifClient = () => getClient(ServiceName.NOTIFICATIONS);

interface CrossNotification {
  id: string;
  module: string;
  title: string;
  body: string;
  read: boolean;
  url?: string;
  created_at: string;
}

const MODULE_ICON: Record<string, string> = {
  docs: '📄', mail: '✉️', tasks: '✅', contacts: '👤',
  calendar: '📅', chat: '💬', drive: '📁', monitoring: '🔍',
  billing: '💳', forms: '📝', meet: '🎥', sheets: '📊',
};

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'maintenant';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

/** Idea 48 – Cross-module notification center */
export function CrossModuleNotificationCenter() {
  const [notifs, setNotifs] = useState<CrossNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [dnd, setDnd] = useState(false);

  const unread = notifs.filter(n => !n.read).length;

  const load = useCallback(async () => {
    try {
      const { data } = await notifClient().get<CrossNotification[]>('/cross-module');
      setNotifs(data);
    } catch {
      // Try notificationsApi as secondary source
      try {
        const { data } = await notificationsApi.list();
        const mapped: CrossNotification[] = (Array.isArray(data) ? data : []).map(
          (n) => ({
            id: n.id,
            module: n.source ?? 'system',
            title: n.title,
            body: n.body,
            read: n.read,
            url: undefined,
            created_at: n.created_at,
          })
        );
        setNotifs(mapped);
      } catch {
        // Final fallback: localStorage
        const local = JSON.parse(localStorage.getItem('cross-notifs') || '[]');
        setNotifs(local);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try { await notifClient().patch(`/cross-module/${id}`, { read: true }); }
    catch { /* optimistic */ }
  };

  const markAllRead = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    try { await notifClient().post('/cross-module/mark-all-read', {}); }
    catch { /* optimistic */ }
  };

  const toggleDnd = async () => {
    const next = !dnd;
    setDnd(next);
    try { await notifClient().put('/preferences', { do_not_disturb: next }); }
    catch { localStorage.setItem('notif-dnd', String(next)); }
    toast.info(next ? 'Ne pas déranger activé' : 'Notifications réactivées');
  };

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (v) load(); }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="relative h-9 w-9 p-0">
          {dnd ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {unread > 0 && !dnd && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 && <Badge className="text-xs h-4 px-1.5">{unread}</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={markAllRead} title="Tout marquer lu">
              <CheckCheck className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={load} title="Rafraîchir">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Switch checked={dnd} onCheckedChange={toggleDnd} className="scale-75" />
          </div>
        </div>

        <ScrollArea className="h-72">
          {loading && <div className="animate-pulse m-3 h-12 rounded bg-muted" />}
          {!loading && notifs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">Aucune notification</p>
            </div>
          )}
          {notifs.map(n => (
            <div
              key={n.id}
              onClick={() => { markRead(n.id); if (n.url) window.location.href = n.url; }}
              className={`flex gap-2.5 p-3 border-b cursor-pointer hover:bg-muted/40 transition-colors ${!n.read ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''}`}
            >
              <span className="text-base mt-0.5 shrink-0">{MODULE_ICON[n.module] || '🔔'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-1">
                  <p className={`text-xs font-medium truncate ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title}</p>
                  <time className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</time>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{n.body}</p>
              </div>
              {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
            </div>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

const SERVICE_LABELS: Partial<Record<ServiceName, string>> = {
  [ServiceName.IDENTITY]: 'Identity',
  [ServiceName.DOCS]: 'Docs',
  [ServiceName.MAIL]: 'Mail',
  [ServiceName.CALENDAR]: 'Calendrier',
  [ServiceName.CHAT]: 'Chat',
  [ServiceName.MEET]: 'Meet',
  [ServiceName.CONTACTS]: 'Contacts',
  [ServiceName.STORAGE]: 'Drive',
  [ServiceName.AI]: 'IA',
  [ServiceName.BILLING]: 'Billing',
  [ServiceName.NOTIFICATIONS]: 'Notifications',
  [ServiceName.WORKFORCE]: 'RH',
  [ServiceName.FORMS]: 'Formulaires',
};

/** Idea 49 – Module health dashboard */
export function ModuleHealthDashboard() {
  const [results, setResults] = useState<HealthCheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const check = useCallback(async () => {
    setLoading(true);
    const data = await checkAllServicesHealth();
    setResults(data);
    setLastChecked(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { check(); }, [check]);

  const healthy = results.filter(r => r.healthy).length;
  const total = results.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="w-4 h-4" />Santé des services
        </div>
        <div className="flex items-center gap-2">
          {lastChecked && (
            <span className="text-xs text-muted-foreground">
              {lastChecked.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={check} disabled={loading} className="h-7 w-7 p-0">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${healthy === total ? 'border-green-200 bg-green-50/50 dark:bg-green-950/20' : 'border-orange-200 bg-orange-50/50 dark:bg-orange-950/20'}`}>
        {healthy === total
          ? <Wifi className="w-4 h-4 text-green-500" />
          : <AlertCircle className="w-4 h-4 text-orange-500" />
        }
        <span className="text-xs font-medium">
          {healthy}/{total} services opérationnels
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {results
          .filter(r => SERVICE_LABELS[r.service])
          .sort((a, b) => (a.healthy ? 0 : 1) - (b.healthy ? 0 : 1))
          .map(r => (
            <div key={r.service} className="flex items-center gap-2 p-2 rounded border">
              {r.healthy
                ? <Wifi className="w-3 h-3 text-green-500 shrink-0" />
                : <WifiOff className="w-3 h-3 text-red-500 shrink-0" />
              }
              <span className="text-xs truncate">{SERVICE_LABELS[r.service]}</span>
              {r.latency && (
                <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{r.latency}ms</span>
              )}
            </div>
          ))
        }
      </div>
    </div>
  );
}
