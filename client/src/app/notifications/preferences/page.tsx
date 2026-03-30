"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  notificationsApi,
  type NotificationPreferences,
} from "@/lib/api/notifications";
import { toast } from "sonner";
import { NotificationGranularPrefs } from "@/components/notifications/notification-granular-prefs";
import { NotificationDndSchedule } from "@/components/notifications/notification-dnd-schedule";
import { NotificationSounds } from "@/components/notifications/notification-sounds";
import { usePageTitle } from '@/hooks/use-page-title';

// ─── Known services ───────────────────────────────────────────────────────────

const KNOWN_SERVICES: { slug: string; label: string }[] = [
  { slug: "mail",      label: "Mail"          },
  { slug: "calendar",  label: "Calendrier"    },
  { slug: "drive",     label: "Drive"         },
  { slug: "chat",      label: "Chat"          },
  { slug: "meet",      label: "Meet"          },
  { slug: "tasks",     label: "Tâches"        },
  { slug: "docs",      label: "Documents"     },
  { slug: "storage",   label: "Stockage"      },
  { slug: "identity",  label: "Identité"      },
  { slug: "billing",   label: "Facturation"   },
];

const DEFAULT_PREFS: NotificationPreferences = {
  email_enabled: true,
  push_enabled: true,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  per_service: Object.fromEntries(KNOWN_SERVICES.map(({ slug }) => [slug, true])),
};

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
        ${checked ? "bg-primary" : "bg-muted"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-zinc-200 shadow ring-0
          transition duration-200 ease-in-out
          ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function PrefsRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationPreferencesPage() {
  usePageTitle('Preferences notifications');
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch preferences from the notifications service
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    notificationsApi
      .getPreferences()
      .then((res) => {
        if (!cancelled) setPrefs(res.data);
      })
      .catch(() => {
        // Backend may not have preferences endpoint yet — fall back to defaults
        if (!cancelled) setPrefs(DEFAULT_PREFS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function setField<K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  function setService(slug: string, enabled: boolean) {
    setPrefs((prev) => ({
      ...prev,
      per_service: { ...prev.per_service, [slug]: enabled },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await notificationsApi.patchPreferences(prefs);
      toast.success("Préférences enregistrées");
    } catch {
      toast.error("Impossible d'enregistrer les préférences");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Préférences de notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gérez comment et quand vous recevez des notifications.
            </p>
          </div>
          <a
            href="/notifications"
            className="text-sm text-primary hover:underline"
          >
            ← Retour
          </a>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <>
            {/* Channel toggles */}
            <Section
              title="Canaux de notification"
              description="Choisissez par quel canal vous souhaitez recevoir les notifications."
            >
              <PrefsRow
                label="Notifications par e-mail"
                hint="Recevez un e-mail pour les événements importants."
                checked={prefs.email_enabled}
                onChange={(v) => setField("email_enabled", v)}
              />
              <PrefsRow
                label="Notifications push"
                hint="Notifications dans le navigateur ou l'application de bureau."
                checked={prefs.push_enabled}
                onChange={(v) => setField("push_enabled", v)}
              />
            </Section>

            {/* Quiet hours */}
            <Section
              title="Heures silencieuses"
              description="Aucune notification ne sera envoyée pendant cette période."
            >
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-sm font-medium">
                    Début
                  </label>
                  <input
                    type="time"
                    value={prefs.quiet_hours_start}
                    onChange={(e) =>
                      setField("quiet_hours_start", e.target.value)
                    }
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-sm font-medium">
                    Fin
                  </label>
                  <input
                    type="time"
                    value={prefs.quiet_hours_end}
                    onChange={(e) =>
                      setField("quiet_hours_end", e.target.value)
                    }
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </Section>

            {/* Per-service toggles */}
            <Section
              title="Notifications par service"
              description="Activez ou désactivez les notifications de chaque service."
            >
              {KNOWN_SERVICES.map(({ slug, label }) => (
                <PrefsRow
                  key={slug}
                  label={label}
                  checked={prefs.per_service[slug] ?? true}
                  onChange={(v) => setService(slug, v)}
                />
              ))}
            </Section>

            {/* IDEA-114: Granular per-module, per-event prefs */}
            <NotificationGranularPrefs />

            {/* IDEA-116: DND schedule */}
            <NotificationDndSchedule />

            {/* IDEA-117: Custom sounds */}
            <NotificationSounds />

            {/* Save button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground
                  text-sm font-medium hover:bg-primary/90 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Enregistrement…" : "Enregistrer les préférences"}
              </button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
