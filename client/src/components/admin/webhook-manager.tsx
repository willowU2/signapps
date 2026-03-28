'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Webhook,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  RotateCw,
  Globe,
  Copy,
} from 'lucide-react';
import { webhooksApi, type Webhook as WebhookType, type CreateWebhookRequest } from '@/lib/api/identity';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Available event types
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  'user.created',
  'user.updated',
  'user.deleted',
  'document.created',
  'document.updated',
  'document.deleted',
  'container.started',
  'container.stopped',
  'backup.completed',
  'backup.failed',
  'storage.quota_exceeded',
  'auth.login',
  'auth.login_failed',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WebhookManager() {
  const [hooks, setHooks] = useState<WebhookType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [formEvents, setFormEvents] = useState<Set<string>>(new Set());
  const [formEnabled, setFormEnabled] = useState(true);

  const fetchHooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await webhooksApi.list();
      setHooks(res.data || []);
    } catch {
      setHooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHooks();
  }, [fetchHooks]);

  const resetForm = () => {
    setFormName('');
    setFormUrl('');
    setFormSecret('');
    setFormEvents(new Set());
    setFormEnabled(true);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (hook: WebhookType) => {
    setEditingId(hook.id);
    setFormName(hook.name);
    setFormUrl(hook.url);
    setFormSecret('');
    setFormEvents(new Set(hook.events));
    setFormEnabled(hook.enabled);
    setDialogOpen(true);
  };

  const toggleEvent = (event: string) => {
    setFormEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) {
        next.delete(event);
      } else {
        next.add(event);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!formName.trim() || !formUrl.trim()) {
      toast.error('Name and URL are required');
      return;
    }

    const data: CreateWebhookRequest = {
      name: formName,
      url: formUrl,
      events: Array.from(formEvents),
      enabled: formEnabled,
    };
    if (formSecret.trim()) {
      data.secret = formSecret;
    }

    try {
      if (editingId) {
        await webhooksApi.update(editingId, data);
        toast.success('Webhook updated');
      } else {
        await webhooksApi.create(data);
        toast.success('Webhook created');
      }
      setDialogOpen(false);
      resetForm();
      fetchHooks();
    } catch (e: any) {
      toast.error(e.message || "Impossible d'enregistrer webhook");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await webhooksApi.delete(id);
      toast.success('Webhook deleted');
      fetchHooks();
    } catch {
      toast.error('Impossible de supprimer webhook');
    }
  };

  const handleTest = async (id: string) => {
    try {
      const res = await webhooksApi.test(id);
      const result = res.data;
      if (result.success) {
        toast.success(`Test delivery succeeded (${result.status_code})`);
      } else {
        toast.error(`Test delivery failed (${result.status_code || 'no response'})`);
      }
      fetchHooks();
    } catch {
      toast.error('Test delivery failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">Webhook Manager</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchHooks} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            New Webhook
          </Button>
        </div>
      </div>

      {/* Webhooks list */}
      {hooks.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No webhooks configured. Click "New Webhook" to create one.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {hooks.map((hook) => (
          <Card key={hook.id}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{hook.name}</span>
                    <Badge variant={hook.enabled ? 'default' : 'secondary'} className="text-[10px]">
                      {hook.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground truncate">{hook.url}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {hook.events.map((ev) => (
                      <Badge key={ev} variant="outline" className="text-[10px]">
                        {ev}
                      </Badge>
                    ))}
                  </div>
                  {/* Last delivery info */}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {hook.last_triggered && (
                      <span>
                        Last triggered: {new Date(hook.last_triggered).toLocaleString('fr-FR')}
                      </span>
                    )}
                    {hook.last_status !== undefined && hook.last_status !== null && (
                      <span className="flex items-center gap-1">
                        {hook.last_status >= 200 && hook.last_status < 300 ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500" />
                        )}
                        HTTP {hook.last_status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handleTest(hook.id)} title="Test delivery">
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(hook)} title="Edit">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(hook.id)}
                    title="Delete"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
            <DialogDescription>
              Configure the webhook endpoint and select events to subscribe to.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                placeholder="My Webhook"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input
                placeholder="https://example.com/webhook"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Secret (optional)</Label>
              <Input
                type="password"
                placeholder="webhook_secret_..."
                value={formSecret}
                onChange={(e) => setFormSecret(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Events</Label>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto rounded-md border p-3">
                {EVENT_TYPES.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formEvents.has(ev)}
                      onChange={() => toggleEvent(ev)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-xs">{ev}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label>Enabled</Label>
              <button
                onClick={() => setFormEnabled(!formEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formEnabled ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <Button onClick={handleSave} className="w-full">
              {editingId ? 'Update Webhook' : 'Create Webhook'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
