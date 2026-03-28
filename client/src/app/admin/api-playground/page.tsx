'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Play, Copy, Plus, Trash2, Key, Star, StarOff, Download, ChevronDown, ChevronRight, Zap,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Service catalog ──────────────────────────────────────────────────────────

interface Endpoint {
  method: Method;
  path: string;
  description: string;
  body?: string;
}

interface ServiceDef {
  name: string;
  port: number;
  prefix: string;
  endpoints: Endpoint[];
}

const SERVICES: ServiceDef[] = [
  {
    name: 'identity', port: 3001, prefix: '/api/v1',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'GET', path: '/users', description: 'List all users' },
      { method: 'GET', path: '/users/me', description: 'Current user profile' },
      { method: 'POST', path: '/auth/login', description: 'Login', body: '{"username": "admin", "password": "admin"}' },
      { method: 'POST', path: '/auth/refresh', description: 'Refresh token' },
      { method: 'POST', path: '/auth/logout', description: 'Logout' },
      { method: 'GET', path: '/groups', description: 'List groups' },
      { method: 'GET', path: '/roles', description: 'List roles' },
      { method: 'GET', path: '/mfa/status', description: 'MFA status' },
    ],
  },
  {
    name: 'containers', port: 3002, prefix: '/api/v1',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'GET', path: '/containers', description: 'List containers' },
      { method: 'GET', path: '/images', description: 'List images' },
      { method: 'GET', path: '/networks', description: 'List networks' },
      { method: 'GET', path: '/volumes', description: 'List volumes' },
    ],
  },
  {
    name: 'proxy', port: 3003, prefix: '/api/v1',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'GET', path: '/routes', description: 'List routes' },
      { method: 'GET', path: '/certificates', description: 'List certificates' },
    ],
  },
  {
    name: 'storage', port: 3004, prefix: '/api/v1',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'GET', path: '/files', description: 'List files' },
      { method: 'GET', path: '/stats', description: 'Storage statistics' },
    ],
  },
  {
    name: 'ai', port: 3005, prefix: '/api/v1',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'GET', path: '/models', description: 'List available models' },
      { method: 'POST', path: '/chat', description: 'Chat completion', body: '{"model": "default", "messages": [{"role": "user", "content": "Hello"}]}' },
      { method: 'POST', path: '/embeddings', description: 'Generate embeddings', body: '{"input": "example text"}' },
    ],
  },
  {
    name: 'scheduler', port: 3007, prefix: '/api/v1',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'GET', path: '/jobs', description: 'List jobs' },
    ],
  },
  {
    name: 'metrics', port: 3008, prefix: '/api/v1',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'GET', path: '/system', description: 'System metrics' },
      { method: 'GET', path: '/alerts', description: 'Active alerts' },
    ],
  },
  {
    name: 'mail', port: 3012, prefix: '/api/v1',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'GET', path: '/emails', description: 'List emails' },
      { method: 'POST', path: '/emails', description: 'Send email', body: '{"to": "user@example.com", "subject": "Test", "body": "Hello"}' },
      { method: 'GET', path: '/folders', description: 'List folders' },
    ],
  },
  {
    name: 'calendar', port: 3011, prefix: '/api/v1',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'GET', path: '/events', description: 'List events' },
      { method: 'GET', path: '/calendars', description: 'List calendars' },
    ],
  },
  {
    name: 'collab', port: 3013, prefix: '/api/v1',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check' },
    ],
  },
  {
    name: 'contacts', port: 3021, prefix: '/api/v1',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check' },
      { method: 'GET', path: '/contacts', description: 'List contacts' },
    ],
  },
  {
    name: 'office', port: 3018, prefix: '/api/v1',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check' },
    ],
  },
];

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type Method = (typeof METHODS)[number];

interface Header { key: string; value: string; }

interface SavedRequest {
  id: string;
  name: string;
  serviceName: string;
  method: Method;
  path: string;
  body: string;
  headers: Header[];
  authType: string;
}

const AUTH_TYPES = ['None', 'Bearer Token', 'API Key', 'Basic Auth'] as const;

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-500/15 text-green-700 dark:text-green-400',
  POST: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  PUT: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  PATCH: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  DELETE: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

const FAVORITES_KEY = 'api-playground-favorites';

function loadFavorites(): SavedRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
  } catch { return []; }
}

function saveFavorites(favs: SavedRequest[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
}

export default function ApiPlaygroundPage() {
  const [service, setService] = useState(SERVICES[0]);
  const [method, setMethod] = useState<Method>('GET');
  const [path, setPath] = useState('/health');
  const [body, setBody] = useState('');
  const [headers, setHeaders] = useState<Header[]>([{ key: 'Content-Type', value: 'application/json' }]);
  const [authType, setAuthType] = useState<(typeof AUTH_TYPES)[number]>('Bearer Token');
  const [bearerToken, setBearerToken] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [basicUser, setBasicUser] = useState('');
  const [basicPass, setBasicPass] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<number | null>(null);
  const [timing, setTiming] = useState<number | null>(null);
  const [responseSize, setResponseSize] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ method: string; path: string; status: number; time: number }[]>([]);
  const [favorites, setFavorites] = useState<SavedRequest[]>([]);
  const [showEndpoints, setShowEndpoints] = useState(true);
  const [responseTab, setResponseTab] = useState('body');

  // Load favorites and auto-fill token on mount
  useEffect(() => {
    setFavorites(loadFavorites());
    // Auto-fill bearer token from current session
    const token = localStorage.getItem('access_token');
    if (token) {
      setBearerToken(token);
    }
  }, []);

  const autoFillToken = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      setBearerToken(token);
      setAuthType('Bearer Token');
      toast.success('Token auto-rempli depuis la session active');
    } else {
      toast.error('Aucun token trouvé dans la session');
    }
  }, []);

  const selectEndpoint = useCallback((ep: Endpoint) => {
    setMethod(ep.method);
    setPath(ep.path);
    if (ep.body) setBody(ep.body);
  }, []);

  const addFavorite = useCallback(() => {
    const fav: SavedRequest = {
      id: crypto.randomUUID(),
      name: `${method} ${service.name}${path}`,
      serviceName: service.name,
      method,
      path,
      body,
      headers,
      authType,
    };
    const updated = [fav, ...favorites];
    setFavorites(updated);
    saveFavorites(updated);
    toast.success('Requête sauvegardée');
  }, [method, service, path, body, headers, authType, favorites]);

  const removeFavorite = useCallback((id: string) => {
    const updated = favorites.filter(f => f.id !== id);
    setFavorites(updated);
    saveFavorites(updated);
    toast.success('Favori supprimé');
  }, [favorites]);

  const loadFavorite = useCallback((fav: SavedRequest) => {
    const svc = SERVICES.find(s => s.name === fav.serviceName);
    if (svc) setService(svc);
    setMethod(fav.method);
    setPath(fav.path);
    setBody(fav.body);
    setHeaders(fav.headers);
    setAuthType(fav.authType as (typeof AUTH_TYPES)[number]);
    toast.success(`Requête "${fav.name}" chargée`);
  }, []);

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
    setResponseHeaders({});
    setStatus(null);
    setTiming(null);
    setResponseSize(null);

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

      // Capture response headers
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => { resHeaders[key] = value; });
      setResponseHeaders(resHeaders);

      const text = await res.text();
      setResponseSize(new Blob([text]).size);
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch { setResponse(text); }

      setHistory(prev => [
        { method, path: `${service.name}${path}`, status: res.status, time: elapsed },
        ...prev.slice(0, 19),
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setResponse(`Error: ${msg}`);
      setStatus(0);
      setTiming(Date.now() - start);
    } finally {
      setLoading(false);
    }
  };

  const exportCurl = () => {
    const fullUrl = `http://localhost:${service.port}${service.prefix}${path}`;
    let cmd = `curl -X ${method} '${fullUrl}'`;
    const authH = buildAuthHeaders();
    Object.entries(authH).forEach(([k, v]) => { cmd += ` \\\n  -H '${k}: ${v}'`; });
    headers.forEach(h => { if (h.key) cmd += ` \\\n  -H '${h.key}: ${h.value}'`; });
    if (method !== 'GET' && body.trim()) cmd += ` \\\n  -d '${body}'`;
    navigator.clipboard.writeText(cmd);
    toast.success('Commande cURL copiée');
  };

  return (
    <AppLayout>
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">API Playground</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Testez les microservices SignApps avec authentification et catalogue d&apos;endpoints
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCurl} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />cURL
            </Button>
            <Button variant="outline" size="sm" onClick={addFavorite} className="gap-1.5">
              <Star className="h-3.5 w-3.5" />Sauvegarder
            </Button>
          </div>
        </div>

        {/* Service selector */}
        <div className="flex flex-wrap gap-1.5">
          {SERVICES.map(s => (
            <button key={s.name} onClick={() => { setService(s); setPath('/health'); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                service.name === s.name ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}>
              {s.name}<span className="opacity-60 ml-1">:{s.port}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left sidebar: Endpoint catalog + Favorites */}
          <div className="space-y-3">
            {/* Endpoint catalog */}
            <Card>
              <CardHeader className="py-2 px-3 cursor-pointer flex flex-row items-center justify-between"
                onClick={() => setShowEndpoints(!showEndpoints)}>
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Endpoints — {service.name}
                </CardTitle>
                {showEndpoints ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </CardHeader>
              {showEndpoints && (
                <CardContent className="px-2 pb-2 pt-0">
                  <div className="space-y-0.5">
                    {service.endpoints.map((ep, i) => (
                      <button key={i} onClick={() => selectEndpoint(ep)}
                        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors text-left ${
                          method === ep.method && path === ep.path ? 'bg-accent' : ''
                        }`}>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${METHOD_COLORS[ep.method]}`}>
                          {ep.method}
                        </span>
                        <span className="font-mono truncate flex-1">{ep.path}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Favorites */}
            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Star className="h-3 w-3" />Favoris
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-2 pt-0">
                {favorites.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-1">Aucun favori sauvegardé</p>
                ) : (
                  <div className="space-y-0.5">
                    {favorites.map(fav => (
                      <div key={fav.id} className="flex items-center gap-1 group">
                        <button onClick={() => loadFavorite(fav)}
                          className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors text-left truncate">
                          <span className={`text-[10px] font-mono font-bold px-1 py-0.5 rounded ${METHOD_COLORS[fav.method]}`}>
                            {fav.method.substring(0, 3)}
                          </span>
                          <span className="truncate font-mono">{fav.serviceName}{fav.path}</span>
                        </button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => removeFavorite(fav.id)}>
                          <StarOff className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main request area */}
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
                      className="border-0 rounded-none font-mono text-sm focus-visible:ring-0"
                      onKeyDown={e => { if (e.key === 'Enter') handleSend(); }} />
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
                    <div className="flex gap-2 flex-wrap items-center">
                      {AUTH_TYPES.map(t => (
                        <button key={t} onClick={() => setAuthType(t)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${authType === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-accent'}`}>
                          {t}
                        </button>
                      ))}
                      <Separator orientation="vertical" className="h-5" />
                      <Button variant="outline" size="sm" onClick={autoFillToken} className="gap-1.5 text-xs h-7">
                        <Zap className="h-3 w-3" />Auto-fill token
                      </Button>
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
                      <textarea value={body} onChange={e => setBody(e.target.value)} placeholder='{"key": "value"}' rows={6}
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
                    {responseSize !== null && (
                      <span className="text-xs text-muted-foreground">
                        {responseSize > 1024 ? `${(responseSize / 1024).toFixed(1)}KB` : `${responseSize}B`}
                      </span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(response || ''); toast.success('Copié'); }} className="gap-1.5">
                    <Copy className="h-3.5 w-3.5" />Copy
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <Tabs value={responseTab} onValueChange={setResponseTab}>
                    <TabsList className="h-7 mb-2">
                      <TabsTrigger value="body" className="text-xs h-6">Body</TabsTrigger>
                      <TabsTrigger value="headers" className="text-xs h-6">Headers</TabsTrigger>
                    </TabsList>
                    <TabsContent value="body">
                      <pre className="text-xs font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">{response}</pre>
                    </TabsContent>
                    <TabsContent value="headers">
                      <div className="text-xs font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto max-h-96 overflow-y-auto space-y-1">
                        {Object.keys(responseHeaders).length === 0 ? (
                          <span className="text-muted-foreground">No headers captured</span>
                        ) : (
                          Object.entries(responseHeaders).map(([k, v]) => (
                            <div key={k}>
                              <span className="text-primary font-semibold">{k}</span>: {v}
                            </div>
                          ))
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right sidebar: History */}
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Historique
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune requête</p>
              ) : (
                <div className="space-y-1.5">
                  {history.map((h, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <Badge variant="outline" className={`text-[10px] px-1 font-mono ${METHOD_COLORS[h.method]}`}>{h.method.substring(0, 3)}</Badge>
                      <span className="truncate flex-1 font-mono">{h.path}</span>
                      <span className={`text-[10px] font-mono ${h.status < 400 ? 'text-green-600' : 'text-red-600'}`}>{h.status}</span>
                      <span className="text-[10px] text-muted-foreground">{h.time}ms</span>
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
