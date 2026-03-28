'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, Play, Code2 } from 'lucide-react';

interface Header { key: string; value: string; }
interface ApiCall {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Header[];
  body: string;
  trigger_event: string;
  enabled: boolean;
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const EVENTS = ['manual', 'user.created', 'file.uploaded', 'task.completed', 'form.submitted'];

const DEFAULTS: ApiCall[] = [
  {
    id: '1', name: 'Notify CRM on new user', method: 'POST', url: 'https://crm.example.com/api/users',
    headers: [{ key: 'Authorization', value: 'Bearer {{API_KEY}}' }, { key: 'Content-Type', value: 'application/json' }],
    body: '{"email": "{{user.email}}", "name": "{{user.name}}"}',
    trigger_event: 'user.created', enabled: true,
  },
];

export function RestApiConnector() {
  const [calls, setCalls] = useState<ApiCall[]>(DEFAULTS);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<ApiCall>>({ method: 'POST', headers: [], body: '', trigger_event: 'manual' });
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const openNew = () => { setEditing('new'); setForm({ name: '', method: 'POST', url: '', headers: [{ key: 'Content-Type', value: 'application/json' }], body: '', trigger_event: 'manual', enabled: true }); setTestResponse(null); };

  const save = () => {
    if (!form.name || !form.url) { toast.error('Name and URL required'); return; }
    if (editing === 'new') {
      const { id: _id, ...rest } = form as ApiCall;
      setCalls(cs => [...cs, { id: Date.now().toString(), ...rest, enabled: true }]);
    } else {
      setCalls(cs => cs.map(c => c.id === editing ? { ...c, ...form } : c));
    }
    setEditing(null); toast.success('API call saved');
  };

  const testCall = async (call: ApiCall) => {
    setRunning(true);
    try {
      const res = await fetch(call.url, {
        method: call.method,
        headers: Object.fromEntries((call.headers || []).filter(h => h.key).map(h => [h.key, h.value])),
        body: ['POST', 'PUT', 'PATCH'].includes(call.method) ? call.body : undefined,
      });
      const text = await res.text();
      setTestResponse(`HTTP ${res.status}\n${text.slice(0, 500)}`);
      toast.success(`Response: HTTP ${res.status}`);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      setTestResponse(`Error: ${err}`);
      toast.error('Request failed');
    } finally { setRunning(false); }
  };

  const addHeader = () => setForm(f => ({ ...f, headers: [...(f.headers || []), { key: '', value: '' }] }));
  const updateHeader = (i: number, field: 'key' | 'value', v: string) =>
    setForm(f => ({ ...f, headers: (f.headers || []).map((h, idx) => idx === i ? { ...h, [field]: v } : h) }));
  const removeHeader = (i: number) => setForm(f => ({ ...f, headers: (f.headers || []).filter((_, idx) => idx !== i) }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Code2 className="h-5 w-5" /> Generic REST API Connector</CardTitle>
              <CardDescription>Configure HTTP calls triggered by SignApps events</CardDescription>
            </div>
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New API Call</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {calls.map(call => (
            <div key={call.id} className="flex items-center justify-between border rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono text-xs">{call.method}</Badge>
                <div>
                  <p className="text-sm font-medium">{call.name}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate max-w-64">{call.url}</p>
                </div>
                <Badge variant="secondary" className="text-xs">{call.trigger_event}</Badge>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" disabled={running} onClick={() => testCall(call)}>
                  <Play className="mr-1 h-3 w-3" /> Test
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(call.id); setForm(call); setTestResponse(null); }}>Modifier</Button>
                <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => setCalls(cs => cs.filter(c => c.id !== call.id))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          {calls.length === 0 && <p className="text-center py-6 text-muted-foreground text-sm">No API calls configured</p>}
        </CardContent>
      </Card>

      {editing && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="text-base">{editing === 'new' ? 'New API Call' : 'Edit API Call'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1"><Label>Name</Label><Input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Trigger Event</Label>
                <Select value={form.trigger_event || 'manual'} onValueChange={v => setForm(f => ({ ...f, trigger_event: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EVENTS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={form.method || 'POST'} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
              <Input className="flex-1" placeholder="https://api.example.com/endpoint" value={form.url || ''} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>Headers</Label><Button size="sm" variant="ghost" onClick={addHeader}><Plus className="h-3 w-3" /></Button></div>
              {(form.headers || []).map((h, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="flex-1" placeholder="Key" value={h.key} onChange={e => updateHeader(i, 'key', e.target.value)} />
                  <Input className="flex-1" placeholder="Value" value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)} />
                  <Button size="icon" variant="ghost" onClick={() => removeHeader(i)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
            {['POST', 'PUT', 'PATCH'].includes(form.method || '') && (
              <div className="space-y-1"><Label>Request Body (JSON)</Label>
                <Textarea rows={4} value={form.body || ''} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} className="font-mono text-xs" placeholder='{"key": "{{variable}}"}'/>
              </div>
            )}
            {testResponse && <div className="rounded-lg bg-muted p-3"><pre className="text-xs font-mono whitespace-pre-wrap">{testResponse}</pre></div>}
            <div className="flex gap-2">
              <Button onClick={save}>Enregistrer</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
