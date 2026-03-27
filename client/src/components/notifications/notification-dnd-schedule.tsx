'use client';

// IDEA-116: Do-not-disturb schedule — time ranges when notifications are muted

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Moon, Sun, BellOff } from 'lucide-react';
import { notificationsApi } from '@/lib/api/notifications';
import { toast } from 'sonner';

interface DndSchedule {
  enabled: boolean;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
}

const STORAGE_KEY = 'notification_dnd_schedule';

function loadSchedule(): DndSchedule {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { enabled: false, startTime: '22:00', endTime: '08:00' };
  } catch {
    return { enabled: false, startTime: '22:00', endTime: '08:00' };
  }
}

export function isDndActive(schedule: DndSchedule): boolean {
  if (!schedule.enabled) return false;
  const now = new Date();
  const [sh, sm] = schedule.startTime.split(':').map(Number);
  const [eh, em] = schedule.endTime.split(':').map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  // Overnight range (e.g. 22:00 – 08:00)
  if (startMin > endMin) {
    return nowMin >= startMin || nowMin < endMin;
  }
  return nowMin >= startMin && nowMin < endMin;
}

export function NotificationDndSchedule() {
  const [schedule, setSchedule] = useState<DndSchedule>(loadSchedule);
  const [saving, setSaving] = useState(false);
  const active = isDndActive(schedule);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
  }, [schedule]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await notificationsApi.patchPreferences({
        quiet_hours_start: schedule.startTime,
        quiet_hours_end: schedule.endTime,
      });
      toast.success('Plage horaire DND enregistrée');
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
          <BellOff className="h-5 w-5" />
          Ne pas déranger (DND)
        </CardTitle>
        <CardDescription>
          Définissez une plage horaire pendant laquelle les notifications sont silencieuses.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active indicator */}
        {schedule.enabled && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
            active
              ? 'bg-orange-50 text-orange-700 border border-orange-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {active ? (
              <>
                <Moon className="h-4 w-4" />
                Mode DND actif — notifications silencieuses
              </>
            ) : (
              <>
                <Sun className="h-4 w-4" />
                Mode DND inactif — notifications normales
              </>
            )}
          </div>
        )}

        {/* Toggle */}
        <div className="flex items-center justify-between py-2">
          <Label htmlFor="dnd-enabled" className="text-sm font-medium">
            Activer le planning DND
          </Label>
          <Switch
            id="dnd-enabled"
            checked={schedule.enabled}
            onCheckedChange={(v) => setSchedule((s) => ({ ...s, enabled: v }))}
          />
        </div>

        {/* Time range */}
        <div className={`grid grid-cols-2 gap-4 transition-opacity ${schedule.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div className="space-y-1.5">
            <Label htmlFor="dnd-start" className="text-sm flex items-center gap-1.5">
              <Moon className="h-3.5 w-3.5" />
              Début
            </Label>
            <Input
              id="dnd-start"
              type="time"
              value={schedule.startTime}
              onChange={(e) => setSchedule((s) => ({ ...s, startTime: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dnd-end" className="text-sm flex items-center gap-1.5">
              <Sun className="h-3.5 w-3.5" />
              Fin
            </Label>
            <Input
              id="dnd-end"
              type="time"
              value={schedule.endTime}
              onChange={(e) => setSchedule((s) => ({ ...s, endTime: e.target.value }))}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Exemple : 22h00 → 08h00 pour les nuits.
        </p>

        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </CardContent>
    </Card>
  );
}
