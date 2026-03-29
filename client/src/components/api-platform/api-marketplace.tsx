'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ShoppingBag, Search, ExternalLink, Star, Zap } from 'lucide-react';

interface ApiEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  baseUrl: string;
  endpoints: number;
  auth: string;
  status: 'stable' | 'beta' | 'deprecated';
  featured: boolean;
}

const APIS: ApiEntry[] = [
  { id: 'identity', name: 'Identity API', description: 'User authentication, JWT tokens, RBAC, session management', category: 'Core', version: 'v1', baseUrl: '/api/v1', endpoints: 24, auth: 'JWT', status: 'stable', featured: true },
  { id: 'storage', name: 'Storage API', description: 'File upload, download, metadata, sharing and permissions', category: 'Storage', version: 'v1', baseUrl: '/api/v1', endpoints: 18, auth: 'JWT', status: 'stable', featured: true },
  { id: 'mail', name: 'Mail API', description: 'Send, receive, search and manage emails via REST', category: 'Communication', version: 'v1', baseUrl: '/api/v1', endpoints: 22, auth: 'JWT', status: 'stable', featured: false },
  { id: 'calendar', name: 'Calendar API', description: 'Events, reminders, recurring meetings, attendee management', category: 'Productivity', version: 'v1', baseUrl: '/api/v1', endpoints: 16, auth: 'JWT', status: 'stable', featured: false },
  { id: 'ai', name: 'AI API', description: 'Text completion, embeddings, image analysis via local models', category: 'AI', version: 'v1', baseUrl: '/api/v1', endpoints: 12, auth: 'JWT', status: 'beta', featured: true },
  { id: 'containers', name: 'Containers API', description: 'Docker container lifecycle, logs, resource metrics', category: 'Infrastructure', version: 'v1', baseUrl: '/api/v1', endpoints: 28, auth: 'JWT', status: 'stable', featured: false },
  { id: 'scheduler', name: 'Scheduler API', description: 'Cron jobs, task queues, webhooks, job history', category: 'Core', version: 'v1', baseUrl: '/api/v1', endpoints: 14, auth: 'JWT', status: 'stable', featured: false },
  { id: 'collab', name: 'Collab API', description: 'Real-time collaboration, WebSocket, presence, CRDT docs', category: 'Productivity', version: 'v1', baseUrl: '/api/v1', endpoints: 10, auth: 'JWT + WS', status: 'beta', featured: true },
];

const CATEGORIES = ['All', ...Array.from(new Set(APIS.map(a => a.category)))];
const STATUS_COLORS = { stable: 'bg-green-100 text-green-700', beta: 'bg-yellow-100 text-yellow-700', deprecated: 'bg-red-100 text-red-700' };

export function ApiMarketplace() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const filtered = APIS.filter(api => {
    const matchSearch = !search || api.name.toLowerCase().includes(search.toLowerCase()) || api.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || api.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${category === c ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Featured */}
      {category === 'All' && !search && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Star className="h-4 w-4 text-yellow-500" />Featured APIs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {APIS.filter(a => a.featured).map(api => (
              <Card key={api.id} className="border-primary/20 bg-primary/5">
                <CardContent className="pt-4">
                  <ApiCard api={api} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* All results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.filter(a => category !== 'All' || search || !a.featured).map(api => (
          <Card key={api.id}>
            <CardContent className="pt-4">
              <ApiCard api={api} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ApiCard({ api }: { api: ApiEntry }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{api.name}</h3>
            <Badge variant="outline" className="text-xs">{api.version}</Badge>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[api.status]}`}>{api.status}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{api.description}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{api.endpoints} endpoints</span>
        <Badge variant="secondary" className="text-[10px]">{api.category}</Badge>
        <span className="font-mono">{api.auth}</span>
      </div>
    </div>
  );
}
