'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Copy, Plus, Trash2, Key } from 'lucide-react';
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
type Method = typeof METHODS[number];

interface Header { key: string; value: string; }

const AUTH_TYPES = ['None', 'Bearer Token', 'API Key', 'Basic Auth'] as const;

export default function ApiPlaygroundPage() {
  const [service, setService] = useState(SERVICES[0]);
  const [method, setMethod] = useState<Method>('GET');
  const [path, setPath] = useState('/health');
  const [body, setBody] = useState('');
  const [headers, setHeaders] = useState<Header[]>([{ key: 'Content-Type', value: 'application/json' }]);
  const [authType, setAuthType] = useState<typeof AUTH_TYPES[number]>('Bearer Token');
  const [bearerToken, setBearerToken] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [basicUser, setBasicUser] = useState('');
  const [basicPass, setBasicPass] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [timing, setTiming] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ method: string; path: string; status: number }[]>([]);

  const buildAuthHeaders = (): Record<string, string> => {
    if (authType === 'Bearer Token' && bearerToken) return { Authorization: `Bearer ${bearerToken}` };
    if (authType === 'API Key' && apiKey) return { 'X-API-Key': apiKey };
    if (authType === 'Basic Auth' && basicUser) {
      return { Authorization: `Basic ${btoa(`${basicUser}:${basicPass}`)}` };
    }
    return {};
  };

  const handleSend = async () => {
    setLoading(true);
    setResponse(null);
    setStatus(null);
    setTiming(null);

    const start = Date.now();
    const fullUrl = `http://localhost:${service.port}${service.prefix}${path}`;

    try {
      const reqHeaders: Record<string, string> = { ...buildAuthHeaders() };
      headers.forEach(h => { if (h.key) reqHeaders[h.key] = h.value; });

      const opts: RequestInit = { method, headers: reqHeaders };
      if (method !== 'GET' && body.trim()) opts.body = body;

      const res = await fetch(fullUrl, opts);
      const elapsed = Date.now() - start;
      setStatus(res.status);
      setTiming(elapsed);
      const text = await res.text();
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch { setResponse(text); }

      setHistory(prev => [{ method, path: `${service.name}${path}`, status: res.status }, ...prev.slice(0, 9)]);
    } catch (e: any) {
      setResponse(`Error: ${e.message}`);
      setStatus(0);
      setTiming(Date.now() - start);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">API Playground</h1>
          <p className="text-sm text-muted-foreground mt-1">Test SignApps microservices with authentication support</p>
        </div>

        {/* Service selector */}
        <div className="flex flex-wrap gap-1.5">
          {SERVICES.map(s => (
            <button key={s.name} onClick={() => setService(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                service.name === s.name ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}>
              {s.name}<span className="opacity-60 ml-1">:{s.port}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            {/* Request line */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex gap-2">
                  <select value={method} onChange={e => setMethod(e.target.value as Method)}
                    className="px-3 py-2 rounded-lg border bg-background text-sm font-mono font-semibold w-24">
                    {METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                  <div className="flex-1 flex items-center gap-0 border rounded-lg overflow-hidden bg-muted/30">
                    <span className="px-2 py-2 text-xs text-muted-foreground font-mono shrink-0 bg-muted">
                      :{service.port}{service.prefix}
                    </span>
                    <Input value={path} onChange={e => setPath(e.target.value)} placeholder="/endpoint"
                      className="border-0 rounded-none font-mono text-sm focus-visible:ring-0" />
                  </div>
                  <Button onClick={handleSend} disabled={loading} className="gap-1.5 px-5">
                    <Play className="h-4 w-4" />{loading ? '...' : 'Send'}
                  </Button>
                </div>

                <Tabs defaultValue="auth">
                  <TabsList className="h-8">
                    <TabsTrigger value="auth" className="text-xs h-7 gap-1"><Key className="h-3 w-3" />Auth</TabsTrigger>
                    <TabsTrigger value="headers" className="text-xs h-7">Headers</TabsTrigger>
                    {method !== 'GET' && <TabsTrigger value="body" className="text-xs h-7">Body</TabsTrigger>}
                  </TabsList>

                  <TabsContent value="auth" className="mt-3 space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      {AUTH_TYPES.map(t => (
                        <button key={t} onClick={() => setAuthType(t)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${authType === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-accent'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                    {authType === 'Bearer Token' && (
                      <Input value={bearerToken} onChange={e => setBearerToken(e.target.value)} placeholder="eyJhbGci..." className="font-mono text-sm" />
                    )}
                    {authType === 'API Key' && (
                      <Input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." className="font-mono text-sm" />
                    )}
                    {authType === 'Basic Auth' && (
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={basicUser} onChange={e => setBasicUser(e.target.value)} placeholder="username" />
                        <Input type="password" value={basicPass} onChange={e => setBasicPass(e.target.value)} placeholder="password" />
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="headers" className="mt-3 space-y-2">
                    {headers.map((h, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={h.key} onChange={e => setHeaders(prev => prev.map((x, j) => j === i ? { ...x, key: e.target.value } : x))} placeholder="Key" className="text-xs" />
                        <Input value={h.value} onChange={e => setHeaders(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="Value" className="text-xs" />
                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive" onClick={() => setHeaders(prev => prev.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setHeaders(p => [...p, { key: '', value: '' }])} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />Add Header
                    </Button>
                  </TabsContent>

                  {method !== 'GET' && (
                    <TabsContent value="body" className="mt-3">
                      <textarea value={body} onChange={e => setBody(e.target.value)} placeholder='{"key": "value"}' rows={5}
                        className="w-full px-3 py-2 rounded-lg border bg-background text-sm font-mono resize-none focus:ring-2 focus:ring-primary/20 outline-none" />
                    </TabsContent>
                  )}
                </Tabs>
              </CardContent>
            </Card>

            {/* Response */}
            {response !== null && (
              <Card>
                <CardHeader className="py-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">Response</CardTitle>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                      status && status >= 200 && status < 300 ? 'bg-green-500/15 text-green-600' :
                      status && status >= 400 ? 'bg-red-500/15 text-red-600' : 'bg-yellow-500/15 text-yellow-600'
                    }`}>{status || 'ERR'}</span>
                    {timing !== null && <span className="text-xs text-muted-foreground">{timing}ms</span>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(response || ''); toast.success('Copied'); }} className="gap-1.5">
                    <Copy className="h-3.5 w-3.5" />Copy
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <pre className="text-xs font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap">{response}</pre>
                </CardContent>
              </Card>
            )}
          </div>

          {/* History */}
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Request History</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No requests yet</p>
              ) : (
                <div className="space-y-1.5">
                  {history.map((h, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <Badge variant="outline" className="text-[10px] px-1">{h.method}</Badge>
                      <span className="truncate flex-1 font-mono">{h.path}</span>
                      <span className={`text-[10px] font-mono ${h.status < 400 ? 'text-green-600' : 'text-red-600'}`}>{h.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
