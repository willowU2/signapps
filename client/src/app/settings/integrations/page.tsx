'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  MessageSquare,
  Webhook,
  Zap,
  Globe,
  Settings,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Save,
  Loader2,
  Info,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SlackConfig {
  webhook_url: string;
  channel: string;
  enabled: boolean;
  notify_on_deal_won: boolean;
  notify_on_task_overdue: boolean;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'connected' | 'disconnected' | 'error';
  configurable: boolean;
}

// ── Slack config dialog ────────────────────────────────────────────────────────

function SlackConfigDialog({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: SlackConfig;
  onSave: (config: SlackConfig) => Promise<void>;
}) {
  const [config, setConfig] = useState<SlackConfig>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConfig(initial);
  }, [initial, open]);

  const handleSave = async () => {
    if (!config.webhook_url.startsWith('https://hooks.slack.com/')) {
      toast.error('URL de webhook Slack invalide');
      return;
    }
    setSaving(true);
    try {
      await onSave(config);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#4A154B]" />
            Configuration Slack
          </DialogTitle>
          <DialogDescription>
            Connectez SignApps à votre workspace Slack pour recevoir des notifications et utiliser les commandes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="slack-enabled" className="text-sm">Activer l'intégration Slack</Label>
            <Switch
              id="slack-enabled"
              checked={config.enabled}
              onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
            />
          </div>

          <Separator />

          {/* Webhook URL */}
          <div className="space-y-1.5">
            <Label htmlFor="slack-webhook" className="text-sm">URL du Webhook entrant</Label>
            <Input
              id="slack-webhook"
              placeholder="https://hooks.slack.com/services/..."
              value={config.webhook_url}
              onChange={(e) => setConfig((c) => ({ ...c, webhook_url: e.target.value }))}
              disabled={!config.enabled}
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              Créez un webhook dans votre{' '}
              <a
                href="https://api.slack.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                espace Slack Apps
              </a>
            </p>
          </div>

          {/* Channel */}
          <div className="space-y-1.5">
            <Label htmlFor="slack-channel" className="text-sm">Canal par défaut</Label>
            <Input
              id="slack-channel"
              placeholder="#général"
              value={config.channel}
              onChange={(e) => setConfig((c) => ({ ...c, channel: e.target.value }))}
              disabled={!config.enabled}
            />
          </div>

          <Separator />

          {/* Notification settings */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Notifications automatiques</p>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Deal remporté</Label>
                <p className="text-xs text-muted-foreground">Notifie quand un deal passe à "Gagné"</p>
              </div>
              <Switch
                checked={config.notify_on_deal_won}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, notify_on_deal_won: v }))}
                disabled={!config.enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Tâche en retard</Label>
                <p className="text-xs text-muted-foreground">Notifie quand une tâche dépasse sa deadline</p>
              </div>
              <Switch
                checked={config.notify_on_task_overdue}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, notify_on_task_overdue: v }))}
                disabled={!config.enabled}
              />
            </div>
          </div>

          {/* Commands info */}
          <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
            <p className="font-medium">Commandes Slack disponibles :</p>
            <p className="font-mono text-muted-foreground">/signapps task "Faire le rapport"</p>
            <p className="font-mono text-muted-foreground">/signapps search "projet alpha"</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Integration card ───────────────────────────────────────────────────────────

function IntegrationCard({
  integration,
  onConfigure,
}: {
  integration: Integration;
  onConfigure: () => void;
}) {
  const statusIcon =
    integration.status === 'connected' ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : integration.status === 'error' ? (
      <XCircle className="h-4 w-4 text-red-500" />
    ) : (
      <XCircle className="h-4 w-4 text-muted-foreground" />
    );

  const statusBadge =
    integration.status === 'connected' ? (
      <Badge variant="default" className="text-xs bg-green-500 hover:bg-green-500">Connecté</Badge>
    ) : integration.status === 'error' ? (
      <Badge variant="destructive" className="text-xs">Erreur</Badge>
    ) : (
      <Badge variant="outline" className="text-xs">Non connecté</Badge>
    );

  return (
    <div className="p-4 rounded-lg border bg-card hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 rounded-lg bg-muted">{integration.icon}</div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-medium text-sm">{integration.name}</p>
              {statusBadge}
            </div>
            <p className="text-xs text-muted-foreground">{integration.description}</p>
          </div>
        </div>
        {integration.configurable && (
          <Button variant="ghost" size="sm" onClick={onConfigure} className="shrink-0 gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Configurer
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [slackDialogOpen, setSlackDialogOpen] = useState(false);
  const [slackConfig, setSlackConfig] = useState<SlackConfig>({
    webhook_url: '',
    channel: '#général',
    enabled: false,
    notify_on_deal_won: true,
    notify_on_task_overdue: true,
  });
  const [slackStatus, setSlackStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');

  // Load Slack config from localStorage (would be API in production)
  useEffect(() => {
    const saved = localStorage.getItem('signapps_slack_config');
    if (saved) {
      try {
        const cfg: SlackConfig = JSON.parse(saved);
        setSlackConfig(cfg);
        setSlackStatus(cfg.enabled && cfg.webhook_url ? 'connected' : 'disconnected');
      } catch {
        // ignore
      }
    }
  }, []);

  const saveSlackConfig = async (config: SlackConfig) => {
    // Persist to backend (identity service webhook config)
    try {
      await api.post('/api/v1/integrations/slack/config', config).catch(() => {
        // Fallback to localStorage if endpoint not yet available
        localStorage.setItem('signapps_slack_config', JSON.stringify(config));
      });
      localStorage.setItem('signapps_slack_config', JSON.stringify(config));
      setSlackConfig(config);
      setSlackStatus(config.enabled && config.webhook_url ? 'connected' : 'disconnected');
      toast.success('Configuration Slack enregistrée');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
      throw new Error('Save failed');
    }
  };

  const integrations: Integration[] = [
    {
      id: 'slack',
      name: 'Slack',
      description: 'Recevez des notifications et exécutez des commandes SignApps depuis Slack.',
      icon: <MessageSquare className="h-5 w-5 text-[#4A154B]" />,
      status: slackStatus,
      configurable: true,
    },
    {
      id: 'zapier',
      name: 'Zapier / n8n',
      description: 'Connectez SignApps à 5 000+ applications via webhook générique.',
      icon: <Zap className="h-5 w-5 text-orange-500" />,
      status: 'connected', // Generic webhook is always available
      configurable: false,
    },
    {
      id: 'caldav',
      name: 'CalDAV',
      description: 'Synchronisez votre calendrier avec Thunderbird, Apple Calendar, Evolution.',
      icon: <Globe className="h-5 w-5 text-blue-500" />,
      status: 'connected',
      configurable: false,
    },
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Acceptez des paiements en ligne directement depuis vos factures.',
      icon: <Webhook className="h-5 w-5 text-violet-500" />,
      status: 'disconnected',
      configurable: false,
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Intégrations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Connectez SignApps à vos outils externes.
          </p>
        </div>

        {/* CalDAV info */}
        <div className="p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            CalDAV — Clients supportés
          </p>
          <p>
            Synchronisation disponible sur <code className="bg-background px-1 rounded">/caldav/</code>.
            Compatible Thunderbird, Apple Calendar, Evolution, et tout client RFC 4791.
          </p>
          <a
            href="/settings/interop"
            className="flex items-center gap-1 text-primary hover:underline mt-1"
          >
            Voir les détails CalDAV <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Webhook info */}
        <div className="p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Webhook générique (n8n / Zapier)
          </p>
          <p>
            Endpoint : <code className="bg-background px-1 rounded">POST /api/v1/webhooks/incoming/:source</code>
          </p>
          <p>Envoyez des payloads JSON — ils seront convertis en événements de plateforme.</p>
          <a
            href="/admin/webhooks"
            className="flex items-center gap-1 text-primary hover:underline mt-1"
          >
            Gérer les webhooks <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Integrations list */}
        <div className="space-y-3">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onConfigure={integration.id === 'slack' ? () => setSlackDialogOpen(true) : () => {}}
            />
          ))}
        </div>

        {/* Stripe note */}
        <div className="p-3 rounded-lg border border-dashed text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground flex items-center gap-1.5">
            <Webhook className="h-3.5 w-3.5 text-violet-500" />
            Paiements Stripe
          </p>
          <p>
            Pour activer les paiements en ligne, configurez{' '}
            <code className="bg-background px-1 rounded">STRIPE_SECRET_KEY</code> et{' '}
            <code className="bg-background px-1 rounded">STRIPE_WEBHOOK_SECRET</code> dans votre{' '}
            <code className="bg-background px-1 rounded">.env</code>.
            Le bouton "Payer en ligne" apparaîtra alors sur vos factures.
          </p>
        </div>
      </div>

      {/* Slack dialog */}
      <SlackConfigDialog
        open={slackDialogOpen}
        onClose={() => setSlackDialogOpen(false)}
        initial={slackConfig}
        onSave={saveSlackConfig}
      />
    </AppLayout>
  );
}
