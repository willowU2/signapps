"use client";

// IDEA-128: Calendar event triggers — when event starts → send reminder, when ends → create follow-up task

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Bell, Plus, Trash2, CheckSquare } from "lucide-react";
import { toast } from "sonner";

export type TriggerPoint = "before_start" | "at_start" | "at_end";
export type TriggerAction = "send_reminder" | "create_task" | "send_email";

export interface CalendarTrigger {
  id: string;
  name: string;
  enabled: boolean;
  eventFilter: string; // substring match on event title
  triggerPoint: TriggerPoint;
  triggerOffsetMin: number; // minutes before/after
  action: TriggerAction;
  actionPayload: string; // task title or email address
  createdAt: string;
}

const TRIGGER_POINTS: { value: TriggerPoint; label: string }[] = [
  { value: "before_start", label: "Avant le début" },
  { value: "at_start", label: "Au début" },
  { value: "at_end", label: "À la fin" },
];

const TRIGGER_ACTIONS: {
  value: TriggerAction;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "send_reminder",
    label: "Envoyer un rappel",
    placeholder: "Message du rappel",
    icon: <Bell className="h-3.5 w-3.5" />,
  },
  {
    value: "create_task",
    label: "Créer une tâche suivi",
    placeholder: "Titre de la tâche",
    icon: <CheckSquare className="h-3.5 w-3.5" />,
  },
  {
    value: "send_email",
    label: "Envoyer un email",
    placeholder: "destinataire@exemple.com",
    icon: <Bell className="h-3.5 w-3.5" />,
  },
];

const STORAGE_KEY = "calendar_event_triggers";

function loadTriggers(): CalendarTrigger[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTriggers(triggers: CalendarTrigger[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(triggers));
}

function newTrigger(): CalendarTrigger {
  return {
    id: `trig_${Date.now()}`,
    name: "Nouveau déclencheur",
    enabled: true,
    eventFilter: "",
    triggerPoint: "at_start",
    triggerOffsetMin: 0,
    action: "send_reminder",
    actionPayload: "",
    createdAt: new Date().toISOString(),
  };
}

interface TriggerEditorProps {
  trigger: CalendarTrigger;
  onChange: (t: CalendarTrigger) => void;
  onDelete: () => void;
}

function TriggerEditor({ trigger, onChange, onDelete }: TriggerEditorProps) {
  const update = (patch: Partial<CalendarTrigger>) =>
    onChange({ ...trigger, ...patch });
  const actionDef = TRIGGER_ACTIONS.find((a) => a.value === trigger.action);
  const showOffset = trigger.triggerPoint === "before_start";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Input
            value={trigger.name}
            onChange={(e) => update({ name: e.target.value })}
            className="h-7 text-sm font-semibold border-0 shadow-none px-0 focus-visible:ring-0 flex-1"
            placeholder="Nom du déclencheur…"
          />
          <Switch
            checked={trigger.enabled}
            onCheckedChange={(v) => update({ enabled: v })}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={onDelete}
            aria-label="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Event filter */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Filtre événement (titre contient)
          </Label>
          <Input
            value={trigger.eventFilter}
            onChange={(e) => update({ eventFilter: e.target.value })}
            placeholder="Laisser vide = tous les événements"
            className="h-8 text-xs"
          />
        </div>

        {/* Trigger point */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">
              Déclenchement
            </Label>
            <Select
              value={trigger.triggerPoint}
              onValueChange={(v) => update({ triggerPoint: v as TriggerPoint })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_POINTS.map((p) => (
                  <SelectItem key={p.value} value={p.value} className="text-xs">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showOffset && (
            <div className="w-24 space-y-1">
              <Label className="text-xs text-muted-foreground">
                Minutes avant
              </Label>
              <Input
                type="number"
                min={0}
                max={120}
                value={trigger.triggerOffsetMin}
                onChange={(e) =>
                  update({ triggerOffsetMin: Number(e.target.value) })
                }
                className="h-8 text-xs"
              />
            </div>
          )}
        </div>

        {/* Action */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Action</Label>
            <Select
              value={trigger.action}
              onValueChange={(v) =>
                update({ action: v as TriggerAction, actionPayload: "" })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_ACTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value} className="text-xs">
                    <span className="flex items-center gap-1.5">
                      {a.icon}
                      {a.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {actionDef && (
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Valeur</Label>
              <Input
                value={trigger.actionPayload}
                onChange={(e) => update({ actionPayload: e.target.value })}
                placeholder={actionDef.placeholder}
                className="h-8 text-xs"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CalendarEventTriggers() {
  const [triggers, setTriggers] = useState<CalendarTrigger[]>([]);

  useEffect(() => {
    setTriggers(loadTriggers());
  }, []);

  const update = (id: string, updated: CalendarTrigger) => {
    const next = triggers.map((t) => (t.id === id ? updated : t));
    setTriggers(next);
    saveTriggers(next);
  };

  const del = (id: string) => {
    const next = triggers.filter((t) => t.id !== id);
    setTriggers(next);
    saveTriggers(next);
  };

  const add = () => {
    const next = [...triggers, newTrigger()];
    setTriggers(next);
    saveTriggers(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold">Déclencheurs calendrier</h2>
            <p className="text-xs text-muted-foreground">
              {triggers.filter((t) => t.enabled).length}/{triggers.length}{" "}
              actifs
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={add} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {triggers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground border rounded-xl">
          <Calendar className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">Aucun déclencheur</p>
          <p className="text-xs mt-1">Automatisez vos événements calendrier</p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={add}>
            <Plus className="h-4 w-4" />
            Créer un déclencheur
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {triggers.map((t) => (
            <TriggerEditor
              key={t.id}
              trigger={t}
              onChange={(updated) => update(t.id, updated)}
              onDelete={() => del(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
