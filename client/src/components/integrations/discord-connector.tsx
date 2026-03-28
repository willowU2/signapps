'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Trash2, Send } from 'lucide-react';

interface DiscordWebhook {
  id: string;
  channel: string;
  webhook_url: string;
  events: string[];
  username: string;
  enabled: boolean;
}

const ALL_EVENTS = ['user.created', 'file.uploaded', 'task.completed', 'form.submitted', 'alert.triggered', 'deploy.success'];

const DEFAULTS: DiscordWebhook[] = [
  { id: '1', channel: '#announcements', webhook_url: 'https://discord.com/api/webhooks/xxx/yyy', events: ['deploy.success'], username: 'SignApps Bot', enabled: true },
];

export function DiscordConnector() {
  const [webhooks, setWebhooks] = useState<DiscordWebhook[]>(DEFAULTS);
  const [newChannel, setNewChannel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newUsername, setNewUsername] = useState('SignApps Bot');

  const add = () => {
    if (!newChannel || !newUrl) { toast.error('Channel name and webhook URL required'); return; }
    setWebhooks(ws => [...ws, { id: Date.now().toString(), channel: newChannel.startsWith('#') ? newChannel : `#${newChannel}`, webhook_url: newUrl, events: [], username: newUsername, enabled: true }]);
    setNewChannel(''); setNewUrl(''); setNewUsername('SignApps Bot');
    toast.success('Discord webhook added');
  };

  const testSend = async (wh: DiscordWebhook) => {
    try {
      await fetch(wh.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: wh.username, content: 'Test notification from SignApps' }),
      });
      toast.success(`Test message sent to ${wh.channel}`);
    } catch {
      toast.error('Failed to send test message');
    }
  };

  const toggleEvent = (id: string, ev: string) =>
    setWebhooks(ws => ws.map(w => w.id === id
      ? { ...w, events: w.events.includes(ev) ? w.events.filter(e => e !== ev) : [...w.events, ev] }
      : w));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Discord Bot Integration</CardTitle>
          <CardDescription>Send SignApps notifications to Discord channels via webhooks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-indigo-500/10 p-3 text-sm">
            <p className="font-medium text-indigo-700 dark:text-indigo-400">Setup:</p>
            <ol className="mt-1 text-xs text-muted-foreground list-decimal list-inside space-y-0.5">
              <li>Discord → Server Settings → Integrations → Webhooks</li>
              <li>New Webhook → Pick channel → Copy URL</li>
            </ol>
          </div>

          {webhooks.map(wh => (
            <div key={wh.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={wh.enabled} onCheckedChange={() => setWebhooks(ws => ws.map(w => w.id === wh.id ? { ...w, enabled: !w.enabled } : w))} />
                  <span className="font-medium">{wh.channel}</span>
                  <Badge variant="secondary" className="text-xs">{wh.username}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => testSend(wh)}><Send className="mr-1 h-3 w-3" /> Test</Button>
                  <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => setWebhooks(ws => ws.filter(w => w.id !== wh.id))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <code className="block text-xs bg-muted px-2 py-1 rounded font-mono truncate">{wh.webhook_url}</code>
              <div className="flex flex-wrap gap-1">
                {ALL_EVENTS.map(ev => (
                  <button key={ev} onClick={() => toggleEvent(wh.id, ev)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${wh.events.includes(ev) ? 'bg-indigo-100 border-indigo-400 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' : 'border-border hover:bg-accent'}`}>
                    {ev}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="border-t pt-4 space-y-3">
            <Label>Add Discord Webhook</Label>
            <div className="grid gap-2 md:grid-cols-3">
              <Input placeholder="#channel" value={newChannel} onChange={e => setNewChannel(e.target.value)} />
              <Input placeholder="Bot display name" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
              <Input placeholder="https://discord.com/api/webhooks/..." value={newUrl} onChange={e => setNewUrl(e.target.value)} />
            </div>
            <Button onClick={add}><Plus className="mr-2 h-4 w-4" /> Add Webhook</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
