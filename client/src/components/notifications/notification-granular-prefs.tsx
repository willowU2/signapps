'use client';

// IDEA-114: Granular notification preferences — per-module, per-event-type toggles

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { notificationsApi } from '@/lib/api/notifications';
import { toast } from 'sonner';
import { Bell, Mail, Calendar, CheckSquare, FileText, Users } from 'lucide-react';

interface ModulePrefs {
  [module: string]: {
    [event: string]: boolean;
  };
}

const MODULE_EVENTS: { module: string; icon: React.ReactNode; label: string; events: { key: string; label: string }[] }[] = [
  {
    module: 'mail',
    icon: <Mail className="h-4 w-4" />,
    label: 'Mail',
    events: [
      { key: 'new_message', label: 'Nouveau message' },
      { key: 'reply', label: 'Réponse reçue' },
      { key: 'mention', label: 'Mention (@)' },
    ],
  },
  {
    module: 'calendar',
    icon: <Calendar className="h-4 w-4" />,
    label: 'Calendrier',
    events: [
      { key: 'event_reminder', label: 'Rappel d\'événement' },
      { key: 'invitation', label: 'Invitation reçue' },
      { key: 'rsvp_update', label: 'Mise à jour RSVP' },
    ],
  },
  {
    module: 'tasks',
    icon: <CheckSquare className="h-4 w-4" />,
    label: 'Tâches',
    events: [
      { key: 'assigned', label: 'Tâche assignée' },
      { key: 'due_soon', label: 'Échéance proche' },
      { key: 'completed', label: 'Tâche terminée' },
    ],
  },
  {
    module: 'docs',
    icon: <FileText className="h-4 w-4" />,
    label: 'Documents',
    events: [
      { key: 'mention', label: 'Mention dans un doc' },
      { key: 'shared', label: 'Document partagé' },
      { key: 'comment', label: 'Nouveau commentaire' },
    ],
  },
  {
    module: 'team',
    icon: <Users className="h-4 w-4" />,
    label: 'Équipe',
    events: [
      { key: 'message', label: 'Message d\'équipe' },
      { key: 'join', label: 'Nouveau membre' },
    ],
  },
];

const STORAGE_KEY = 'notification_granular_prefs';

function loadPrefs(): ModulePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePrefs(prefs: ModulePrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function isEnabled(prefs: ModulePrefs, module: string, event: string): boolean {
  return prefs[module]?.[event] !== false; // default on
}

export function NotificationGranularPrefs() {
  const [prefs, setPrefs] = useState<ModulePrefs>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const toggle = async (module: string, event: string, value: boolean) => {
    const next: ModulePrefs = {
      ...prefs,
      [module]: { ...(prefs[module] ?? {}), [event]: value },
    };
    setPrefs(next);
    savePrefs(next);
    setSaving(true);
    try {
      await notificationsApi.patchPreferences({
        per_service: Object.fromEntries(
          Object.entries(next).flatMap(([mod, events]) =>
            Object.entries(events).map(([ev, enabled]) => [`${mod}:${ev}`, enabled])
          )
        ),
      });
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Préférences granulaires
        </CardTitle>
        <CardDescription>
          Activez ou désactivez les notifications par module et type d&apos;événement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {MODULE_EVENTS.map(({ module, icon, label, events }) => (
          <div key={module} className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-muted-foreground">{icon}</span>
              <span className="font-semibold text-sm">{label}</span>
              <Badge variant="secondary" className="text-xs ml-auto">
                {events.filter(e => isEnabled(prefs, module, e.key)).length}/{events.length} actifs
              </Badge>
            </div>
            <div className="pl-6 space-y-2">
              {events.map(({ key, label: evLabel }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">{evLabel}</span>
                  <Switch
                    checked={isEnabled(prefs, module, key)}
                    onCheckedChange={(v) => toggle(module, key, v)}
                    disabled={saving}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
