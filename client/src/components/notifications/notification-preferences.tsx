"use client";

// NT2 + NT3: Granular notification preferences matrix + configurable digest frequency

import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { notificationsApi } from "@/lib/api/notifications";
import { toast } from "sonner";
import {
  Bell,
  Mail,
  Smartphone,
  Monitor,
  Moon,
  Clock,
  ChevronDown,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Channel = "in_app" | "email" | "push";

interface EventPref {
  in_app: boolean;
  email: boolean;
  push: boolean;
}

type MatrixPrefs = Record<string, Record<string, EventPref>>;

type DigestFrequency = "instant" | "hourly" | "daily" | "weekly";

interface NotificationSettings {
  matrix: MatrixPrefs;
  quiet_hours_start: string;
  quiet_hours_end: string;
  digest_frequency: DigestFrequency;
}

// ── Event catalog ─────────────────────────────────────────────────────────────

const EVENTS: {
  key: string;
  label: string;
  category: string;
  categoryLabel: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "mail.received",
    label: "Email reçu",
    category: "mail",
    categoryLabel: "Mail",
    icon: <Mail className="h-3.5 w-3.5" />,
  },
  {
    key: "mail.mentioned",
    label: "Mention dans un email",
    category: "mail",
    categoryLabel: "Mail",
    icon: <Mail className="h-3.5 w-3.5" />,
  },
  {
    key: "deal.won",
    label: "Affaire gagnée",
    category: "crm",
    categoryLabel: "CRM",
    icon: null,
  },
  {
    key: "deal.lost",
    label: "Affaire perdue",
    category: "crm",
    categoryLabel: "CRM",
    icon: null,
  },
  {
    key: "task.assigned",
    label: "Tâche assignée",
    category: "tasks",
    categoryLabel: "Tâches",
    icon: null,
  },
  {
    key: "task.overdue",
    label: "Tâche en retard",
    category: "tasks",
    categoryLabel: "Tâches",
    icon: null,
  },
  {
    key: "task.completed",
    label: "Tâche terminée",
    category: "tasks",
    categoryLabel: "Tâches",
    icon: null,
  },
  {
    key: "calendar.reminder",
    label: "Rappel d'événement",
    category: "calendar",
    categoryLabel: "Calendrier",
    icon: null,
  },
  {
    key: "calendar.invite",
    label: "Invitation reçue",
    category: "calendar",
    categoryLabel: "Calendrier",
    icon: null,
  },
  {
    key: "doc.shared",
    label: "Document partagé",
    category: "docs",
    categoryLabel: "Documents",
    icon: null,
  },
  {
    key: "doc.commented",
    label: "Commentaire sur un doc",
    category: "docs",
    categoryLabel: "Documents",
    icon: null,
  },
  {
    key: "hr.leave_request",
    label: "Demande de congé",
    category: "hr",
    categoryLabel: "RH",
    icon: null,
  },
  {
    key: "hr.payslip",
    label: "Fiche de paie disponible",
    category: "hr",
    categoryLabel: "RH",
    icon: null,
  },
  {
    key: "billing.invoice",
    label: "Nouvelle facture",
    category: "billing",
    categoryLabel: "Facturation",
    icon: null,
  },
  {
    key: "security.alert",
    label: "Alerte de sécurité",
    category: "security",
    categoryLabel: "Sécurité",
    icon: null,
  },
];

const CATEGORIES = Array.from(
  new Map(EVENTS.map((e) => [e.category, e.categoryLabel])).entries(),
).map(([key, label]) => ({ key, label }));

const CHANNELS: { key: Channel; label: string; icon: React.ReactNode }[] = [
  { key: "in_app", label: "In-app", icon: <Monitor className="h-3.5 w-3.5" /> },
  { key: "email", label: "Email", icon: <Mail className="h-3.5 w-3.5" /> },
  { key: "push", label: "Push", icon: <Smartphone className="h-3.5 w-3.5" /> },
];

const DIGEST_OPTIONS: { value: DigestFrequency; label: string }[] = [
  { value: "instant", label: "Instantané (par défaut)" },
  { value: "hourly", label: "Toutes les heures" },
  { value: "daily", label: "Quotidien (8h)" },
  { value: "weekly", label: "Hebdomadaire (lundi 8h)" },
];

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = "notif_prefs_v2";

function defaultMatrix(): MatrixPrefs {
  const m: MatrixPrefs = {};
  for (const e of EVENTS) {
    if (!m[e.category]) m[e.category] = {};
    m[e.category][e.key] = { in_app: true, email: false, push: false };
  }
  return m;
}

function loadSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        matrix: parsed.matrix ?? defaultMatrix(),
        quiet_hours_start: parsed.quiet_hours_start ?? "22:00",
        quiet_hours_end: parsed.quiet_hours_end ?? "08:00",
        digest_frequency: parsed.digest_frequency ?? "instant",
      };
    }
  } catch {
    // ignore
  }
  return {
    matrix: defaultMatrix(),
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00",
    digest_frequency: "instant",
  };
}

function saveSettings(s: NotificationSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationPreferences() {
  const [settings, setSettings] = useState<NotificationSettings>(loadSettings);
  const [saving, setSaving] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(
    CATEGORIES[0]?.key ?? null,
  );

  const updateMatrix = async (
    category: string,
    eventKey: string,
    channel: Channel,
    value: boolean,
  ) => {
    const next: NotificationSettings = {
      ...settings,
      matrix: {
        ...settings.matrix,
        [category]: {
          ...(settings.matrix[category] ?? {}),
          [eventKey]: {
            ...(settings.matrix[category]?.[eventKey] ?? {
              in_app: true,
              email: false,
              push: false,
            }),
            [channel]: value,
          },
        },
      },
    };
    setSettings(next);
    saveSettings(next);

    // Sync to server
    setSaving(true);
    try {
      const perService: Record<string, boolean> = {};
      for (const [cat, events] of Object.entries(next.matrix)) {
        for (const [ev, prefs] of Object.entries(events)) {
          for (const ch of Object.keys(prefs) as Channel[]) {
            perService[`${cat}:${ev}:${ch}`] = (prefs as EventPref)[ch];
          }
        }
      }
      await notificationsApi.updatePreferences({
        per_service: perService,
        quiet_hours_start: next.quiet_hours_start,
        quiet_hours_end: next.quiet_hours_end,
      });
    } catch {
      toast.error("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  const updateQuietHours = (
    field: "quiet_hours_start" | "quiet_hours_end",
    value: string,
  ) => {
    const next = { ...settings, [field]: value };
    setSettings(next);
    saveSettings(next);
  };

  const updateDigest = (value: DigestFrequency) => {
    const next = { ...settings, digest_frequency: value };
    setSettings(next);
    saveSettings(next);
    toast.success("Fréquence du résumé mise à jour.");
  };

  const getPref = (
    category: string,
    eventKey: string,
    channel: Channel,
  ): boolean => {
    return (
      settings.matrix[category]?.[eventKey]?.[channel] ?? channel === "in_app"
    );
  };

  const getCategoryStats = (category: string) => {
    const events = EVENTS.filter((e) => e.category === category);
    let active = 0;
    for (const e of events) {
      for (const ch of CHANNELS) {
        if (getPref(category, e.key, ch.key)) active++;
      }
    }
    return { total: events.length * CHANNELS.length, active };
  };

  return (
    <div className="space-y-6">
      {/* Matrix card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5" />
            Préférences par événement
          </CardTitle>
          <CardDescription>
            Configurez les canaux de notification pour chaque type
            d&apos;événement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {CATEGORIES.map((cat) => {
            const catEvents = EVENTS.filter((e) => e.category === cat.key);
            const stats = getCategoryStats(cat.key);
            const isExpanded = expandedCat === cat.key;

            return (
              <div key={cat.key} className="border rounded-lg overflow-hidden">
                {/* Category header */}
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                  onClick={() => setExpandedCat(isExpanded ? null : cat.key)}
                >
                  <span className="font-medium text-sm">{cat.label}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {stats.active}/{stats.total} actifs
                    </Badge>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>

                {/* Events matrix */}
                {isExpanded && (
                  <div className="px-4 pb-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 pr-4 font-medium text-muted-foreground text-xs">
                              Événement
                            </th>
                            {CHANNELS.map((ch) => (
                              <th
                                key={ch.key}
                                className="text-center py-2 px-3 font-medium text-muted-foreground text-xs"
                              >
                                <div className="flex items-center justify-center gap-1">
                                  {ch.icon}
                                  <span>{ch.label}</span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {catEvents.map((event) => (
                            <tr
                              key={event.key}
                              className="border-b last:border-0"
                            >
                              <td className="py-2.5 pr-4 text-xs">
                                {event.label}
                              </td>
                              {CHANNELS.map((ch) => (
                                <td
                                  key={ch.key}
                                  className="py-2.5 px-3 text-center"
                                >
                                  <Checkbox
                                    id={`${event.key}-${ch.key}`}
                                    checked={getPref(
                                      cat.key,
                                      event.key,
                                      ch.key,
                                    )}
                                    onCheckedChange={(v) =>
                                      updateMatrix(
                                        cat.key,
                                        event.key,
                                        ch.key,
                                        !!v,
                                      )
                                    }
                                    disabled={saving}
                                    aria-label={`${event.label} via ${ch.label}`}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Quiet hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Moon className="h-5 w-5" />
            Heures calmes
          </CardTitle>
          <CardDescription>
            Les notifications push ne seront pas envoyées pendant ces heures.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <Label
                htmlFor="quiet-start"
                className="text-xs text-muted-foreground"
              >
                De
              </Label>
              <Input
                id="quiet-start"
                type="time"
                value={settings.quiet_hours_start}
                onChange={(e) =>
                  updateQuietHours("quiet_hours_start", e.target.value)
                }
                className="w-32"
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="quiet-end"
                className="text-xs text-muted-foreground"
              >
                À
              </Label>
              <Input
                id="quiet-end"
                type="time"
                value={settings.quiet_hours_end}
                onChange={(e) =>
                  updateQuietHours("quiet_hours_end", e.target.value)
                }
                className="w-32"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Par défaut : {settings.quiet_hours_start} →{" "}
            {settings.quiet_hours_end}
          </p>
        </CardContent>
      </Card>

      {/* NT3: Digest frequency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5" />
            Fréquence du résumé
          </CardTitle>
          <CardDescription>
            Choisissez à quelle fréquence recevoir un résumé groupé de vos
            notifications. Les jobs de digest quotidien/hebdomadaire respectent
            ce paramètre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={settings.digest_frequency}
            onValueChange={(v) => updateDigest(v as DigestFrequency)}
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIGEST_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {settings.digest_frequency !== "instant" && (
            <p className="text-xs text-muted-foreground mt-2">
              {settings.digest_frequency === "hourly" &&
                "Vous recevrez un résumé toutes les heures."}
              {settings.digest_frequency === "daily" &&
                "Vous recevrez un résumé chaque matin à 8h."}
              {settings.digest_frequency === "weekly" &&
                "Vous recevrez un résumé chaque lundi à 8h."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
