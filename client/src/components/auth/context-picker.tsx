"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { LoginContextDisplay } from "@/lib/api/companies";

// ─────────────────────────────────────────────────────────────────────────────
// Role labels
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<LoginContextDisplay["context_type"], string> = {
  employee: "Employé",
  client: "Client",
  supplier: "Fournisseur",
  partner: "Partenaire",
};

const ROLE_COLORS: Record<
  LoginContextDisplay["context_type"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  employee: "default",
  client: "secondary",
  supplier: "outline",
  partner: "outline",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatLastUsed(isoDate?: string): string | null {
  if (!isoDate) return null;
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context avatar — shows logo, emoji or first letter
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_BG_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function ContextAvatar({
  ctx,
  size = "lg",
}: {
  ctx: LoginContextDisplay;
  size?: "sm" | "lg";
}) {
  const sizeClass = size === "lg" ? "h-12 w-12 text-lg" : "h-7 w-7 text-xs";
  const colorIndex = ctx.company_name.charCodeAt(0) % AVATAR_BG_COLORS.length;
  const bgColor = ctx.color ? undefined : AVATAR_BG_COLORS[colorIndex];

  if (ctx.company_logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ctx.company_logo}
        alt={ctx.company_name}
        className={`${sizeClass} rounded-lg object-cover shrink-0`}
      />
    );
  }

  if (ctx.icon) {
    return (
      <span
        className={`${sizeClass} flex items-center justify-center rounded-lg shrink-0 text-white font-bold`}
        style={{ backgroundColor: ctx.color ?? undefined }}
      >
        {ctx.icon}
      </span>
    );
  }

  return (
    <span
      className={`${sizeClass} flex items-center justify-center rounded-lg shrink-0 text-white font-bold ${bgColor ?? ""}`}
      style={ctx.color ? { backgroundColor: ctx.color } : undefined}
    >
      {ctx.company_name.charAt(0).toUpperCase()}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export interface ContextPickerProps {
  contexts: LoginContextDisplay[];
  onSelect: (contextId: string) => void;
  isLoading: boolean;
}

export function ContextPicker({
  contexts,
  onSelect,
  isLoading,
}: ContextPickerProps) {
  return (
    <div className="w-full max-w-2xl">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-semibold text-foreground">
          Choisissez votre contexte
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vous êtes rattaché à plusieurs entreprises. Sélectionnez le contexte
          dans lequel vous souhaitez vous connecter.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {contexts.map((ctx) => {
          const lastUsed = formatLastUsed(ctx.last_used_at);

          return (
            <Card
              key={ctx.id}
              className="cursor-pointer border border-border bg-card hover:border-primary/50 hover:bg-muted/50 transition-all duration-150 rounded-xl"
              onClick={() => !isLoading && onSelect(ctx.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !isLoading) {
                  e.preventDefault();
                  onSelect(ctx.id);
                }
              }}
              aria-label={`Se connecter en tant que ${ROLE_LABELS[ctx.context_type]} chez ${ctx.company_name}`}
            >
              <CardContent className="flex items-start gap-4 p-4">
                <ContextAvatar ctx={ctx} size="lg" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground truncate">
                      {ctx.company_name}
                    </span>
                    <Badge variant={ROLE_COLORS[ctx.context_type]}>
                      {ROLE_LABELS[ctx.context_type]}
                    </Badge>
                  </div>

                  {ctx.job_title && (
                    <p className="mt-0.5 text-sm text-muted-foreground truncate">
                      {ctx.job_title}
                    </p>
                  )}

                  {lastUsed && (
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      Dernière connexion : {lastUsed}
                    </p>
                  )}
                </div>

                {isLoading && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
