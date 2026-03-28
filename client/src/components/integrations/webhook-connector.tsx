'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, Copy, Send, Webhook } from 'lucide-react';

interface InboundWebhook {
  id: string;
  name: string;
  slug: string;
  secret: string;
  enabled: boolean;
  last_received: string | null;
}

function genSlug() { return Math.random().toString(36).slice(2, 10); }

const BASE_URL = 'https://signapps.local/api/v1/webhooks/in';

export function WebhookConnector() {
  const [webhooks, setWebhooks] = useState<InboundWebhook[]>([
    { id: '1', name: 'Make.com Events', slug: 'make-' + genSlug(), secret: 'sec_' + genSlug(), enabled: true, last_received: new Date(Date.now() - 3600000).toISOString() },
  ]);
  const [newName, setNewName] = useState('');
  const [testPayload, setTestPayload] = useState('{\n  "event": "test",\n  "data": {}\n}');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied'); };

  const add = () => {
    if (!newName.trim()) { toast.error('Nom requis'); return; }
    setWebhooks(ws => [...ws, { id: Date.now().toString(), name: newName, slug: genSlug(), secret: 'sec_' + genSlug(), enabled: true, last_received: null }]);
    setNewName('');
    toast.success('Inbound webhook created');
  };

  const toggle = (id: string) => setWebhooks(ws => ws.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w));
  const remove = (id: string) => { setWebhooks(ws => ws.filter(w => w.id !== id)); toast.success('Removed'); };

  const sendTest = async () => {
    if (!selectedId) { toast.error('Select a webhook first'); return; }
    try { JSON.parse(testPayload); } catch { toast.error('Invalid JSON payload'); return; }
    toast.success('Test payload sent to webhook endpoint');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5" /> Inbound Webhook Endpoints</CardTitle>
          <CardDescription>Receive events from Make.com, external services or any HTTP client</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Webhook name (e.g. Make.com Payments)" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
            <Button onClick={add}><Plus className="mr-2 h-4 w-4" /> Create</Button>
          </div>

          <div className="space-y-3">
            {webhooks.map(wh => {
              const url = `${BASE_URL}/${wh.slug}`;
              return (
                <div key={wh.id} className={`border rounded-lg p-4 space-y-2 ${selectedId === wh.id ? 'border-primary/50 bg-primary/5' : ''}`}
                  onClick={() => setSelectedId(wh.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch checked={wh.enabled} onCheckedChange={() => toggle(wh.id)} onClick={e => e.stopPropagation()} />
                      <span className="font-medium text-sm">{wh.name}</span>
                      <Badge variant={wh.enabled ? 'default' : 'secondary'} className="text-xs">{wh.enabled ? 'Active' : 'Paused'}</Badge>
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive h-7 w-7" onClick={e => { e.stopPropagation(); remove(wh.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-2 py-1 rounded font-mono truncate">{url}</code>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(url)}><Copy className="h-3 w-3" /></Button>
                  </div>
                  {wh.last_received && <p className="text-xs text-muted-foreground">Last received: {new Date(wh.last_received).toLocaleString()}</p>}
                </div>
              );
            })}
          </div>

          {selectedId && (
            <div className="border-t pt-4 space-y-3">
              <Label>Test Payload (JSON)</Label>
              <Textarea rows={4} value={testPayload} onChange={e => setTestPayload(e.target.value)} className="font-mono text-xs" />
              <Button onClick={sendTest}><Send className="mr-2 h-4 w-4" /> Send Test</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
