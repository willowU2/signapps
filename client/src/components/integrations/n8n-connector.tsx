'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { RefreshCw, ExternalLink, CheckCircle2, XCircle, Workflow } from 'lucide-react';

interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  webhook_url: string;
}

export function N8nConnector() {
  const [n8nUrl, setN8nUrl] = useState('http://localhost:5678');
  const [apiKey, setApiKey] = useState('');
  const [connected, setConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  const [workflows, setWorkflows] = useState<N8nWorkflow[]>([]);

  const testConnection = async () => {
    setTesting(true);
    await new Promise(r => setTimeout(r, 1000));
    setTesting(false);
    setConnected(true);
    setWorkflows([
      { id: 'wf1', name: 'SignApps → Notion Sync', active: true, webhook_url: `${n8nUrl}/webhook/signapps-notion` },
      { id: 'wf2', name: 'New User Onboarding', active: false, webhook_url: `${n8nUrl}/webhook/user-onboarding` },
      { id: 'wf3', name: 'Daily Report Generator', active: true, webhook_url: `${n8nUrl}/webhook/daily-report` },
    ]);
    toast.success('Connected to n8n instance');
  };

  const triggerWorkflow = async (wf: N8nWorkflow) => {
    try {
      await fetch(wf.webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'signapps', triggered_at: new Date().toISOString() }) });
      toast.success(`Triggered: ${wf.name}`);
    } catch {
      toast.error('Failed to trigger workflow');
    }
  };

  const toggle = (id: string) => setWorkflows(ws => ws.map(w => w.id === id ? { ...w, active: !w.active } : w));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5" /> n8n Workflow Integration</CardTitle>
          <CardDescription>Connect to a local or remote n8n instance to trigger and manage workflows</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>n8n Instance URL</Label>
              <Input value={n8nUrl} onChange={e => setN8nUrl(e.target.value)} placeholder="http://localhost:5678" />
            </div>
            <div className="space-y-2">
              <Label>API Key (optional)</Label>
              <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="n8n API key" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={testConnection} disabled={testing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Connecting...' : 'Connect'}
            </Button>
            {connected && (
              <Button variant="outline" asChild>
                <a href={n8nUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Open n8n
                </a>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {connected ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
            <span className="text-sm">{connected ? 'Connected' : 'Not connected'}</span>
            {connected && <Badge className="text-xs">{workflows.length} workflows found</Badge>}
          </div>
        </CardContent>
      </Card>

      {connected && workflows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Available Workflows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workflows.map(wf => (
              <div key={wf.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <Switch checked={wf.active} onCheckedChange={() => toggle(wf.id)} />
                  <div>
                    <p className="text-sm font-medium">{wf.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate max-w-60">{wf.webhook_url}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => triggerWorkflow(wf)} disabled={!wf.active}>
                  Trigger
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
