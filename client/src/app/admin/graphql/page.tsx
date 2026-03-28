'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Play, Copy, GitMerge, Info } from 'lucide-react';
import { toast } from 'sonner';

const GRAPHQL_URL = 'http://localhost:3001/api/v1/graphql';

const SAMPLE_QUERIES = [
  {
    name: 'List users',
    query: `query {
  users(limit: 10) {
    id
    email
    displayName
    createdAt
  }
}`,
  },
  {
    name: 'User details',
    query: `query GetUser($id: ID!) {
  user(id: $id) {
    id
    email
    roles
    lastLogin
  }
}`,
    variables: '{"id": "1"}',
  },
  {
    name: 'Introspection',
    query: `{
  __schema {
    types {
      name
      kind
    }
  }
}`,
  },
];

export default function GraphQLPage() {
  const [query, setQuery] = useState(SAMPLE_QUERIES[0].query);
  const [variables, setVariables] = useState('{}');
  const [token, setToken] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = async () => {
    setLoading(true);
    setResponse(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let vars = {};
      try { vars = JSON.parse(variables); } catch { /* ignore */ }

      const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables: vars }),
      });
      setStatus(res.status);
      const json = await res.json();
      setResponse(JSON.stringify(json, null, 2));
    } catch (e: any) {
      setResponse(`Error: ${e.message}`);
      setStatus(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitMerge className="h-6 w-6 text-primary" />
            GraphQL Explorer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Query the SignApps unified GraphQL API
          </p>
        </div>

        {/* Sample queries */}
        <div className="flex gap-2 flex-wrap">
          {SAMPLE_QUERIES.map(sq => (
            <button
              key={sq.name}
              onClick={() => { setQuery(sq.query); if (sq.variables) setVariables(sq.variables); }}
              className="text-xs px-2.5 py-1 rounded border bg-muted hover:bg-accent transition-colors"
            >
              {sq.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Query</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-sm font-mono resize-none focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="{ users { id email } }"
                />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Variables (JSON)</p>
                  <textarea
                    value={variables}
                    onChange={e => setVariables(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm font-mono resize-none focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Bearer Token (optional)</p>
                  <Input
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder="eyJhbG..."
                    className="font-mono text-sm"
                    type="password"
                  />
                </div>
                <Button onClick={execute} disabled={loading} className="w-full gap-2">
                  <Play className="h-4 w-4" />
                  {loading ? 'Executing...' : 'Execute Query'}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <Card className="flex-1">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">Response</CardTitle>
                  {status !== null && (
                    <Badge variant={status >= 200 && status < 300 ? 'default' : 'destructive'} className="text-xs">
                      {status || 'ERR'}
                    </Badge>
                  )}
                </div>
                {response && (
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(response); toast.success('Copied'); }} className="gap-1">
                    <Copy className="h-3 w-3" />Copy
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <pre className="text-xs font-mono bg-muted/50 rounded-lg p-3 overflow-auto max-h-96 min-h-[200px] whitespace-pre-wrap">
                  {response ?? <span className="text-muted-foreground">Response will appear here</span>}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>GraphQL endpoint: <code className="font-mono bg-muted px-1 rounded">{GRAPHQL_URL}</code></p>
                    <p>Use introspection query to discover available types and fields.</p>
                    <p>Mutations are supported with proper authentication.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
