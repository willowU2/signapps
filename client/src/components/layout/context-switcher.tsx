"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuthStore } from "@/lib/store";
import { contextApi, type LoginContextDisplay } from "@/lib/api/companies";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<LoginContextDisplay["context_type"], string> = {
  employee: "Employé",
  client: "Client",
  supplier: "Fournisseur",
  partner: "Partenaire",
};

const AVATAR_BG_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getAvatarBg(name: string): string {
  return AVATAR_BG_COLORS[name.charCodeAt(0) % AVATAR_BG_COLORS.length];
}

function CompanyAvatar({
  ctx,
  size = "sm",
}: {
  ctx: LoginContextDisplay;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? "h-8 w-8 text-sm" : "h-5 w-5 text-xs";

  if (ctx.company_logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ctx.company_logo}
        alt={ctx.company_name}
        className={`${sizeClass} rounded object-cover shrink-0`}
      />
    );
  }

  if (ctx.icon) {
    return (
      <span
        className={`${sizeClass} flex items-center justify-center rounded shrink-0 text-white font-bold`}
        style={{ backgroundColor: ctx.color ?? undefined }}
      >
        {ctx.icon}
      </span>
    );
  }

  return (
    <span
      className={`${sizeClass} flex items-center justify-center rounded shrink-0 text-white font-bold ${ctx.color ? "" : getAvatarBg(ctx.company_name)}`}
      style={ctx.color ? { backgroundColor: ctx.color } : undefined}
    >
      {ctx.company_name.charAt(0).toUpperCase()}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function ContextSwitcher() {
  const { activeContext, availableContexts, setActiveContext } = useAuthStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // Only render when the user has more than one context
  if (!availableContexts || availableContexts.length <= 1) return null;

  const handleSwitch = async (ctx: LoginContextDisplay) => {
    if (ctx.id === activeContext?.id || switchingId) return;

    setSwitchingId(ctx.id);
    setOpen(false);

    try {
      const response = await contextApi.switch(ctx.id);
      const { access_token, refresh_token } = response.data;

      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);

      setActiveContext(ctx);

      // Full page reload so all data is refreshed with the new context token
      router.refresh();
      window.location.reload();
    } catch {
      // Ignore switch errors — silently remain on current context
    } finally {
      setSwitchingId(null);
    }
  };

  const otherContexts = availableContexts.filter(
    (c) => c.id !== activeContext?.id,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 h-8 text-muted-foreground hover:text-foreground"
          aria-label="Changer de contexte"
        >
          {activeContext ? (
            <>
              <CompanyAvatar ctx={activeContext} size="sm" />
              <span className="hidden sm:inline-block max-w-[120px] truncate text-xs font-medium">
                {activeContext.company_name}
              </span>
            </>
          ) : (
            <span className="text-xs">Contexte</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-72 p-2 bg-card border border-border shadow-lg"
      >
        {/* Current context header */}
        {activeContext && (
          <div className="mb-1 px-2 py-2 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-3">
              <CompanyAvatar ctx={activeContext} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {activeContext.company_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABELS[activeContext.context_type]}
                  {activeContext.job_title
                    ? ` — ${activeContext.job_title}`
                    : ""}
                </p>
              </div>
              <Badge variant="default" className="text-xs shrink-0">
                Actif
              </Badge>
            </div>
          </div>
        )}

        {/* Separator label */}
        {otherContexts.length > 0 && (
          <p className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Autres contextes
          </p>
        )}

        {/* Other contexts list */}
        {otherContexts.map((ctx) => (
          <button
            key={ctx.id}
            onClick={() => handleSwitch(ctx)}
            disabled={!!switchingId}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left hover:bg-muted transition-colors disabled:opacity-50"
          >
            <CompanyAvatar ctx={ctx} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {ctx.company_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {ROLE_LABELS[ctx.context_type]}
                {ctx.job_title ? ` — ${ctx.job_title}` : ""}
              </p>
            </div>
            {switchingId === ctx.id && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
