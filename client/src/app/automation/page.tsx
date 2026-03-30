'use client';

// WH3 + WH4: Visual workflow builder (form-based) with integration templates

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Zap, Plus, Trash2, Play, ChevronRight, Sparkles, RefreshCw } from 'lucide-react';
import { webhooksApi, CreateWebhookRequest, Webhook } from '@/lib/api/identity';
import { usePageTitle } from '@/hooks/use-page-title';

// ── Trigger & Action definitions ─────────────────────────────────────────────

const TRIGGER_EVENTS = [
  { value: 'mail.received', label: 'Email recu' },
  { value: 'mail.sent', label: 'Email envoyé' },
  { value: 'deal.won', label: 'Deal gagné' },
  { value: 'deal.lost', label: 'Deal perdu' },
  { value: 'deal.created', label: 'Deal créé' },
  { value: 'form.submitted', label: 'Formulaire soumis' },
  { value: 'task.completed', label: 'Tache terminée' },
  { value: 'task.overdue', label: 'Tache en retard' },
  { value: 'contact.created', label: 'Contact créé' },
  { value: 'document.signed', label: 'Document signé' },
  { value: 'signature.completed', label: 'Signature completée' },
];

const ACTIONS = [
  { value: 'webhook', label: 'Appeler un webhook' },
  { value: 'notification', label: 'Créer une notification' },
  { value: 'task', label: 'Créer une tâche' },
  { value: 'email', label: 'Envoyer un email' },
];

// ── Templates (WH4) ───────────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  webhookUrl?: string;
  emoji: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'email-slack',
    name: 'Email recu → Notification Slack',
    description: 'Envoie une notification Slack chaque fois qu\'un email est recu',
    trigger: 'mail.received',
    action: 'webhook',
    webhookUrl: 'https://hooks.slack.com/services/YOUR_SLACK_HOOK',
    emoji: '📨',
  },
  {
    id: 'deal-invoice',
    name: 'Deal gagné → Créer facture',
    description: 'Quand un deal est gagné, publie un événement pour créer une facture',
    trigger: 'deal.won',
    action: 'notification',
    emoji: '💰',
  },
  {
    id: 'form-contact',
    name: 'Formulaire soumis → Créer contact',
    description: 'Un formulaire soumis crée automatiquement un contact CRM',
    trigger: 'form.submitted',
    action: 'task',
    emoji: '📋',
  },
  {
    id: 'task-late-email',
    name: 'Tache en retard → Email rappel',
    description: 'Envoie un email de rappel quand une tâche dépasse sa date limite',
    trigger: 'task.overdue',
    action: 'email',
    emoji: '⏰',
  },
];

// ── Main component ────────────────────────────────────────────────────────────

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  webhookUrl?: string;
  enabled: boolean;
  created_at: string;
  // backend webhook id (when action=webhook)
  webhookId?: string;
}

function ruleFromWebhook(w: Webhook): AutomationRule {
  return {
    id: w.id,
    name: w.name,
    trigger: w.events[0] ?? '*',
    action: 'webhook',
    webhookUrl: w.url,
    enabled: w.enabled,
    created_at: w.created_at,
    webhookId: w.id,
  };
}

export default function AutomationPage() {
  usePageTitle('Automation');
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    trigger: '',
    action: '',
    webhookUrl: '',
  });

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    setLoading(true);
    try {
      // Automation rules are stored as webhooks with a special name prefix "automation:"
      const res = await webhooksApi.list();
      const automationRules = (res.data || [])
        .filter((w: Webhook) => w.name.startsWith('automation:'))
        .map(ruleFromWebhook);
      setRules(automationRules);
    } catch {
      toast.error('Impossible de charger les règles');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(overrides?: Partial<typeof form>) {
    const data = { ...form, ...overrides };
    if (!data.name.trim()) { toast.error('Nom requis'); return; }
    if (!data.trigger) { toast.error('Trigger requis'); return; }
    if (!data.action) { toast.error('Action requise'); return; }
    if (data.action === 'webhook' && !data.webhookUrl?.trim()) {
      toast.error('URL webhook requise');
      return;
    }

    setSaving(true);
    try {
      const webhookPayload: CreateWebhookRequest = {
        name: `automation:${data.name}`,
        url: data.action === 'webhook' && data.webhookUrl
          ? data.webhookUrl
          : `https://signapps.local/api/v1/internal/automation/${data.action}`,
        events: [data.trigger],
        enabled: true,
      };

      const createRes = await webhooksApi.create(webhookPayload);
      setRules(r => [ruleFromWebhook(createRes.data), ...r]);
      setForm({ name: '', trigger: '', action: '', webhookUrl: '' });
      setShowCreate(false);
      toast.success('Règle d\'automation créée');
    } catch {
      toast.error('Impossible de créer la règle');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rule: AutomationRule) {
    if (!rule.webhookId) { setRules(r => r.filter(x => x.id !== rule.id)); return; }
    try {
      await webhooksApi.delete(rule.webhookId);
      setRules(r => r.filter(x => x.id !== rule.id));
      toast.success('Règle supprimée');
    } catch {
      toast.error('Impossible de supprimer');
    }
  }

  function applyTemplate(tpl: Template) {
    setForm({
      name: tpl.name,
      trigger: tpl.trigger,
      action: tpl.action,
      webhookUrl: tpl.webhookUrl ?? '',
    });
    setShowCreate(true);
    toast.info(`Template "${tpl.name}" chargé — ajustez les paramètres puis sauvegardez`);
  }

  const triggerLabel = (v: string) => TRIGGER_EVENTS.find(t => t.value === v)?.label ?? v;
  const actionLabel = (v: string) => ACTIONS.find(a => a.value === v)?.label ?? v;

  return (
    <AppLayout>
      <div className="w-full space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-yellow-500" /> Automation
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Créez des règles SI-ALORS pour automatiser vos workflows
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={loadRules} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreate(s => !s)}>
              <Plus className="h-4 w-4 mr-1" /> Nouvelle règle
            </Button>
          </div>
        </div>

        {/* Templates (WH4) */}
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-400" /> Templates prêts à l&apos;emploi
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TEMPLATES.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => applyTemplate(tpl)}
                className="text-left border rounded-lg p-3 hover:border-primary hover:bg-primary/5 transition-colors space-y-1.5 group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{tpl.emoji}</span>
                  <span className="text-xs font-medium group-hover:text-primary leading-tight">{tpl.name}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{tpl.description}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Badge variant="outline" className="text-xs font-mono">{triggerLabel(tpl.trigger)}</Badge>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="secondary" className="text-xs">{actionLabel(tpl.action)}</Badge>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Nouvelle règle d&apos;automation</CardTitle>
              <CardDescription>Choisissez un déclencheur et une action</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Nom de la règle</Label>
                <Input
                  placeholder="Ex: Email recu → Slack"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Trigger */}
                <div className="border rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    SI (Déclencheur)
                  </p>
                  <Select value={form.trigger} onValueChange={v => setForm(f => ({ ...f, trigger: v }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Choisir un événement" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_EVENTS.map(t => (
                        <SelectItem key={t.value} value={t.value} className="text-xs">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Action */}
                <div className="border rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    ALORS (Action)
                  </p>
                  <Select value={form.action} onValueChange={v => setForm(f => ({ ...f, action: v }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Choisir une action" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIONS.map(a => (
                        <SelectItem key={a.value} value={a.value} className="text-xs">
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.action === 'webhook' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">URL du webhook cible</Label>
                  <Input
                    placeholder="https://hooks.slack.com/..."
                    value={form.webhookUrl}
                    onChange={e => setForm(f => ({ ...f, webhookUrl: e.target.value }))}
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
                  Annuler
                </Button>
                <Button size="sm" onClick={() => handleCreate()} disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Créer la règle'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rules list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Mes règles ({rules.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading && <p className="text-center text-sm text-muted-foreground py-8">Chargement…</p>}
            {!loading && rules.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Aucune règle — créez-en une ou utilisez un template
              </p>
            )}
            {rules.map(rule => (
              <div key={rule.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${rule.enabled ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{rule.name.replace(/^automation:/, '')}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Badge variant="outline" className="text-xs font-mono">
                        {triggerLabel(rule.trigger)}
                      </Badge>
                      <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <Badge variant="secondary" className="text-xs">
                        {actionLabel(rule.action)}
                      </Badge>
                    </div>
                    {rule.webhookUrl && (
                      <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">
                        {rule.webhookUrl}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive flex-shrink-0 ml-2"
                  onClick={() => handleDelete(rule)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
