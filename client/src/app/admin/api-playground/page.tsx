'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Copy, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

const SERVICES = [
  { name: 'identity', port: 3001, prefix: '/api/v1' },
  { name: 'containers', port: 3002, prefix: '/api/v1' },
  { name: 'proxy', port: 3003, prefix: '/api/v1' },
  { name: 'storage', port: 3004, prefix: '/api/v1' },
  { name: 'ai', port: 3005, prefix: '/api/v1' },
  { name: 'scheduler', port: 3007, prefix: '/api/v1' },
  { name: 'metrics', port: 3008, prefix: '/api/v1' },
  { name: 'mail', port: 3012, prefix: '/api/v1' },
  { name: 'calendar', port: 3011, prefix: '/api/v1' },
  { name: 'collab', port: 3013, prefix: '/api/v1' },
  { name: 'contacts', port: 3021, prefix: '/api/v1' },
  { name: 'office', port: 3018, prefix: '/api/v1' },
];

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export default function ApiPlaygroundPage() {
  const [service, setService] = useState(SERVICES[0]);
  const [method, setMethod] = useState<typeof METHODS[number]>('GET');
  const [path, setPath] = useState('/health');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const fullUrl = `http://localhost:${service.port}${service.prefix}${path}`;

  const handleSend = async () => {
    setLoading(true);
    setResponse(null);
    setStatus(null);

    try {
      const opts: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (method !== 'GET' && body.trim()) {
        opts.body = body;
      }

      const res = await fetch(fullUrl, opts);
      setStatus(res.status);
      const text = await res.text();
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponse(text);
      }
    } catch (e: any) {
      setResponse(`Error: ${e.message}`);
      setStatus(0);
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(response);
      toast.success('Copié');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">API Playground</h1>
          <p className="text-sm text-muted-foreground mt-1">Testez les endpoints des microservices SignApps</p>
        </div>

        {/* Service selector */}
        <div className="flex flex-wrap gap-2">
          {SERVICES.map((s) => (
            <button
              key={s.name}
              onClick={() => setService(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                service.name === s.name
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {s.name} <span className="text-xs opacity-70">:{s.port}</span>
            </button>
          ))}
        </div>

        {/* Request builder */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex gap-2">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof METHODS[number])}
                className="px-3 py-2 rounded-lg border bg-background text-sm font-mono font-medium w-28"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <div className="flex-1 flex items-center gap-0 border rounded-lg overflow-hidden bg-muted/30">
                <span className="px-3 py-2 text-xs text-muted-foreground font-mono shrink-0 bg-muted">
                  :{service.port}{service.prefix}
                </span>
                <Input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/endpoint"
                  className="border-0 rounded-none font-mono text-sm focus-visible:ring-0"
                />
              </div>
              <Button onClick={handleSend} disabled={loading} className="gap-1.5 px-6">
                <Play className="h-4 w-4" />
                Send
              </Button>
            </div>

            {method !== 'GET' && (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder='{"key": "value"}'
                rows={4}
                className="w-full px-3 py-2 rounded-lg border bg-background text-sm font-mono resize-none focus:ring-2 focus:ring-primary/20 outline-none"
              />
            )}
          </CardContent>
        </Card>

        {/* Response */}
        {response !== null && (
          <Card>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">Response</CardTitle>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                  status && status >= 200 && status < 300
                    ? 'bg-green-500/15 text-green-600'
                    : status && status >= 400
                    ? 'bg-red-500/15 text-red-600'
                    : 'bg-yellow-500/15 text-yellow-600'
                }`}>
                  {status || 'ERR'}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={copyResponse} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                Copier
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <pre className="text-xs font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
                {response}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
