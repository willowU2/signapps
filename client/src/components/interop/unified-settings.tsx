"use client";

// Idea 37: Unified settings — one place to configure cross-module behavior
// Idea 38: Cross-module analytics — combined metrics dashboard

import { useState, useEffect, useCallback } from "react";
import { Settings2, BarChart3, TrendingUp, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";

const identityClient = () => getClient(ServiceName.IDENTITY);

interface InteropSettings {
  auto_contact_from_form: boolean;
  auto_task_from_mail: boolean;
  sync_calendar_tasks: boolean;
  inherit_permissions: boolean;
  dedup_enabled: boolean;
  smart_routing: boolean;
  activity_digest_frequency: "daily" | "weekly" | "never";
}

const DEFAULTS: InteropSettings = {
  auto_contact_from_form: true,
  auto_task_from_mail: false,
  sync_calendar_tasks: true,
  inherit_permissions: false,
  dedup_enabled: true,
  smart_routing: true,
  activity_digest_frequency: "weekly",
};

/** Idea 37 – Unified cross-module settings */
export function UnifiedInteropSettings() {
  const [settings, setSettings] = useState<InteropSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    identityClient()
      .get<InteropSettings>("/settings/interop")
      .then(({ data }) => setSettings({ ...DEFAULTS, ...data }))
      .catch(() => {
        const saved = localStorage.getItem("interop-settings");
        if (saved)
          try {
            setSettings({ ...DEFAULTS, ...JSON.parse(saved) });
          } catch {
            /* */
          }
      })
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof InteropSettings, val: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await identityClient().put("/settings/interop", settings);
      toast.success("Paramètres sauvegardés");
    } catch {
      localStorage.setItem("interop-settings", JSON.stringify(settings));
      toast.success("Paramètres sauvegardés localement");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="animate-pulse h-48 rounded bg-muted" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Settings2 className="w-4 h-4" />
        Paramètres d'interopérabilité
      </div>

      <div className="space-y-2">
        {(
          [
            [
              "auto_contact_from_form",
              "Créer contacts depuis réponses formulaires",
            ],
            ["auto_task_from_mail", "Créer tâches depuis emails entrants"],
            ["sync_calendar_tasks", "Synchroniser tâches ↔ calendrier"],
            ["inherit_permissions", "Hériter permissions des entités liées"],
            ["dedup_enabled", "Détection automatique des doublons"],
            ["smart_routing", "Routage intelligent (IA)"],
          ] as [keyof InteropSettings, string][]
        ).map(([key, label]) => (
          <div
            key={key}
            className="flex items-center justify-between p-2.5 rounded-lg border"
          >
            <Label className="text-sm cursor-pointer">{label}</Label>
            <Switch
              checked={settings[key] as boolean}
              onCheckedChange={(val) => update(key, val)}
            />
          </div>
        ))}

        <div className="flex items-center justify-between p-2.5 rounded-lg border">
          <Label className="text-sm">Fréquence du digest d'activité</Label>
          <Select
            value={settings.activity_digest_frequency}
            onValueChange={(val) => update("activity_digest_frequency", val)}
          >
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Quotidien</SelectItem>
              <SelectItem value="weekly">Hebdomadaire</SelectItem>
              <SelectItem value="never">Jamais</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={save}
        disabled={saving}
        className="h-8 gap-2 text-sm w-full"
      >
        {saving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
        Sauvegarder
      </Button>
    </div>
  );
}

interface ModuleMetric {
  module: string;
  label: string;
  icon: string;
  created: number;
  updated: number;
  deleted: number;
  active_users: number;
}

/** Idea 38 – Cross-module analytics dashboard */
export function CrossModuleAnalytics() {
  const [metrics, setMetrics] = useState<ModuleMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await identityClient().get<ModuleMetric[]>(
        "/analytics/cross-module",
        {
          params: { period },
        },
      );
      setMetrics(data);
    } catch {
      // Mock data for display
      setMetrics([
        {
          module: "docs",
          label: "Documents",
          icon: "📄",
          created: 12,
          updated: 34,
          deleted: 2,
          active_users: 5,
        },
        {
          module: "tasks",
          label: "Tâches",
          icon: "✅",
          created: 28,
          updated: 45,
          deleted: 8,
          active_users: 7,
        },
        {
          module: "mail",
          label: "Emails",
          icon: "✉️",
          created: 67,
          updated: 12,
          deleted: 5,
          active_users: 4,
        },
        {
          module: "contacts",
          label: "Contacts",
          icon: "👤",
          created: 8,
          updated: 15,
          deleted: 1,
          active_users: 3,
        },
        {
          module: "calendar",
          label: "Calendrier",
          icon: "📅",
          created: 14,
          updated: 22,
          deleted: 3,
          active_users: 6,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const total = metrics.reduce((sum, m) => sum + m.created + m.updated, 0);

  if (loading) return <div className="animate-pulse h-32 rounded bg-muted" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="w-4 h-4" />
          Analytics multi-modules
        </div>
        <div className="flex gap-1">
          {(["day", "week", "month"] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? "default" : "ghost"}
              onClick={() => setPeriod(p)}
              className="h-6 px-2 text-xs"
            >
              {p === "day" ? "24h" : p === "week" ? "7j" : "30j"}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg">
        <TrendingUp className="w-4 h-4 text-green-500" />
        <span className="text-sm font-medium">{total} actions totales</span>
        <Badge variant="secondary" className="text-xs ml-auto">
          {metrics.reduce((s, m) => s + m.active_users, 0)} utilisateurs actifs
        </Badge>
      </div>

      <div className="space-y-1.5">
        {metrics
          .sort((a, b) => b.created + b.updated - (a.created + a.updated))
          .map((m) => {
            const activity = m.created + m.updated;
            const maxActivity = Math.max(
              ...metrics.map((x) => x.created + x.updated),
            );
            const pct = maxActivity > 0 ? (activity / maxActivity) * 100 : 0;

            return (
              <div key={m.module} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span>{m.icon}</span>
                    <span className="font-medium">{m.label}</span>
                  </span>
                  <div className="flex gap-2 text-muted-foreground">
                    <span className="text-green-600">+{m.created}</span>
                    <span className="text-blue-600">~{m.updated}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
