'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Trash2, Pause, Play, Search } from 'lucide-react';

interface ApiCall {
  id: string;
  method: string;
  url: string;
  status?: number;
  duration?: number;
  timestamp: Date;
  type: string;
}

export function ApiRequestLogger() {
  const [logs, setLogs] = useState<ApiCall[]>([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('');
  const pausedRef = useRef(false);
  const originalFetch = useRef<typeof fetch | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    originalFetch.current = window.fetch;

    window.fetch = async (...args) => {
      const [input, init] = args;
      const url = typeof input === 'string' ? input : (input as Request).url;
      const method = init?.method || (typeof input !== 'string' ? (input as Request).method : 'GET') || 'GET';
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const start = Date.now();

      const entry: ApiCall = {
        id,
        method: method.toUpperCase(),
        url,
        timestamp: new Date(),
        type: url.includes('/api/') ? 'api' : 'fetch',
      };

      if (!pausedRef.current) {
        setLogs(prev => [entry, ...prev.slice(0, 199)]);
      }

      try {
        const res = await originalFetch.current!(...args);
        const duration = Date.now() - start;
        if (!pausedRef.current) {
          setLogs(prev => prev.map(l => l.id === id ? { ...l, status: res.status, duration } : l));
        }
        return res;
      } catch (err) {
        if (!pausedRef.current) {
          setLogs(prev => prev.map(l => l.id === id ? { ...l, status: 0, duration: Date.now() - start } : l));
        }
        throw err;
      }
    };

    return () => {
      if (originalFetch.current) window.fetch = originalFetch.current;
    };
  }, []);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const filtered = filter
    ? logs.filter(l => l.url.toLowerCase().includes(filter.toLowerCase()) || l.method.includes(filter.toUpperCase()))
    : logs;

  const statusColor = (status?: number) => {
    if (!status) return 'bg-muted text-muted-foreground';
    if (status < 300) return 'bg-green-100 text-green-700';
    if (status < 400) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const methodColor: Record<string, string> = {
    GET: 'bg-blue-100 text-blue-700',
    POST: 'bg-green-100 text-green-700',
    PUT: 'bg-orange-100 text-orange-700',
    PATCH: 'bg-yellow-100 text-yellow-700',
    DELETE: 'bg-red-100 text-red-700',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5 text-primary" />
            API Request Logger
            <Badge variant="secondary">{logs.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPaused(p => !p)} className="gap-1.5">
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLogs([])} className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by URL or method..."
            className="pl-8 h-8 text-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {logs.length === 0 ? 'No API calls captured yet. Make a request to see it here.' : 'No matches'}
            </p>
          ) : (
            <div className="space-y-1 pr-2">
              {filtered.map(log => (
                <div key={log.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 text-xs font-mono">
                  <span className={`shrink-0 px-1.5 py-0.5 rounded font-semibold text-[10px] ${methodColor[log.method] || 'bg-muted text-muted-foreground'}`}>
                    {log.method}
                  </span>
                  <span className="flex-1 truncate text-muted-foreground">{log.url}</span>
                  {log.status !== undefined && (
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusColor(log.status)}`}>
                      {log.status || 'ERR'}
                    </span>
                  )}
                  {log.duration !== undefined && (
                    <span className="shrink-0 text-muted-foreground w-14 text-right">{log.duration}ms</span>
                  )}
                  <span className="shrink-0 text-muted-foreground">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
