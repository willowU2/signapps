"use client";

/**
 * person-hero - contextual hero card displayed at the top of the
 * DetailPanel when a Person is selected.
 *
 * Shows :
 * - Avatar 96x96 (photo or initials tint)
 * - Name + title + node primary + email
 * - 3 KPI cards (skills_top / assignments_active / permissions_level)
 * - Quick actions: phone, mail, chat, meet, edit
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { orgApi } from "@/lib/api/org";
import { avatarTint, personInitials, personTitle } from "../avatar-helpers";
import type { OrgNode, Person } from "@/types/org";
import type { PanelHeroKpi } from "@/lib/api/org";
import { Edit, Mail, MessageSquare, Phone, Video, X } from "lucide-react";

export interface PersonHeroProps {
  person: Person;
  primaryNode: OrgNode | null;
  kpis: PanelHeroKpi[];
  quickActions: string[];
  onClose: () => void;
}

interface KpiValue {
  id: string;
  label: string;
  value: number | null;
  loading: boolean;
}

const QUICK_ACTION_BUILTINS: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    href?: (p: Person) => string;
  }
> = {
  phone: {
    label: "Tel",
    icon: Phone,
    href: (p) => (p.phone ? "tel:" + p.phone : ""),
  },
  mail: {
    label: "Mail",
    icon: Mail,
    href: (p) => (p.email ? "mailto:" + p.email : ""),
  },
  chat: { label: "Chat", icon: MessageSquare },
  meet: { label: "Meet", icon: Video },
  edit: { label: "Éditer", icon: Edit },
};

export function PersonHero({
  person,
  primaryNode,
  kpis,
  quickActions,
  onClose,
}: PersonHeroProps) {
  const [kpiValues, setKpiValues] = useState<KpiValue[]>([]);

  useEffect(() => {
    let cancelled = false;
    const items: KpiValue[] = kpis
      .slice(0, 3)
      .filter((k): k is { type: "builtin"; id: string } => k.type === "builtin")
      .map((k) => ({ id: k.id, label: k.id, value: null, loading: true }));
    setKpiValues(items);
    if (items.length === 0) return () => {};

    Promise.all(
      items.map((k) =>
        orgApi.panelLayouts
          .metric(k.id, person.id, "person")
          .then((res) => ({
            id: k.id,
            label: res.data.label,
            value: res.data.value,
            loading: false,
          }))
          .catch(() => ({
            id: k.id,
            label: k.id,
            value: null,
            loading: false,
          })),
      ),
    ).then((resolved) => {
      if (cancelled) return;
      setKpiValues(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [person.id, kpis]);

  const title = personTitle(person);
  const photoUrl = (person as unknown as { photo_url?: string | null })
    .photo_url;

  return (
    <div className="border-b border-border shrink-0 bg-card">
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="shrink-0">
          {photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photoUrl}
              alt={person.first_name + " " + person.last_name}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div
              className={cn(
                "h-16 w-16 rounded-full flex items-center justify-center text-lg font-semibold ring-2 ring-border",
                avatarTint(person.id),
              )}
            >
              {personInitials(person)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-base truncate">
            {person.first_name} {person.last_name}
          </h2>
          {title && (
            <p className="text-sm text-muted-foreground truncate">{title}</p>
          )}
          <div className="mt-0.5 text-xs text-muted-foreground truncate">
            {primaryNode && (
              <span className="font-medium text-foreground">
                {primaryNode.name}
              </span>
            )}
            {primaryNode && person.email && <span> · </span>}
            {person.email && (
              <a
                href={"mailto:" + person.email}
                className="hover:text-foreground"
              >
                {person.email}
              </a>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 h-7 w-7 p-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {kpiValues.length > 0 && (
        <div className="px-4 pb-2 grid grid-cols-3 gap-2">
          {kpiValues.map((kpi) => (
            <div
              key={kpi.id}
              className="rounded-md border border-border bg-muted/30 px-2 py-1.5"
            >
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">
                {kpi.label}
              </p>
              {kpi.loading ? (
                <div className="h-5 bg-muted rounded animate-pulse w-8 mt-0.5" />
              ) : (
                <p className="text-base font-semibold tabular-nums">
                  {kpi.value ?? "—"}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {quickActions.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1">
          {quickActions
            .filter((id) => id in QUICK_ACTION_BUILTINS)
            .map((id) => {
              const def = QUICK_ACTION_BUILTINS[id];
              const Icon = def.icon;
              const href = def.href ? def.href(person) : "";
              if (href) {
                return (
                  <Button
                    key={id}
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-7 px-2 text-xs"
                  >
                    <a href={href}>
                      <Icon className="h-3 w-3 mr-1" />
                      {def.label}
                    </a>
                  </Button>
                );
              }
              return (
                <Button
                  key={id}
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {def.label}
                </Button>
              );
            })}
        </div>
      )}
    </div>
  );
}
